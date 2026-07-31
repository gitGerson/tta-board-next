import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { requireCurrentUser } from "@/app/lib/dal/auth";
import { ConflictError, NotFoundError } from "@/app/lib/dal/errors";
import { db } from "@/app/lib/db/client";
import {
  createChecklistGroupSchema,
  createChecklistItemSchema,
  entityIdSchema,
  moveChecklistGroupSchema,
  moveChecklistItemSchema,
  setChecklistItemDoneSchema,
  updateChecklistGroupSchema,
  updateChecklistItemSchema,
  type CreateChecklistGroupInput,
  type CreateChecklistItemInput,
  type MoveChecklistGroupInput,
  type MoveChecklistItemInput,
  type SetChecklistItemDoneInput,
  type UpdateChecklistGroupInput,
  type UpdateChecklistItemInput,
} from "@/app/lib/kanban/validation";
import { assertActiveUsers } from "./user-validation";
import { assertCardAccess, assertCardUsersAreMembers } from "./card-access";
import { serializeRichTextDocument } from "@/app/lib/rich-text/content";

const BY_POSITION = [
  { position: "asc" as const },
  { createdAt: "asc" as const },
];

/**
 * Rewrites every sibling's position from its current order. The same approach
 * the card and column services use: cheap at these list sizes, and it leaves no
 * room for gaps or duplicate positions to accumulate.
 */
async function renumberGroups(
  tx: Prisma.TransactionClient,
  cardId: string,
): Promise<void> {
  const groups = await tx.checklistGroup.findMany({
    where: { cardId },
    orderBy: BY_POSITION,
    select: { id: true },
  });

  await Promise.all(
    groups.map(({ id }, position) =>
      tx.checklistGroup.update({ where: { id }, data: { position } }),
    ),
  );
}

async function renumberItems(
  tx: Prisma.TransactionClient,
  groupId: string,
): Promise<void> {
  const items = await tx.checklistItem.findMany({
    where: { groupId },
    orderBy: BY_POSITION,
    select: { id: true },
  });

  await Promise.all(
    items.map(({ id }, position) =>
      tx.checklistItem.update({ where: { id }, data: { position } }),
    ),
  );
}

async function nextPosition(
  aggregate: Promise<{ _max: { position: number | null } }>,
): Promise<number> {
  return ((await aggregate)._max.position ?? -1) + 1;
}

export async function createChecklistGroup(input: CreateChecklistGroupInput) {
  const currentUser = await requireCurrentUser();
  const data = createChecklistGroupSchema.parse(input);

  return db.$transaction(async (tx) => {
    const card = await tx.card.findUnique({
      where: { id: data.cardId },
      select: { id: true },
    });
    if (!card) {
      throw new NotFoundError("Card");
    }
    await assertCardAccess(tx, card.id, currentUser.id);

    await assertActiveUsers(tx, data.picId ? [data.picId] : []);
    await assertCardUsersAreMembers(
      tx,
      card.id,
      data.picId ? [data.picId] : [],
    );

    return tx.checklistGroup.create({
      data: {
        cardId: card.id,
        name: data.name,
        description: data.descriptionDocument
          ? serializeRichTextDocument(data.descriptionDocument)
          : null,
        picId: data.picId,
        startAt: data.startAt,
        dueAt: data.dueAt,
        position: await nextPosition(
          tx.checklistGroup.aggregate({
            where: { cardId: card.id },
            _max: { position: true },
          }),
        ),
      },
      select: { id: true },
    });
  });
}

export async function updateChecklistGroup(
  input: UpdateChecklistGroupInput,
): Promise<void> {
  const currentUser = await requireCurrentUser();
  const data = updateChecklistGroupSchema.parse(input);

  await db.$transaction(async (tx) => {
    const group = await tx.checklistGroup.findUnique({
      where: { id: data.groupId },
      select: { id: true, cardId: true },
    });
    if (!group) {
      throw new NotFoundError("Checklist group");
    }
    await assertCardAccess(tx, group.cardId, currentUser.id);

    await assertActiveUsers(tx, data.picId ? [data.picId] : []);
    await assertCardUsersAreMembers(
      tx,
      group.cardId,
      data.picId ? [data.picId] : [],
    );

    await tx.checklistGroup.update({
      where: { id: group.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.descriptionDocument !== undefined
          ? {
              description: data.descriptionDocument
                ? serializeRichTextDocument(data.descriptionDocument)
                : null,
            }
          : {}),
        ...(data.picId !== undefined ? { picId: data.picId } : {}),
        ...(data.startAt !== undefined ? { startAt: data.startAt } : {}),
        ...(data.dueAt !== undefined ? { dueAt: data.dueAt } : {}),
      },
    });
  });
}

