import { describe, expect, it } from "vitest";
import { cardIdFromKey, cardKey, cardPath } from "./card-route";

const CARD_ID = "123e4567-e89b-42d3-a456-426614174000";

describe("card short routes", () => {
  it("round-trips a UUID through a 22-character URL-safe key", () => {
    const key = cardKey(CARD_ID);

    expect(key).toHaveLength(22);
    expect(key).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(cardIdFromKey(key)).toBe(CARD_ID);
    expect(cardPath(CARD_ID)).toBe(`/c/${key}`);
  });

  it.each(["", "not-a-card", "A".repeat(21), "!".repeat(22)])(
    "rejects malformed card keys",
    (key) => {
      expect(cardIdFromKey(key)).toBeNull();
    },
  );

  it("rejects malformed card IDs", () => {
    expect(() => cardKey("not-a-uuid")).toThrow("Invalid card ID");
  });
});
