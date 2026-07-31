import "server-only";

import { cache } from "react";
import {
  deserializeCommentDocument,
  type CommentDocument,
} from "@/app/lib/comments/content";
import { requireCurrentUser } from "@/app/lib/dal/auth";
import { NotFoundError } from "@/app/lib/dal/errors";
import { db } from "@/app/lib/db/client";
import { isBoardKey } from "@/app/lib/kanban/board-route";
import { entityIdSchema } from "@/app/lib/kanban/validation";
import {
  deserializeRichTextDocument,
  richTextPlainText,
  type RichTextDocument,
} from "@/app/lib/rich-text/content";

export type BoardSummaryDTO = {
  id: string;
  routeKey: string;
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
  startAt: string | null;
  dueAt: string | null;
  assignee: UserOptionDTO | null;
  canOpen: boolean;
  labels: LabelDTO[];
  commentCount: number;
  /** Checklist items across every group on the card, for the progress bar. */
  doneItems: number;
  totalItems: number;
};

export type ChecklistItemDTO = {
  id: string;
  title: string;
  description: string | null;
  position: number;
  dueAt: string | null;
  isDone: boolean;
  completedAt: string | null;
  revisionCount: number;
  pic: UserOptionDTO | null;
  form: {
    formId: string;
    versionId: string;
    name: string;
    version: number;
    revisionCount: number;
  } | null;
};

export type ChecklistGroupDTO = {
  id: string;
  name: string;
  description: string | null;
  descriptionDocument: RichTextDocument | null;
  position: number;
  startAt: string | null;
  dueAt: string | null;
  pic: UserOptionDTO | null;
  items: ChecklistItemDTO[];
};

export type BoardColumnDTO = {
  id: string;
  name: string;
  position: number;
  cards: CardSummaryDTO[];
};

export type BoardDTO = {
  id: string;
  routeKey: string;
  name: string;
  description: string | null;
  updatedAt: string;
  canManageForms: boolean;
  labels: LabelDTO[];
  columns: BoardColumnDTO[];
};

export type CommentDTO = {
  id: string;
  content: CommentDocument;
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
  descriptionDocument: RichTextDocument | null;
  comments: CommentDTO[];
  checklistGroups: ChecklistGroupDTO[];
  members: UserOptionDTO[];
};

function cardDescriptionDocument(value: string | null): RichTextDocument | null {
  return value ? deserializeRichTextDocument(value) : null;
}

function cardDescriptionText(value: string | null): string | null {
  const document = cardDescriptionDocument(value);
  return document ? richTextPlainText(document).trim() || null : null;
}

export async function getCardRoute(
  cardIdInput: string,
): Promise<{ id: string; boardRouteKey: string } | null> {
  const currentUser = await requireCurrentUser();
  const cardIdResult = entityIdSchema.safeParse(cardIdInput);

  if (!cardIdResult.success) return null;

  const card = await db.card.findFirst({
    where: {
      id: cardIdResult.data,
      OR: [
        { assigneeId: currentUser.id },
        { members: { some: { userId: currentUser.id } } },
      ],
    },
    select: {
      id: true,
      column: {
        select: {
          board: { select: { routeKey: true } },
        },
      },
    },
  });

  return card
    ? { id: card.id, boardRouteKey: card.column.board.routeKey }
    : null;
}

/** Cached because the dashboard layout and its pages both need the list. */
export const listBoards = cache(async (): Promise<BoardSummaryDTO[]> => {
  await requireCurrentUser();

  const boards = await db.board.findMany({
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    select: {
      id: true,
      routeKey: true,
      name: true,
      description: true,
      updatedAt: true,
      _count: { select: { columns: true } },
      columns: { select: { _count: { select: { cards: true } } } },
    },
  });

  return boards.map((board) => ({
    id: board.id,
    routeKey: board.routeKey,
    name: board.name,
    description: board.description,
    columnCount: board._count.columns,
    cardCount: board.columns.reduce(
      (total, column) => total + column._count.cards,
      0,
    ),
    updatedAt: board.updatedAt.toISOString(),
  }));
});