export async function moveChecklistGroup(
  input: MoveChecklistGroupInput,
): Promise<void> {
  const currentUser = await requireCurrentUser();
  const data = moveChecklistGroupSchema.parse(input);

  await db.$transaction(async (tx) => {
    const group = await tx.checklistGroup.findUnique({
      where: { id: data.groupId },
      select: { id: true, cardId: true },
    });
    if (!group) {
      throw new NotFoundError("Checklist group");
    }
    await assertCardAccess(tx, group.cardId, currentUser.id);

    const siblings = await tx.checklistGroup.findMany({
      where: { cardId: group.cardId, id: { not: group.id } },
      orderBy: BY_POSITION,
      select: { id: true },
    });
    const orderedIds = siblings.map(({ id }) => id);
    orderedIds.splice(
      Math.min(data.targetIndex, orderedIds.length),
      0,
      group.id,
    );

    await Promise.all(
      orderedIds.map((id, position) =>
        tx.checklistGroup.update({ where: { id }, data: { position } }),
      ),
    );
  });
}

export async function deleteChecklistGroup(
  groupIdInput: string,
): Promise<void> {
  const currentUser = await requireCurrentUser();
  const groupId = entityIdSchema.parse(groupIdInput);

  await db.$transaction(async (tx) => {
    const group = await tx.checklistGroup.findUnique({
      where: { id: groupId },
      select: { id: true, cardId: true },
    });
    if (!group) {
      throw new NotFoundError("Checklist group");
    }
    await assertCardAccess(tx, group.cardId, currentUser.id);

    await tx.checklistGroup.delete({ where: { id: group.id } });
    await renumberGroups(tx, group.cardId);
  });
}

export async function createChecklistItem(input: CreateChecklistItemInput) {
  const currentUser = await requireCurrentUser();
  const data = createChecklistItemSchema.parse(input);

  return db.$transaction(async (tx) => {
    const group = await tx.checklistGroup.findUnique({
      where: { id: data.groupId },
      select: {
        id: true,
        cardId: true,
        card: { select: { column: { select: { boardId: true } } } },
      },
    });
    if (!group) {
      throw new NotFoundError("Checklist group");
    }
    await assertCardAccess(tx, group.cardId, currentUser.id);

    await assertActiveUsers(tx, data.picId ? [data.picId] : []);
    await assertCardUsersAreMembers(
      tx,
      group.cardId,
      data.picId ? [data.picId] : [],
    );
    if (data.formVersionId) {
      const version = await tx.formVersion.findFirst({
        where: {
          id: data.formVersionId,
          status: "PUBLISHED",
          form: {
            boardId: group.card.column.boardId,
            archivedAt: null,
          },
        },
        select: { id: true },
      });
      if (!version) throw new ConflictError("Select an active published form.");
    }

    return tx.checklistItem.create({
      data: {
        groupId: group.id,
        title: data.title,
        description: data.description,
        dueAt: data.dueAt,
        picId: data.picId,
        formVersionId: data.formVersionId,
        position: await nextPosition(
          tx.checklistItem.aggregate({
            where: { groupId: group.id },
            _max: { position: true },
          }),
        ),
        assignees: {
          create: data.picId
            ? [{ user: { connect: { id: data.picId } } }]
            : [],
        },
      },
      select: { id: true },
    });
  });
}

export async function updateChecklistItem(
  input: UpdateChecklistItemInput,
): Promise<void> {
  const currentUser = await requireCurrentUser();
  const data = updateChecklistItemSchema.parse(input);

  await db.$transaction(async (tx) => {
    const item = await tx.checklistItem.findUnique({
      where: { id: data.itemId },
      select: {
        id: true,
        formVersionId: true,
        group: {
          select: {
            cardId: true,
            card: { select: { column: { select: { boardId: true } } } },
          },
        },
      },
    });
    if (!item) {
      throw new NotFoundError("Checklist item");
    }
    await assertCardAccess(tx, item.group.cardId, currentUser.id);

    if (data.picId !== undefined) {
      await assertActiveUsers(tx, data.picId ? [data.picId] : []);
      await assertCardUsersAreMembers(
        tx,
        item.group.cardId,
        data.picId ? [data.picId] : [],
      );
    }
    if (data.formVersionId) {
      const version = await tx.formVersion.findFirst({
        where: {
          id: data.formVersionId,
          status: "PUBLISHED",
          form: {
            boardId: item.group.card.column.boardId,
            archivedAt: null,
          },
        },
        select: { id: true },
      });
      if (!version) throw new ConflictError("Select an active published form.");
    }
    if (
      data.formVersionId !== undefined &&
      data.formVersionId !== item.formVersionId &&
      !data.confirmFormChange
    ) {
      const revisions = await tx.checklistFormSubmission.count({
        where: { checklistItemId: item.id },
      });
      if (revisions > 0) {
        throw new ConflictError(
          "Confirm the form change. Existing revisions will be preserved.",
        );
      }
    }

    await tx.checklistItem.update({
      where: { id: item.id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.dueAt !== undefined ? { dueAt: data.dueAt } : {}),
        ...(data.formVersionId !== undefined
          ? { formVersionId: data.formVersionId }
          : {}),
        ...(data.picId !== undefined
          ? {
              picId: data.picId,
              assignees: {
                deleteMany: {},
                create: data.picId
                  ? [{ user: { connect: { id: data.picId } } }]
                  : [],
              },
            }
          : {}),
      },
    });
  });
}

