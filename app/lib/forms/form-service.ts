import "server-only";

import {
  FormFieldType,
  FormVersionStatus,
  Prisma,
} from "@/app/generated/prisma/client";
import { requireCurrentUser } from "@/app/lib/dal/auth";
import { ConflictError, NotFoundError } from "@/app/lib/dal/errors";
import { db } from "@/app/lib/db/client";
import {
  formIdSchema,
  saveChecklistFormSubmissionSchema,
  saveFormDraftSchema,
  type SaveChecklistFormSubmissionInput,
  type SaveFormDraftInput,
} from "./validation";
import { fieldDTO, versionDTO, versionInclude } from "./form-dal";
import type {
  ChecklistFormWorkspaceDTO,
  FormFieldDTO,
  FormRevisionDTO,
} from "./types";

function nameKey(name: string): string {
  return name.trim().toLocaleLowerCase();
}

async function requireManagedForm(formId: string, userId: string) {
  const form = await db.form.findFirst({
    where: { id: formId, board: { createdById: userId } },
    include: {
      versions: { orderBy: { version: "desc" }, include: versionInclude },
    },
  });
  if (!form) throw new NotFoundError("Form");
  return form;
}

export async function saveFormDraft(input: SaveFormDraftInput) {
  const currentUser = await requireCurrentUser();
  const data = saveFormDraftSchema.parse(input);

  return db.$transaction(async (tx) => {
    const board = await tx.board.findFirst({
      where: { id: data.boardId, createdById: currentUser.id },
      select: { id: true },
    });
    if (!board) throw new NotFoundError("Board");
    const duplicateName = await tx.form.findFirst({
      where: {
        boardId: board.id,
        nameKey: nameKey(data.name),
        ...(data.formId ? { id: { not: data.formId } } : {}),
      },
      select: { id: true },
    });
    if (duplicateName) {
      throw new ConflictError("A form with this name already exists.");
    }

    const form = data.formId
      ? await tx.form.findFirst({
          where: { id: data.formId, boardId: board.id },
          include: { versions: { orderBy: { version: "desc" } } },
        })
      : await tx.form.create({
          data: {
            boardId: board.id,
            name: data.name,
            nameKey: nameKey(data.name),
          },
          include: { versions: true },
        });
    if (!form) throw new NotFoundError("Form");
    if (form.archivedAt) throw new ConflictError("Archived forms cannot be edited.");

    const existingDraft = form.versions.find(
      (version) => version.status === FormVersionStatus.DRAFT,
    );
    if (
      existingDraft &&
      data.expectedUpdatedAt &&
      existingDraft.updatedAt.toISOString() !== data.expectedUpdatedAt
    ) {
      throw new ConflictError("This form draft changed in another session.");
    }

    await tx.form.update({
      where: { id: form.id },
      data: { name: data.name, nameKey: nameKey(data.name) },
    });

    const draft =
      existingDraft ??
      (await tx.formVersion.create({
        data: {
          formId: form.id,
          version: Math.max(0, ...form.versions.map((row) => row.version)) + 1,
          status: FormVersionStatus.DRAFT,
          name: data.name,
          description: data.description,
        },
      }));

    await tx.formField.deleteMany({ where: { formVersionId: draft.id } });
    await tx.formSection.deleteMany({ where: { formVersionId: draft.id } });
    await tx.formVersion.update({
      where: { id: draft.id },
      data: { name: data.name, description: data.description },
    });

    for (const [position, field] of data.ungroupedFields.entries()) {
      await tx.formField.create({
        data: {
          formVersionId: draft.id,
          fieldKey: field.fieldKey ?? crypto.randomUUID(),
          label: field.label,
          description: field.description,
          type: field.type as FormFieldType,
          options: field.options,
          isRequired: field.isRequired,
          position,
        },
      });
    }

    for (const [position, section] of data.sections.entries()) {
      const savedSection = await tx.formSection.create({
        data: {
          formVersionId: draft.id,
          title: section.title,
          description: section.description,
          position,
        },
      });
      await Promise.all(
        section.fields.map((field, fieldPosition) =>
          tx.formField.create({
            data: {
              formVersionId: draft.id,
              sectionId: savedSection.id,
              fieldKey: field.fieldKey ?? crypto.randomUUID(),
              label: field.label,
              description: field.description,
              type: field.type as FormFieldType,
              options: field.options,
              isRequired: field.isRequired,
              position: fieldPosition,
            },
          }),
        ),
      );
    }

    const savedDraft = await tx.formVersion.findUniqueOrThrow({
      where: { id: draft.id },
      select: { updatedAt: true },
    });
    return { id: form.id, updatedAt: savedDraft.updatedAt.toISOString() };
  });
}

export async function publishForm(formIdInput: string): Promise<void> {
  const currentUser = await requireCurrentUser();
  const formId = formIdSchema.parse(formIdInput);
  const form = await requireManagedForm(formId, currentUser.id);
  if (form.archivedAt) throw new ConflictError("Archived forms cannot be published.");
  const draft = form.versions.find((version) => version.status === "DRAFT");
  if (!draft) throw new ConflictError("Save a draft before publishing.");
  const fieldCount =
    draft.fields.length +
    draft.sections.reduce((total, section) => total + section.fields.length, 0);
  if (fieldCount === 0) throw new ConflictError("Add at least one field.");

  await db.formVersion.update({
    where: { id: draft.id },
    data: { status: FormVersionStatus.PUBLISHED, publishedAt: new Date() },
  });
}

export async function archiveForm(formIdInput: string): Promise<void> {
  const currentUser = await requireCurrentUser();
  const formId = formIdSchema.parse(formIdInput);
  await requireManagedForm(formId, currentUser.id);
  await db.form.update({ where: { id: formId }, data: { archivedAt: new Date() } });
}

