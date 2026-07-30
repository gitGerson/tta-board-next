import "server-only";

import type { DirectoryUser, SessionUser } from "@/app/lib/auth/types";
import { requireCurrentUser } from "@/app/lib/dal/auth";
import { db } from "@/app/lib/db/client";

export async function syncDirectoryUser(
  directoryUser: DirectoryUser,
): Promise<SessionUser> {
  const username = directoryUser.username.trim().toLowerCase();
  const email = directoryUser.email.trim().toLowerCase();

  const user = await db.user.upsert({
    where: { ldapGuid: directoryUser.id },
    update: {
      username,
      displayName: directoryUser.name.trim(),
      email,
      isActive: true,
      lastLoginAt: new Date(),
    },
    create: {
      ldapGuid: directoryUser.id,
      username,
      displayName: directoryUser.name.trim(),
      email,
      lastLoginAt: new Date(),
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
    },
  });

  return {
    id: user.id,
    username: user.username,
    name: user.displayName,
    email: user.email,
  };
}

export type AssignableUserDTO = {
  id: string;
  username: string;
  name: string;
  email: string;
};

export async function listAssignableUsers(): Promise<AssignableUserDTO[]> {
  await requireCurrentUser();
  const users = await db.user.findMany({
    where: { isActive: true },
    orderBy: [{ displayName: "asc" }, { username: "asc" }],
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
    },
  });

  return users.map((user) => ({
    id: user.id,
    username: user.username,
    name: user.displayName,
    email: user.email,
  }));
}