export async function moveChecklistItem(
  input: MoveChecklistItemInput,
): Promise<void> {
  const currentUser = await requireCurrentUser();
  const data = moveChecklistItemSchema.parse(input);

  await db.$transaction(async (tx) => {
    const item = await tx.checklistItem.findUnique({
      where: { id: data.itemId },
      select: { id: true, groupId: true, group: { select: { cardId: true } } },
    });
    const targetGroup = await tx.checklistGroup.findUnique({
      where: { id: data.targetGroupId },
      select: { id: true, cardId: true },
    });

    if (!item || !targetGroup) {
      throw new NotFoundError(!item ? "Checklist item" : "Target group");
    }
    await assertCardAccess(tx, item.group.cardId, currentUser.id);
    if (item.group.cardId !== targetGroup.cardId) {
      throw new ConflictError(
        "Checklist items cannot move between different cards.",
      );
    }

    const sourceItems = await tx.checklistItem.findMany({
      where: { groupId: item.groupId, id: { not: item.id } },
      orderBy: BY_POSITION,
      select: { id: true },
    });

    if (item.groupId === targetGroup.id) {
      const orderedIds = sourceItems.map(({ id }) => id);
      orderedIds.splice(
        Math.min(data.targetIndex, orderedIds.length),
        0,
        item.id,
      );
      await Promise.all(
        orderedIds.map((id, position) =>
          tx.checklistItem.update({ where: { id }, data: { position } }),
        ),
      );
      return;
    }

    const targetItems = await tx.checklistItem.findMany({
      where: { groupId: targetGroup.id },
      orderBy: BY_POSITION,
      select: { id: true },
    });
    const targetIds = targetItems.map(({ id }) => id);
    targetIds.splice(Math.min(data.targetIndex, targetIds.length), 0, item.id);

    await tx.checklistItem.update({
      where: { id: item.id },
      data: { groupId: targetGroup.id },
    });
    await Promise.all([
      ...sourceItems.map(({ id }, position) =>
        tx.checklistItem.update({ where: { id }, data: { position } }),
      ),
      ...targetIds.map((id, position) =>
        tx.checklistItem.update({ where: { id }, data: { position } }),
      ),
    ]);
  });
}

export async function setChecklistItemDone(
  input: SetChecklistItemDoneInput,
): Promise<void> {
  const currentUser = await requireCurrentUser();
  const data = setChecklistItemDoneSchema.parse(input);

  const item = await db.checklistItem.findFirst({
    where: {
      id: data.itemId,
      group: {
        card: {
          OR: [
            { assigneeId: currentUser.id },
            { members: { some: { userId: currentUser.id } } },
          ],
        },
      },
    },
    select: { id: true },
  });
  if (!item) {
    throw new NotFoundError("Checklist item");
  }

  // completedAt and completedById always move together, so a finished item can
  // never be missing the person who finished it.
  await db.checklistItem.update({
    where: { id: item.id },
    data: data.isDone
      ? {
          isDone: true,
          completedAt: new Date(),
          completedById: currentUser.id,
        }
      : { isDone: false, completedAt: null, completedById: null },
  });
}

export async function deleteChecklistItem(itemIdInput: string): Promise<void> {
  const currentUser = await requireCurrentUser();
  const itemId = entityIdSchema.parse(itemIdInput);

  await db.$transaction(async (tx) => {
    const item = await tx.checklistItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        groupId: true,
        group: { select: { cardId: true } },
      },
    });
    if (!item) {
      throw new NotFoundError("Checklist item");
    }
    await assertCardAccess(tx, item.group.cardId, currentUser.id);

    await tx.checklistItem.delete({ where: { id: item.id } });
    await renumberItems(tx, item.groupId);
  });
}
