import "server-only";

import { requireCurrentUser } from "@/app/lib/dal/auth";
import { NotFoundError } from "@/app/lib/dal/errors";
import { db } from "@/app/lib/db/client";
import { serializeCommentDocument } from "@/app/lib/comments/content";
import {
  createCommentSchema,
  type CreateCommentInput,
} from "@/app/lib/kanban/validation";

export async function createComment(input: CreateCommentInput) {
  const currentUser = await requireCurrentUser();
  const data = createCommentSchema.parse(input);
  const card = await db.card.findUnique({
    where: { id: data.cardId },
    select: { id: true },
  });

  if (!card) {
    throw new NotFoundError("Card");
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
