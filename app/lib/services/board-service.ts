import "server-only";

import { randomBytes } from "node:crypto";
import { requireCurrentUser } from "@/app/lib/dal/auth";
import { ConflictError, NotFoundError } from "@/app/lib/dal/errors";
import { db } from "@/app/lib/db/client";
import {
  createBoardSchema,
  createColumnSchema,
  createLabelSchema,
  deleteBoardSchema,
  entityIdSchema,
  moveColumnSchema,
  renameColumnSchema,
  type CreateBoardInput,
  type CreateColumnInput,
  type CreateLabelInput,
  type MoveColumnInput,
  type RenameColumnInput,
} from "@/app/lib/kanban/validation";

const DEFAULT_COLUMNS = ["To Do", "In Progress", "Review", "Done"] as const;

function createRouteKey(): string {
  return randomBytes(12).toString("base64url");
}

export async function createBoard(input: CreateBoardInput) {
  const currentUser = await requireCurrentUser();
  const data = createBoardSchema.parse(input);

  return db.$transaction(async (tx) => {
    const board = await tx.board.create({
      data: {
        routeKey: createRouteKey(),
        name: data.name,
        description: data.description,
        createdById: currentUser.id,
      },
      select: { id: true, routeKey: true, name: true },
    });

    await tx.boardColumn.createMany({
      data: DEFAULT_COLUMNS.map((name, position) => ({
        boardId: board.id,
        name,
        position,
      })),
    });

    return board;
  });
}

export async function deleteBoard(input: {
  boardId: string;
  confirmation: string;
}): Promise<void> {
  await requireCurrentUser();
  const data = deleteBoardSchema.parse(input);
  const board = await db.board.findUnique({
    where: { id: data.boardId },
    select: { id: true, name: true },
  });

  if (!board) {
    throw new NotFoundError("Board");
  }

  if (data.confirmation !== board.name) {
    throw new ConflictError("Enter the board name to confirm permanent deletion.");
  }

  await db.board.delete({ where: { id: board.id } });
}

export async function createColumn(input: CreateColumnInput) {
  await requireCurrentUser();
  const data = createColumnSchema.parse(input);

  return db.$transaction(async (tx) => {
    const board = await tx.board.findUnique({
      where: { id: data.boardId },
      select: { id: true },
    });

    if (!board) {
      throw new NotFoundError("Board");
    }

    const aggregate = await tx.boardColumn.aggregate({
      where: { boardId: data.boardId },
      _max: { position: true },
    });

    return tx.boardColumn.create({
      data: {
        boardId: data.boardId,
        name: data.name,
        position: (aggregate._max.position ?? -1) + 1,
      },
      select: { id: true, name: true, position: true },
    });
  });
}

export async function renameColumn(input: RenameColumnInput) {
  await requireCurrentUser();
  const data = renameColumnSchema.parse(input);

  try {
    return await db.boardColumn.update({
      where: { id: data.columnId },
      data: { name: data.name },
      select: { id: true, name: true },
    });
  } catch {
    throw new NotFoundError("Column");
  }
}

export async function moveColumn(input: MoveColumnInput): Promise<void> {
  await requireCurrentUser();
  const data = moveColumnSchema.parse(input);

  await db.$transaction(async (tx) => {
    const column = await tx.boardColumn.findUnique({
      where: { id: data.columnId },
      select: { id: true, boardId: true },
    });

    if (!column) {
      throw new NotFoundError("Column");
    }

    const columns = await tx.boardColumn.findMany({
      where: { boardId: column.boardId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    const orderedIds = columns
      .map(({ id }) => id)
      .filter((id) => id !== column.id);
    orderedIds.splice(Math.min(data.targetIndex, orderedIds.length), 0, column.id);

    await Promise.all(
      orderedIds.map((id, position) =>
        tx.boardColumn.update({ where: { id }, data: { position } }),
      ),
    );
  });
}

export async function deleteEmptyColumn(columnIdInput: string): Promise<void> {
  await requireCurrentUser();
  const columnId = entityIdSchema.parse(columnIdInput);

  await db.$transaction(async (tx) => {
    const column = await tx.boardColumn.findUnique({
      where: { id: columnId },
      select: { id: true, boardId: true, _count: { select: { cards: true } } },
    });

    if (!column) {
      throw new NotFoundError("Column");
    }

    if (column._count.cards > 0) {
      throw new ConflictError("Move or delete every card before deleting this column.");
    }

    await tx.boardColumn.delete({ where: { id: column.id } });
    const remaining = await tx.boardColumn.findMany({
      where: { boardId: column.boardId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    await Promise.all(
      remaining.map(({ id }, position) =>
        tx.boardColumn.update({ where: { id }, data: { position } }),
      ),
    );
  });
}

export async function createLabel(input: CreateLabelInput) {
  await requireCurrentUser();
  const data = createLabelSchema.parse(input);
  const board = await db.board.findUnique({
    where: { id: data.boardId },
    select: { id: true },
  });

  if (!board) {
    throw new NotFoundError("Board");
  }

  return db.label.create({
    data,
    select: { id: true, name: true, color: true },
  });
}
