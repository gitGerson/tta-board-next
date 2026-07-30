// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticateLdap: vi.fn(),
  createSession: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-forwarded-for": "127.0.0.1" })),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/app/lib/auth/session", () => ({
  createSession: mocks.createSession,
}));

vi.mock("@/app/lib/auth/ldap", () => {
  class LdapAuthenticationError extends Error {
    constructor(
      public readonly code: "invalid_credentials" | "unavailable",
    ) {
      super(code);
      this.name = "LdapAuthenticationError";
    }
  }

  return {
    authenticateLdap: mocks.authenticateLdap,
    LdapAuthenticationError,
  };
});

import { LdapAuthenticationError } from "@/app/lib/auth/ldap";
import { resetLoginRateLimiter } from "@/app/lib/auth/rate-limit";
import { loginAction } from "./actions";
import { INITIAL_LOGIN_STATE } from "./state";

function formData(
  username = "jdoe",
  password = "secret",
  remember = false,
): FormData {
  const data = new FormData();
  data.set("username", username);
  data.set("password", password);
  if (remember) {
    data.set("remember", "on");
  }
  return data;
}

describe("loginAction integration", () => {
  beforeEach(() => {
    resetLoginRateLimiter();
    mocks.authenticateLdap.mockReset();
    mocks.createSession.mockReset().mockResolvedValue(undefined);
    mocks.redirect.mockClear();
  });

  it("validates before calling LDAP", async () => {
    const state = await loginAction(
      INITIAL_LOGIN_STATE,
      formData("", "", false),
    );

    expect(state.fieldErrors?.username).toContain("Username is required.");
    expect(state.fieldErrors?.password).toContain("Password is required.");
    expect(mocks.authenticateLdap).not.toHaveBeenCalled();
  });

  it("creates the selected session and redirects after valid LDAP auth", async () => {
    const user = {
      id: "guid-1",
      username: "jdoe",
      name: "Jane Doe",
      email: "jane@example.com",
    };
    mocks.authenticateLdap.mockResolvedValue(user);

    await expect(
      loginAction(INITIAL_LOGIN_STATE, formData("jdoe", "secret", true)),
    ).rejects.toThrow("redirect:/dashboard");

    expect(mocks.createSession).toHaveBeenCalledWith(user, true);
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("returns a generic invalid-credentials message", async () => {
    mocks.authenticateLdap.mockRejectedValue(
      new LdapAuthenticationError("invalid_credentials"),
    );

    await expect(
      loginAction(INITIAL_LOGIN_STATE, formData()),
    ).resolves.toMatchObject({
      status: "error",
      message: "The username or password is invalid.",
    });
  });

  it("throttles the sixth failed attempt in one minute", async () => {
    mocks.authenticateLdap.mockRejectedValue(
      new LdapAuthenticationError("invalid_credentials"),
    );

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await loginAction(INITIAL_LOGIN_STATE, formData());
    }

    await expect(
      loginAction(INITIAL_LOGIN_STATE, formData()),
    ).resolves.toMatchObject({
      message: expect.stringContaining("Too many login attempts"),
    });
    expect(mocks.authenticateLdap).toHaveBeenCalledTimes(5);
  });

  it("returns a distinct directory-unavailable message", async () => {
    mocks.authenticateLdap.mockRejectedValue(
      new LdapAuthenticationError("unavailable"),
    );

    await expect(
      loginAction(INITIAL_LOGIN_STATE, formData()),
    ).resolves.toMatchObject({
      message: "Whoops! LDAP server cannot be reached.",
    });
  });
});
