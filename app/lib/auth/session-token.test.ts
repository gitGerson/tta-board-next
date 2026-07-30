// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  BROWSER_SESSION_SECONDS,
  REMEMBERED_SESSION_SECONDS,
  signSessionToken,
  verifySessionToken,
} from "./session-token";

const user = {
  id: "a-guid",
  username: "jdoe",
  name: "Jane Doe",
  email: "jane@example.com",
};
const secret = "a-test-secret-that-is-longer-than-32-characters";
const now = new Date("2026-07-30T00:00:00.000Z");

describe("session tokens", () => {
  it.each([
    [false, BROWSER_SESSION_SECONDS],
    [true, REMEMBERED_SESSION_SECONDS],
  ])("uses the expected lifetime for remember=%s", async (remember, seconds) => {
    const { token, expiresAt } = await signSessionToken(
      user,
      remember,
      secret,
      now,
    );

    expect(expiresAt.getTime() - now.getTime()).toBe(seconds * 1000);
    expect(await verifySessionToken(token, secret)).toMatchObject({ user });
  });

  it("rejects a token signed with another secret", async () => {
    const { token } = await signSessionToken(user, false, secret);

    await expect(
      verifySessionToken(
        token,
        "a-different-secret-that-is-also-long-enough",
      ),
    ).resolves.toBeNull();
  });

  it("requires a strong session secret", async () => {
    await expect(signSessionToken(user, false, "short")).rejects.toThrow(
      "at least 32 characters",
    );
  });
});