export type ProgressTally = { done: number; total: number };

const NO_PROGRESS: ProgressTally = { done: 0, total: 0 };

/**
 * Rolls per-group item counts up to their cards. Split out from the queries so
 * the arithmetic can be tested without a database.
 */
export function foldChecklistProgress(
  groups: readonly { id: string; cardId: string }[],
  tallies: readonly {
    groupId: string;
    isDone: boolean;
    _count: { _all: number };
  }[],
): Map<string, ProgressTally> {
  const cardIdByGroup = new Map(groups.map(({ id, cardId }) => [id, cardId]));
  const progress = new Map<string, ProgressTally>();

  // A card whose groups are all empty still reports 0/0 rather than going missing.
  for (const { cardId } of groups) {
    if (!progress.has(cardId)) {
      progress.set(cardId, { done: 0, total: 0 });
    }
  }

  for (const tally of tallies) {
    const cardId = cardIdByGroup.get(tally.groupId);
    if (!cardId) continue;

    const current = progress.get(cardId) ?? { done: 0, total: 0 };
    current.total += tally._count._all;
    if (tally.isDone) {
      current.done += tally._count._all;
    }
    progress.set(cardId, current);
  }

  return progress;
}

/**
 * Checklist totals for every card on a board in two flat queries, rather than
 * eager-loading each card's groups and items. Nesting them would multiply the
 * board payload by the number of checklist items on it, and a caller that
 * forgot the include would silently render every card as 0%.
 */
async function checklistProgressByCard(
  boardId: string,
): Promise<Map<string, ProgressTally>> {
  const [groups, tallies] = await Promise.all([
    db.checklistGroup.findMany({
      where: { card: { column: { boardId } } },
      select: { id: true, cardId: true },
    }),
    db.checklistItem.groupBy({
      by: ["groupId", "isDone"],
      where: { group: { card: { column: { boardId } } } },
      _count: { _all: true },
    }),
  ]);

  return foldChecklistProgress(groups, tallies);
}

export async function getBoard(boardIdInput: string): Promise<BoardDTO> {
  const currentUser = await requireCurrentUser();
  const boardId = entityIdSchema.parse(boardIdInput);

  return loadBoard({ id: boardId }, currentUser.id);
}

export async function getBoardByRouteKey(
  routeKey: string,
): Promise<BoardDTO> {
  const currentUser = await requireCurrentUser();

  if (!isBoardKey(routeKey)) {
    throw new NotFoundError("Board");
  }

  return loadBoard({ routeKey }, currentUser.id);
}

