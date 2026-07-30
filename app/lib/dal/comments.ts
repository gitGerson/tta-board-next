import "server-only";

import { requireCurrentUser } from "@/app/lib/dal/auth";
import { NotFoundError } from "@/app/lib/dal/errors";
import { db } from "@/app/lib/db/client";
import { entityIdSchema } from "@/app/lib/kanban/validation";

export async function listComments(cardIdInput: string) {
  await requireCurrentUser();
  const cardId = entityIdSchema.parse(cardIdInput);
  const card = await db.card.findUnique({
    where: { id: cardId },
    select: { id: true },
  });

  if (!card) {
    throw new NotFoundError("Card");
  }

  const comments = await db.comment.findMany({
    where: { cardId },
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
  });

  return comments.map((comment) => ({
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    author: {
      id: comment.author.id,
      name: comment.author.displayName,
      username: comment.author.username,
    },
  }));
}