function normalizeValue(field: FormFieldDTO, value: unknown): unknown {
  const empty = value === null || value === undefined || value === "";
  if (empty) {
    if (field.isRequired) throw new ConflictError(`${field.label} is required.`);
    return null;
  }
  if (field.type === "TEXT" || field.type === "TEXTAREA") {
    if (typeof value !== "string") throw new ConflictError(`${field.label} must be text.`);
    const normalized = value.trim();
    if (field.isRequired && normalized === "") {
      throw new ConflictError(`${field.label} is required.`);
    }
    const maximum = field.type === "TEXT" ? 10_000 : 50_000;
    if (normalized.length > maximum) {
      throw new ConflictError(`${field.label} is too long.`);
    }
    return normalized;
  }
  if (field.type === "NUMBER") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new ConflictError(`${field.label} must be a number.`);
    }
    return value;
  }
  if (field.type === "DATE") {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new ConflictError(`${field.label} must be a valid date.`);
    }
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      throw new ConflictError(`${field.label} must be a valid date.`);
    }
    return value;
  }
  if (field.type === "SELECT") {
    if (typeof value !== "string" || !field.options.includes(value)) {
      throw new ConflictError(`${field.label} has an invalid option.`);
    }
    return value;
  }
  if (!Array.isArray(value)) throw new ConflictError(`${field.label} must be a list.`);
  const values = [...new Set(value.filter((row): row is string => typeof row === "string"))];
  if (values.some((row) => !field.options.includes(row))) {
    throw new ConflictError(`${field.label} has an invalid option.`);
  }
  if (field.isRequired && values.length === 0) {
    throw new ConflictError(`${field.label} is required.`);
  }
  return values;
}

function revisionDTO(submission: {
  id: string;
  revision: number;
  submittedAt: Date;
  submittedBy: { displayName: string };
  formVersion: Parameters<typeof versionDTO>[0];
  values: Array<{ formFieldId: string; value: unknown }>;
}): FormRevisionDTO {
  return {
    id: submission.id,
    revision: submission.revision,
    submittedAt: submission.submittedAt.toISOString(),
    submittedBy: submission.submittedBy.displayName,
    formVersion: versionDTO(submission.formVersion),
    values: Object.fromEntries(
      submission.values.map((value) => [value.formFieldId, value.value]),
    ),
  };
}

const workspaceSubmissionInclude = {
  submittedBy: { select: { displayName: true } },
  values: { select: { formFieldId: true, value: true } },
  formVersion: { include: versionInclude },
};

export async function loadChecklistFormWorkspace(
  checklistItemId: string,
): Promise<ChecklistFormWorkspaceDTO> {
  const currentUser = await requireCurrentUser();
  const item = await db.checklistItem.findFirst({
    where: { id: checklistItemId, picId: currentUser.id },
    select: {
      id: true,
      title: true,
      formVersion: { include: versionInclude },
      formSubmissions: {
        orderBy: { revision: "desc" },
        include: workspaceSubmissionInclude,
      },
    },
  });
  if (!item || (!item.formVersion && item.formSubmissions.length === 0)) {
    throw new NotFoundError("Checklist form");
  }
  return {
    checklistItemId: item.id,
    title: item.title,
    assignedVersion: item.formVersion ? versionDTO(item.formVersion) : null,
    revisions: item.formSubmissions.map(revisionDTO),
  };
}

export async function saveChecklistFormSubmission(
  input: SaveChecklistFormSubmissionInput,
): Promise<{ id: string }> {
  const currentUser = await requireCurrentUser();
  const data = saveChecklistFormSubmissionSchema.parse(input);

  return db.$transaction(async (tx) => {
    const item = await tx.checklistItem.findUnique({
      where: { id: data.checklistItemId },
      select: {
        id: true,
        picId: true,
        formVersionId: true,
        formVersion: { include: versionInclude },
      },
    });
    if (
      !item ||
      item.picId !== currentUser.id ||
      !item.formVersion ||
      item.formVersionId !== data.formVersionId
    ) {
      throw new NotFoundError("Checklist form");
    }
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "checklist_items" WHERE "id" = ${item.id}::uuid FOR UPDATE`,
    );
    if (item.formVersion.status !== FormVersionStatus.PUBLISHED) {
      throw new ConflictError("Only published forms can be submitted.");
    }

    const latest = await tx.checklistFormSubmission.aggregate({
      where: { checklistItemId: item.id },
      _max: { revision: true },
    });
    const latestRevision = latest._max.revision ?? 0;
    if (latestRevision !== data.expectedRevision) {
      throw new ConflictError("A newer form revision is available. Reload and try again.");
    }

    const fields = [
      ...item.formVersion.fields,
      ...item.formVersion.sections.flatMap((section) => section.fields),
    ].map((field) => ({
      ...fieldDTO(field),
      id: field.id,
    }));
    const incoming = new Map(data.values.map((row) => [row.fieldId, row.value]));
    if (
      incoming.size !== data.values.length ||
      [...incoming.keys()].some((id) => !fields.some((field) => field.id === id))
    ) {
      throw new ConflictError("The submitted form contains invalid fields.");
    }

    const submission = await tx.checklistFormSubmission.create({
      data: {
        checklistItemId: item.id,
        formVersionId: item.formVersion.id,
        revision: latestRevision + 1,
        submittedById: currentUser.id,
        values: {
          create: fields.map((field) => {
            const value = normalizeValue(field, incoming.get(field.id));
            return {
              formFieldId: field.id,
              value:
                value === null
                  ? Prisma.JsonNull
                  : (value as Prisma.InputJsonValue),
            };
          }),
        },
      },
      select: { id: true },
    });
    return submission;
  });
}
