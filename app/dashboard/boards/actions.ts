"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  ConflictError,
  NotFoundError,
} from "@/app/lib/dal/errors";
import type {
  CreateBoardInput,
  CreateCardInput,
  CreateColumnInput,
  CreateCommentInput,
  CreateLabelInput,
  MoveCardInput,
  MoveColumnInput,
  RenameColumnInput,
  UpdateCardInput,
} from "@/app/lib/kanban/validation";
import {
  createBoard,
  createColumn,
  createLabel,
  deleteBoard,
  deleteEmptyColumn,
  moveColumn,
  renameColumn,
} from "@/app/lib/services/board-service";
import {
  createCard,
  deleteCard,
  moveCard,
  updateCard,
} from "@/app/lib/services/card-service";
import { createComment } from "@/app/lib/services/comment-service";
import {
  notifyChanged,
  resolveBoardId,
  type MutationScope,
} from "@/app/lib/realtime/notify";

export type KanbanActionResult =
  | { ok: true; id?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

type Notification = {
  scope: MutationScope;
  /**
   * Set for mutations that change what the board list shows — its boards or
   * their card counts. Moves and renames leave that view identical, and card
   * drags are frequent enough that broadcasting them to every idle dashboard
   * would be pure noise.
   */
  boardList?: boolean;
};

async function runAction(
  notification: Notification,
  operation: () => Promise<{ id: string } | void>,
): Promise<KanbanActionResult> {
  try {
    const boardId = await resolveBoardId(notification.scope);
    const result = await operation();
    revalidatePath("/dashboard", "layout");
    await notifyChanged(boardId, notification.boardList ?? false);
    return result ? { ok: true, id: result.id } : { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        ok: false,
        message: "Check the submitted values.",
        fieldErrors: z.flattenError(error).fieldErrors,
      };
    }
    if (error instanceof ConflictError || error instanceof NotFoundError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "The operation could not be completed." };
  }
}

export async function createBoardAction(
  input: CreateBoardInput,
): Promise<KanbanActionResult> {
  return runAction({ scope: { kind: "none" }, boardList: true }, () =>
    createBoard(input),
  );
}

export async function deleteBoardAction(input: {
  boardId: string;
  confirmation: string;
}): Promise<KanbanActionResult> {
  return runAction(
    { scope: { kind: "board", boardId: input.boardId }, boardList: true },
    () => deleteBoard(input),
  );
}

export async function createColumnAction(
  input: CreateColumnInput,
): Promise<KanbanActionResult> {
  return runAction(
    { scope: { kind: "board", boardId: input.boardId }, boardList: true },
    () => createColumn(input),
  );
}

export async function renameColumnAction(
  input: RenameColumnInput,
): Promise<KanbanActionResult> {
  return runAction({ scope: { kind: "column", columnId: input.columnId } }, () =>
    renameColumn(input),
  );
}

export async function moveColumnAction(
  input: MoveColumnInput,
): Promise<KanbanActionResult> {
  return runAction({ scope: { kind: "column", columnId: input.columnId } }, () =>
    moveColumn(input),
  );
}

export async function deleteColumnAction(
  columnId: string,
): Promise<KanbanActionResult> {
  return runAction(
    { scope: { kind: "column", columnId }, boardList: true },
    () => deleteEmptyColumn(columnId),
  );
}

export async function createLabelAction(
  input: CreateLabelInput,
): Promise<KanbanActionResult> {
  return runAction({ scope: { kind: "board", boardId: input.boardId } }, () =>
    createLabel(input),
  );
}

export async function createCardAction(
  input: CreateCardInput,
): Promise<KanbanActionResult> {
  return runAction(
    { scope: { kind: "column", columnId: input.columnId }, boardList: true },
    () => createCard(input),
  );
}

export async function updateCardAction(
  input: UpdateCardInput,
): Promise<KanbanActionResult> {
  return runAction({ scope: { kind: "card", cardId: input.cardId } }, () =>
    updateCard(input),
  );
}

export async function moveCardAction(
  input: MoveCardInput,
): Promise<KanbanActionResult> {
  return runAction(
    { scope: { kind: "column", columnId: input.targetColumnId } },
    () => moveCard(input),
  );
}

export async function deleteCardAction(
  cardId: string,
): Promise<KanbanActionResult> {
  return runAction({ scope: { kind: "card", cardId }, boardList: true }, () =>
    deleteCard(cardId),
  );
}

export async function createCommentAction(
  input: CreateCommentInput,
): Promise<KanbanActionResult> {
  return runAction({ scope: { kind: "card", cardId: input.cardId } }, () =>
    createComment(input),
  );
}
