import "server-only";

import { getSession } from "@/app/lib/auth/session";
import { db } from "@/app/lib/db/client";
import { entityIdSchema } from "@/app/lib/kanban/validation";
import { publish } from "./hub";
import { BOARDS_CHANNEL, boardChannel } from "./protocol";

/**
 * Most mutations identify a column or a card rather than a board, so the board
 * they belong to is looked up before the operation runs — after a delete the
 * row is gone and the association with it.
 */
export type MutationScope =
  | { kind: "none" }
  | { kind: "board"; boardId: string }
  | { kind: "column"; columnId: string }
  | { kind: "card"; cardId: string }
  | { kind: "checklistGroup"; groupId: string }
  | { kind: "checklistItem"; itemId: string };

export async function resolveBoardId(
  scope: MutationScope,
): Promise<string | null> {
  try {
    switch (scope.kind) {
      case "none":
        return null;
      case "board":
        return entityIdSchema.parse(scope.boardId);
      case "column": {
        const column = await db.boardColumn.findUnique({
          where: { id: entityIdSchema.parse(scope.columnId) },
          select: { boardId: true },
        });
        return column?.boardId ?? null;
      }
      case "card": {
        const card = await db.card.findUnique({
          where: { id: entityIdSchema.parse(scope.cardId) },
          select: { column: { select: { boardId: true } } },
        });
        return card?.column.boardId ?? null;
      }
      case "checklistGroup": {
        const group = await db.checklistGroup.findUnique({
          where: { id: entityIdSchema.parse(scope.groupId) },
          select: { card: { select: { column: { select: { boardId: true } } } } },
        });
        return group?.card.column.boardId ?? null;
      }
      case "checklistItem": {
        const item = await db.checklistItem.findUnique({
          where: { id: entityIdSchema.parse(scope.itemId) },
          select: {
            group: {
              select: { card: { select: { column: { select: { boardId: true } } } } },
            },
          },
        });
        return item?.group.card.column.boardId ?? null;
      }
    }
  } catch {
    // A malformed id fails in the service layer with a proper message; a
    // missing notification is not worth failing the mutation over.
    return null;
  }
}

/**
 * Tells every other viewer that a board changed. Never throws: realtime is an
 * enhancement, and a mutation that already committed must still report success.
 */
export async function notifyChanged(
  boardId: string | null,
  alsoBoardList: boolean,
): Promise<void> {
  try {
    const session = await getSession();
    const actorId = session?.user.id ?? "";

    if (boardId) {
      publish(boardChannel(boardId), {
        type: "invalidate",
        channel: boardChannel(boardId),
        actorId,
      });
    }

    if (alsoBoardList) {
      publish(BOARDS_CHANNEL, {
        type: "invalidate",
        channel: BOARDS_CHANNEL,
        actorId,
      });
    }
  } catch {
    // Ignored on purpose.
  }
}
