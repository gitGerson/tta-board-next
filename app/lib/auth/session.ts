import "server-only";

import { cookies } from "next/headers";
import type { SessionPayload, SessionUser } from "./types";
import {
  SESSION_COOKIE,
  signSessionToken,
  verifySessionToken,
} from "./session-token";

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error("SESSION_SECRET is not configured.");
  }

  return secret;
}

export async function createSession(
  user: SessionUser,
  remember: boolean,
): Promise<void> {
  const { token, expiresAt } = await signSessionToken(
    user,
    remember,
    sessionSecret(),
  );
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(remember ? { expires: expiresAt } : {}),
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    return await verifySessionToken(token, sessionSecret());
  } catch {
    return null;
  }
}

export async function deleteSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