async function loadBoard(
  where: { id: string } | { routeKey: string },
  currentUserId: string,
): Promise<BoardDTO> {
  const board = await db.board.findUnique({
    where,
    select: {
      id: true,
      routeKey: true,
      name: true,
      description: true,
      createdById: true,
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
              startAt: true,
              dueAt: true,
              assigneeId: true,
              assignee: {
                select: { id: true, displayName: true },
              },
              members: {
                where: { userId: currentUserId },
                select: { userId: true },
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

  const progress = await checklistProgressByCard(board.id);

  return {
    id: board.id,
    routeKey: board.routeKey,
    name: board.name,
    description: board.description,
    updatedAt: board.updatedAt.toISOString(),
    canManageForms: board.createdById === currentUserId,
    labels: board.labels,
    columns: board.columns.map((column) => ({
      id: column.id,
      name: column.name,
      position: column.position,
      cards: column.cards.map((card) => {
        const tally = progress.get(card.id) ?? NO_PROGRESS;

        return {
          id: card.id,
          title: card.title,
          description: cardDescriptionText(card.description),
          position: card.position,
          startAt: card.startAt?.toISOString() ?? null,
          dueAt: card.dueAt?.toISOString() ?? null,
          assignee: card.assignee
            ? { id: card.assignee.id, name: card.assignee.displayName }
            : null,
          canOpen:
            card.assigneeId === currentUserId || card.members.length > 0,
          labels: card.labels.map(({ label }) => label),
          commentCount: card._count.comments,
          doneItems: tally.done,
          totalItems: tally.total,
        };
      }),
    })),
  };
}

export async function getCardDetails(
  boardIdInput: string,
  cardIdInput: string,
): Promise<CardDetailsDTO | null> {
  const currentUser = await requireCurrentUser();
  const boardIdResult = entityIdSchema.safeParse(boardIdInput);
  const cardIdResult = entityIdSchema.safeParse(cardIdInput);

  if (!boardIdResult.success || !cardIdResult.success) {
    return null;
  }

  const card = await db.card.findFirst({
    where: {
      id: cardIdResult.data,
      column: { boardId: boardIdResult.data },
      OR: [
        { assigneeId: currentUser.id },
        { members: { some: { userId: currentUser.id } } },
      ],
    },
    select: {
      id: true,
      columnId: true,
      title: true,
      description: true,
      position: true,
      startAt: true,
      dueAt: true,
      assignee: {
        select: { id: true, displayName: true },
      },
      members: {
        orderBy: [
          { user: { displayName: "asc" } },
          { userId: "asc" },
        ],
        select: {
          user: { select: { id: true, displayName: true } },
        },
      },
      labels: {
        select: {
          label: { select: { id: true, name: true, color: true } },
        },
      },
      checklistGroups: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          description: true,
          position: true,
          startAt: true,
          dueAt: true,
          pic: { select: { id: true, displayName: true } },
          items: {
            orderBy: [{ position: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              title: true,
              description: true,
              position: true,
              dueAt: true,
              isDone: true,
              completedAt: true,
              pic: { select: { id: true, displayName: true } },
              formVersion: {
                select: {
                  id: true,
                  version: true,
                  form: { select: { id: true, name: true } },
                },
              },
              _count: { select: { formSubmissions: true } },
            },
          },
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

  const checklistGroups = card.checklistGroups.map((group) => ({
    id: group.id,
    name: group.name,
    description: group.description
      ? cardDescriptionText(group.description)
      : null,
    descriptionDocument: group.description
      ? cardDescriptionDocument(group.description)
      : null,
    position: group.position,
    startAt: group.startAt?.toISOString() ?? null,
    dueAt: group.dueAt?.toISOString() ?? null,
    pic: group.pic ? { id: group.pic.id, name: group.pic.displayName } : null,
    items: group.items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      position: item.position,
      dueAt: item.dueAt?.toISOString() ?? null,
      isDone: item.isDone,
      completedAt: item.completedAt?.toISOString() ?? null,
      revisionCount: item._count.formSubmissions,
      pic: item.pic
        ? { id: item.pic.id, name: item.pic.displayName }
        : null,
      form: item.formVersion
        ? {
            formId: item.formVersion.form.id,
            versionId: item.formVersion.id,
            name: item.formVersion.form.name,
            version: item.formVersion.version,
            revisionCount: item._count.formSubmissions,
          }
        : null,
    })),
  }));
  const items = checklistGroups.flatMap((group) => group.items);

  return {
    id: card.id,
    columnId: card.columnId,
    title: card.title,
    description: cardDescriptionText(card.description),
    descriptionDocument: cardDescriptionDocument(card.description),
    position: card.position,
    startAt: card.startAt?.toISOString() ?? null,
    dueAt: card.dueAt?.toISOString() ?? null,
    assignee: card.assignee
      ? { id: card.assignee.id, name: card.assignee.displayName }
      : null,
    canOpen: true,
    members: card.members.map(({ user }) => ({
      id: user.id,
      name: user.displayName,
    })),
    labels: card.labels.map(({ label }) => label),
    commentCount: card._count.comments,
    doneItems: items.filter((item) => item.isDone).length,
    totalItems: items.length,
    checklistGroups,
    comments: card.comments.map((comment) => ({
      id: comment.id,
      content: deserializeCommentDocument(comment.body),
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
