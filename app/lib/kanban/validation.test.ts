import { describe, expect, it } from "vitest";
import { updateCardSchema } from "./validation";

const cardId = "10000000-0000-4000-8000-000000000001";
const labelId = "20000000-0000-4000-8000-000000000001";

describe("card update validation", () => {
  it("does not materialize omitted fields when updating dates", () => {
    const startAt = new Date("2026-08-01T00:00:00.000Z");

    expect(updateCardSchema.parse({ cardId, startAt })).toEqual({
      cardId,
      startAt,
    });
  });

  it("does not reset dates or assignee when updating labels", () => {
    expect(updateCardSchema.parse({ cardId, labelIds: [labelId] })).toEqual({
      cardId,
      labelIds: [labelId],
    });
  });

  it("preserves explicit nulls used to clear a field", () => {
    expect(
      updateCardSchema.parse({
        cardId,
        startAt: null,
        dueAt: null,
        assigneeId: null,
      }),
    ).toEqual({
      cardId,
      startAt: null,
      dueAt: null,
      assigneeId: null,
    });
  });
});
