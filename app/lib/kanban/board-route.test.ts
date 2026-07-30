import { describe, expect, it } from "vitest";
import { boardPath, isBoardKey } from "./board-route";

describe("board routes", () => {
  it("builds a route from a 16-character URL-safe key", () => {
    const key = "2bbMVYpomAVjUHgE";

    expect(isBoardKey(key)).toBe(true);
    expect(boardPath(key)).toBe(`/board/${key}`);
  });

  it.each(["", "not-a-board", "A".repeat(15), "!".repeat(16)])(
    "rejects malformed board keys",
    (key) => {
      expect(isBoardKey(key)).toBe(false);
      expect(() => boardPath(key)).toThrow("Invalid board route key");
    },
  );
});
