import "server-only";

import { requireCurrentUser } from "@/app/lib/dal/auth";
import { NotFoundError } from "@/app/lib/dal/errors";
import { db } from "@/app/lib/db/client";
import { entityIdSchema } from "@/app/lib/kanban/validation";

export type BoardSummaryDTO = {
  id: string;
  name: string;
  description: string | null;
  columnCount: number;
  cardCount: number;
  updatedAt: string;
};

export type LabelDTO = {
  id: string;
  name: string;
  color: string;
};

export type UserOptionDTO = {
  id: string;
  name: string;
};

export type CardSummaryDTO = {
  id: string;
  title: string;
  description: string | null;
  position: number;
  dueAt: string | null;
  assignee: UserOptionDTO | null;
  labels: LabelDTO[];
  commentCount: number;
};

export type BoardColumnDTO = {
  id: string;
  name: string;
  position: number;
  cards: CardSummaryDTO[];
};

export type BoardDTO = {
  id: string;
  name: string;
  description: string | null;
  updatedAt: string;
  labels: LabelDTO[];
  columns: BoardColumnDTO[];
};

export type CommentDTO = {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string;
    username: string;
  };
};

export type CardDetailsDTO = CardSummaryDTO & {
  columnId: string;
  comments: CommentDTO[];
};

export async function listBoards(): Promise<BoardSummaryDTO[]> {
  await requireCurrentUser();

  const boards = await db.board.findMany({
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      updatedAt: true,
      _count: { select: { columns: true } },
      columns: { select: { _count: { select: { cards: true } } } },
    },
  });

  return boards.map((board) => ({
    id: board.id,
    name: board.name,
    description: board.description,
    columnCount: board._count.columns,
    cardCount: board.columns.reduce(
      (total, column) => total + column._count.cards,
      0,
    ),
    updatedAt: board.updatedAt.toISOString(),
  }));
}

export async function getBoard(boardIdInput: string): Promise<BoardDTO> {
  await requireCurrentUser();
  const boardId = entityIdSchema.parse(boardIdInput);
  const board = await db.board.findUnique({
    where: { id: boardId },
    select: {
      id: true,
      name: true,
      description: true,
      updatedAt: true,
      labels: {
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: { id: true, name: true, color: true },
      },
      columns: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          position: true,
          cards: {
            orderBy: [{ position: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              title: true,
              description: true,
              position: true,
              dueAt: true,
              assignee: {
                select: { id: true, displayName: true },
              },
              labels: {
                select: {
                  label: { select: { id: true, name: true, color: true } },
                },
              },
              _count: { select: { comments: true } },
            },
          },
        },
      },
    },
  });

  if (!board) {
    throw new NotFoundError("Board");
  }

  return {
    id: board.id,
    name: board.name,
    description: board.description,
    updatedAt: board.updatedAt.toISOString(),
    labels: board.labels,
    columns: board.columns.map((column) => ({
      id: column.id,
      name: column.name,
      position: column.position,
      cards: column.cards.map((card) => ({
        id: card.id,
        title: card.title,
        description: card.description,
        position: card.position,
        dueAt: card.dueAt?.toISOString() ?? null,
        assignee: card.assignee
          ? { id: card.assignee.id, name: card.assignee.displayName }
          : null,
        labels: card.labels.map(({ label }) => label),
        commentCount: card._count.comments,
      })),
    })),
  };
}

export async function getCardDetails(
  boardIdInput: string,
  cardIdInput: string,
): Promise<CardDetailsDTO | null> {
  await requireCurrentUser();
  const boardIdResult = entityIdSchema.safeParse(boardIdInput);
  const cardIdResult = entityIdSchema.safeParse(cardIdInput);

  if (!boardIdResult.success || !cardIdResult.success) {
    return null;
  }

  const card = await db.card.findFirst({
    where: {
      id: cardIdResult.data,
      column: { boardId: boardIdResult.data },
    },
    select: {
      id: true,
      columnId: true,
      title: true,
      description: true,
      position: true,
      dueAt: true,
      assignee: {
        select: { id: true, displayName: true },
      },
      labels: {
        select: {
          label: { select: { id: true, name: true, color: true } },
        },
      },
      comments: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          body: true,
          createdAt: true,
          updatedAt: true,
          author: {
            select: { id: true, displayName: true, username: true },
          },
        },
      },
      _count: { select: { comments: true } },
    },
  });

  if (!card) {
    return null;
  }

  return {
    id: card.id,
    columnId: card.columnId,
    title: card.title,
    description: card.description,
    position: card.position,
    dueAt: card.dueAt?.toISOString() ?? null,
    assignee: card.assignee
      ? { id: card.assignee.id, name: card.assignee.displayName }
      : null,
    labels: card.labels.map(({ label }) => label),
    commentCount: card._count.comments,
    comments: card.comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      author: {
        id: comment.author.id,
        name: comment.author.displayName,
        username: comment.author.username,
      },
    })),
  };
}
