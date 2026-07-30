import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { NotFoundError } from "@/app/lib/dal/errors";

/**
 * Every place that accepts user ids from the client has to prove they exist and
 * are still active, so the check lives here rather than being written twice.
 */
export async function assertActiveUsers(
  tx: Prisma.TransactionClient,
  userIds: readonly string[],
): Promise<void> {
  const distinctIds = [...new Set(userIds)];

  if (distinctIds.length === 0) {
    return;
  }

  const count = await tx.user.count({
    where: { id: { in: distinctIds }, isActive: true },
  });

  if (count !== distinctIds.length) {
    throw new NotFoundError("Assignee");
  }
}
