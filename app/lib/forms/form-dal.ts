import "server-only";

import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/app/lib/dal/auth";
import { db } from "@/app/lib/db/client";
import type {
  BoardFormDTO,
  FormFieldDTO,
  FormVersionDTO,
  PublishedFormOptionDTO,
} from "./types";

const versionInclude = {
  sections: {
    orderBy: [{ position: "asc" as const }, { id: "asc" as const }],
    include: {
      fields: {
        orderBy: [{ position: "asc" as const }, { id: "asc" as const }],
      },
    },
  },
  fields: {
    where: { sectionId: null },
    orderBy: [{ position: "asc" as const }, { id: "asc" as const }],
  },
};

export function fieldDTO(field: {
  id: string;
  fieldKey: string;
  label: string;
  description: string | null;
  type: FormFieldDTO["type"];
  options: unknown;
  isRequired: boolean;
}): FormFieldDTO {
  return {
    id: field.id,
    fieldKey: field.fieldKey,
    label: field.label,
    description: field.description,
    type: field.type,
    options: Array.isArray(field.options)
      ? field.options.filter((value): value is string => typeof value === "string")
      : [],
    isRequired: field.isRequired,
  };
}

export function versionDTO(version: {
  id: string;
  version: number;
  status: "DRAFT" | "PUBLISHED";
  name: string;
  description: string | null;
  updatedAt: Date;
  fields: Parameters<typeof fieldDTO>[0][];
  sections: Array<{
    id: string;
    title: string;
    description: string | null;
    fields: Parameters<typeof fieldDTO>[0][];
  }>;
}): FormVersionDTO {
  return {
    id: version.id,
    version: version.version,
    status: version.status,
    name: version.name,
    description: version.description,
    updatedAt: version.updatedAt.toISOString(),
    ungroupedFields: version.fields.map(fieldDTO),
    sections: version.sections.map((section) => ({
      id: section.id,
      title: section.title,
      description: section.description,
      fields: section.fields.map(fieldDTO),
    })),
  };
}

export async function listBoardForms(routeKey: string): Promise<{
  board: { id: string; routeKey: string; name: string };
  forms: BoardFormDTO[];
}> {
  const currentUser = await requireCurrentUser();
  const board = await db.board.findFirst({
    where: { routeKey, createdById: currentUser.id },
    select: { id: true, routeKey: true, name: true },
  });
  if (!board) notFound();

  const forms = await db.form.findMany({
    where: { boardId: board.id },
    orderBy: [{ archivedAt: "asc" }, { name: "asc" }],
    include: {
      versions: {
        orderBy: { version: "desc" },
        include: versionInclude,
      },
    },
  });

  return {
    board,
    forms: forms.map((form) => ({
      id: form.id,
      name: form.name,
      archivedAt: form.archivedAt?.toISOString() ?? null,
      draft: form.versions.find((version) => version.status === "DRAFT")
        ? versionDTO(form.versions.find((version) => version.status === "DRAFT")!)
        : null,
      published: form.versions.find((version) => version.status === "PUBLISHED")
        ? versionDTO(
            form.versions.find((version) => version.status === "PUBLISHED")!,
          )
        : null,
    })),
  };
}

export async function listPublishedFormOptions(
  boardId: string,
): Promise<PublishedFormOptionDTO[]> {
  const forms = await db.form.findMany({
    where: { boardId, archivedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      versions: {
        where: { status: "PUBLISHED" },
        orderBy: { version: "desc" },
        take: 1,
        select: { id: true, version: true },
      },
    },
  });

  return forms.flatMap((form) =>
    form.versions.map((version) => ({
      formId: form.id,
      versionId: version.id,
      name: form.name,
      version: version.version,
    })),
  );
}

export { versionInclude };
