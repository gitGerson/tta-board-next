import { describe, expect, it } from "vitest";
import { loginSchema } from "./validation";

describe("loginSchema", () => {
  it("normalizes valid credentials", () => {
    expect(
      loginSchema.parse({
        username: "  jdoe  ",
        password: "secret",
        remember: true,
      }),
    ).toEqual({
      username: "jdoe",
      password: "secret",
      remember: true,
    });
  });

  it("returns field errors for missing credentials", () => {
    const result = loginSchema.safeParse({
      username: "",
      password: "",
      remember: false,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.username).toContain(
        "Username is required.",
      );
      expect(result.error.flatten().fieldErrors.password).toContain(
        "Password is required.",
      );
    }
  });
});
