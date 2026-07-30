import "server-only";

import { cache } from "react";
import { getSession } from "@/app/lib/auth/session";
import { db } from "@/app/lib/db/client";
import { AuthenticationError } from "./errors";

export type CurrentUser = {
  id: string;
  username: string;
  name: string;
  email: string;
};

export const requireCurrentUser = cache(async (): Promise<CurrentUser> => {
  const session = await getSession();

  if (!session) {
    throw new AuthenticationError();
  }

  const user = await db.user.findFirst({
    where: { id: session.user.id, isActive: true },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
    },
  });

  if (!user) {
    throw new AuthenticationError();
  }

  return {
    id: user.id,
    username: user.username,
    name: user.displayName,
    email: user.email,
  };
});
