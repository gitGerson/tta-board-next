import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import type { SessionPayload, SessionUser } from "./types";

export const SESSION_COOKIE = "tta-session";
export const BROWSER_SESSION_SECONDS = 60 * 60 * 12;
export const REMEMBERED_SESSION_SECONDS = 60 * 60 * 24 * 30;

const sessionPayloadSchema = z.object({
  user: z.object({
    id: z.string().min(1),
    username: z.string().min(1),
    name: z.string().min(1),
    email: z.string(),
  }),
  expiresAt: z.string().datetime(),
});

function keyFromSecret(secret: string): Uint8Array {
  if (secret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }

  return new TextEncoder().encode(secret);
}

export async function signSessionToken(
  user: SessionUser,
  remember: boolean,
  secret: string,
  now = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const lifetime = remember
    ? REMEMBERED_SESSION_SECONDS
    : BROWSER_SESSION_SECONDS;
  const expiresAt = new Date(now.getTime() + lifetime * 1000);
  const payload: SessionPayload = {
    user,
    expiresAt: expiresAt.toISOString(),
  };

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(Math.floor(now.getTime() / 1000))
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(keyFromSecret(secret));

  return { token, expiresAt };
}

export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, keyFromSecret(secret), {
      algorithms: ["HS256"],
    });

    return sessionPayloadSchema.parse(payload);
  } catch {
    return null;
  }
}
