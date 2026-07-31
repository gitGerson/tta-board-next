import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { ConflictError, NotFoundError } from "@/app/lib/dal/errors";

export function cardAccessWhere(
  cardId: string,
  userId: string,
): Prisma.CardWhereInput {
  return {
    id: cardId,
    OR: [
      { assigneeId: userId },
      { members: { some: { userId } } },
    ],
  };
}

export async function assertCardAccess(
  tx: Prisma.TransactionClient,
  cardId: string,
  userId: string,
): Promise<void> {
  const card = await tx.card.findFirst({
    where: cardAccessWhere(cardId, userId),
    select: { id: true },
  });

  if (!card) {
    throw new NotFoundError("Card");
  }
}

export async function assertCardUsersAreMembers(
  tx: Prisma.TransactionClient,
  cardId: string,
  userIds: string[],
): Promise<void> {
  const distinctIds = [...new Set(userIds)];
  if (distinctIds.length === 0) return;

  const memberCount = await tx.cardMember.count({
    where: { cardId, userId: { in: distinctIds } },
  });

  if (memberCount !== distinctIds.length) {
    throw new ConflictError(
      "PIC and checklist assignments must use card members.",
    );
  }
}
