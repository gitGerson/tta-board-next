// @vitest-environment node

import { beforeEach, describe, expect, it } from "vitest";
import {
  clearLoginFailures,
  isLoginRateLimited,
  recordLoginFailure,
  resetLoginRateLimiter,
} from "./rate-limit";

describe("login rate limiter", () => {
  beforeEach(resetLoginRateLimiter);

  it("blocks after five failures and clears after success", () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      recordLoginFailure("ip:user", 1_000);
    }

    expect(isLoginRateLimited("ip:user", 2_000)).toBe(true);
    clearLoginFailures("ip:user");
    expect(isLoginRateLimited("ip:user", 2_000)).toBe(false);
  });

  it("opens a new window after the old one expires", () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      recordLoginFailure("ip:user", 1_000);
    }

    expect(isLoginRateLimited("ip:user", 61_001)).toBe(false);
  });
});
