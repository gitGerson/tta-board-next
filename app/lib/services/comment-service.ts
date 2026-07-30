import "server-only";

import { requireCurrentUser } from "@/app/lib/dal/auth";
import { ConflictError, NotFoundError } from "@/app/lib/dal/errors";
import { db } from "@/app/lib/db/client";
import {
  mentionedUserIds,
  serializeCommentDocument,
} from "@/app/lib/comments/content";
import {
  createCommentSchema,
  type CreateCommentInput,
} from "@/app/lib/kanban/validation";

export async function createComment(input: CreateCommentInput) {
  const currentUser = await requireCurrentUser();
  const data = createCommentSchema.parse(input);
  const mentionIds = mentionedUserIds(data.content);
  const [card, mentionedUsers] = await Promise.all([
    db.card.findUnique({
      where: { id: data.cardId },
      select: { id: true },
    }),
    db.user.findMany({
      where: { id: { in: mentionIds } },
      select: { id: true },
    }),
  ]);

  if (!card) {
    throw new NotFoundError("Card");
  }

  if (mentionedUsers.length !== mentionIds.length) {
    throw new ConflictError("One or more mentioned users are unavailable.");
  }

  return db.comment.create({
    data: {
      cardId: card.id,
      authorId: currentUser.id,
      body: serializeCommentDocument(data.content),
    },
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { id: true, displayName: true } },
    },
  });
}
