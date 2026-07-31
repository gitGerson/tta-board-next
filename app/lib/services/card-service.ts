import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { requireCurrentUser } from "@/app/lib/dal/auth";
import { ConflictError, NotFoundError } from "@/app/lib/dal/errors";
import { db } from "@/app/lib/db/client";
import {
  createCardSchema,
  entityIdSchema,
  moveCardSchema,
  updateCardSchema,
  updateCardDescriptionSchema,
  type CreateCardInput,
  type MoveCardInput,
  type UpdateCardInput,
  type UpdateCardDescriptionInput,
} from "@/app/lib/kanban/validation";
import { assertActiveUsers } from "./user-validation";

async function validateRelations(
  tx: Prisma.TransactionClient,
  boardId: string,
  assigneeId: string | null | undefined,
  labelIds: string[] | undefined,
): Promise<void> {
  await assertActiveUsers(tx, assigneeId ? [assigneeId] : []);

  if (labelIds) {
    const distinctIds = [...new Set(labelIds)];
    const labelCount = await tx.label.count({
      where: { id: { in: distinctIds }, boardId },
    });
    if (labelCount !== distinctIds.length) {
      throw new ConflictError("Every label must belong to the card's board.");
    }
  }
}

export async function createCard(input: CreateCardInput) {
  const currentUser = await requireCurrentUser();
  const data = createCardSchema.parse(input);
  const labelIds = [...new Set(data.labelIds)];

  return db.$transaction(async (tx) => {
    const column = await tx.boardColumn.findUnique({
      where: { id: data.columnId },
      select: { id: true, boardId: true },
    });
    if (!column) {
      throw new NotFoundError("Column");
    }

    await validateRelations(tx, column.boardId, data.assigneeId, labelIds);
    const aggregate = await tx.card.aggregate({
      where: { columnId: column.id },
      _max: { position: true },
    });

    return tx.card.create({
      data: {
        columnId: column.id,
        title: data.title,
        description: data.description,
        startAt: data.startAt,
        dueAt: data.dueAt,
        assigneeId: data.assigneeId,
        createdById: currentUser.id,
        position: (aggregate._max.position ?? -1) + 1,
        labels: {
          create: labelIds.map((labelId) => ({
            label: { connect: { id: labelId } },
          })),
        },
      },
      select: { id: true, title: true, position: true },
    });
  });
}

export async function updateCard(input: UpdateCardInput): Promise<void> {
  await requireCurrentUser();
  const data = updateCardSchema.parse(input);
  const labelIds = data.labelIds
    ? [...new Set(data.labelIds)]
    : undefined;

  await db.$transaction(async (tx) => {
    const card = await tx.card.findUnique({
      where: { id: data.cardId },
      select: { id: true, column: { select: { boardId: true } } },
    });
    if (!card) {
      throw new NotFoundError("Card");
    }

    await validateRelations(
      tx,
      card.column.boardId,
      data.assigneeId,
      labelIds,
    );

    await tx.card.update({
      where: { id: card.id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.startAt !== undefined ? { startAt: data.startAt } : {}),
        ...(data.dueAt !== undefined ? { dueAt: data.dueAt } : {}),
        ...(data.assigneeId !== undefined
          ? { assigneeId: data.assigneeId }
          : {}),
        ...(labelIds !== undefined
          ? {
              labels: {
                deleteMany: {},
                create: labelIds.map((labelId) => ({
                  label: { connect: { id: labelId } },
                })),
              },
            }
          : {}),
      },
    });
  });
}

export async function updateCardDescription(
  input: UpdateCardDescriptionInput,
): Promise<void> {
  await requireCurrentUser();
  const data = updateCardDescriptionSchema.parse(input);
  const card = await db.card.findUnique({
    where: { id: data.cardId },
    select: { id: true },
  });

  if (!card) {
    throw new NotFoundError("Card");
  }

  await db.card.update({
    where: { id: card.id },
    data: { description: data.document },
  });
}

export async function moveCard(input: MoveCardInput): Promise<void> {
  await requireCurrentUser();
  const data = moveCardSchema.parse(input);

  await db.$transaction(async (tx) => {
    const card = await tx.card.findUnique({
      where: { id: data.cardId },
      select: {
        id: true,
        columnId: true,
        column: { select: { boardId: true } },
      },
    });
    const targetColumn = await tx.boardColumn.findUnique({
      where: { id: data.targetColumnId },
      select: { id: true, boardId: true },
    });

    if (!card || !targetColumn) {
      throw new NotFoundError(!card ? "Card" : "Target column");
    }
    if (card.column.boardId !== targetColumn.boardId) {
      throw new ConflictError("Cards cannot move between different boards.");
    }

    const sourceCards = await tx.card.findMany({
      where: { columnId: card.columnId, id: { not: card.id } },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });

    if (card.columnId === targetColumn.id) {
      const orderedIds = sourceCards.map(({ id }) => id);
      orderedIds.splice(Math.min(data.targetIndex, orderedIds.length), 0, card.id);
      await Promise.all(
        orderedIds.map((id, position) =>
          tx.card.update({ where: { id }, data: { position } }),
        ),
      );
      return;
    }

    const targetCards = await tx.card.findMany({
      where: { columnId: targetColumn.id },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    const targetIds = targetCards.map(({ id }) => id);
    targetIds.splice(Math.min(data.targetIndex, targetIds.length), 0, card.id);

    await tx.card.update({
      where: { id: card.id },
      data: { columnId: targetColumn.id },
    });
    await Promise.all([
      ...sourceCards.map(({ id }, position) =>
        tx.card.update({ where: { id }, data: { position } }),
      ),
      ...targetIds.map((id, position) =>
        tx.card.update({ where: { id }, data: { position } }),
      ),
    ]);
  });
}

export async function deleteCard(cardIdInput: string): Promise<void> {
  await requireCurrentUser();
  const cardId = entityIdSchema.parse(cardIdInput);

  await db.$transaction(async (tx) => {
    const card = await tx.card.findUnique({
      where: { id: cardId },
      select: { id: true, columnId: true },
    });
    if (!card) {
      throw new NotFoundError("Card");
    }

    await tx.card.delete({ where: { id: card.id } });
    const remaining = await tx.card.findMany({
      where: { columnId: card.columnId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    await Promise.all(
      remaining.map(({ id }, position) =>
        tx.card.update({ where: { id }, data: { position } }),
      ),
    );
  });
}
