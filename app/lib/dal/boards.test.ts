// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/lib/db/client", () => ({ db: {} }));

import { foldChecklistProgress } from "./boards";

function tally(groupId: string, isDone: boolean, count: number) {
  return { groupId, isDone, _count: { _all: count } };
}

describe("foldChecklistProgress", () => {
  it("sums every group on a card into one tally", () => {
    const progress = foldChecklistProgress(
      [
        { id: "g1", cardId: "card-a" },
        { id: "g2", cardId: "card-a" },
      ],
      [
        tally("g1", true, 3),
        tally("g1", false, 2),
        tally("g2", true, 1),
        tally("g2", false, 4),
      ],
    );

    expect(progress.get("card-a")).toEqual({ done: 4, total: 10 });
  });

  it("keeps cards separate", () => {
    const progress = foldChecklistProgress(
      [
        { id: "g1", cardId: "card-a" },
        { id: "g2", cardId: "card-b" },
      ],
      [tally("g1", true, 2), tally("g2", false, 5)],
    );

    expect(progress.get("card-a")).toEqual({ done: 2, total: 2 });
    expect(progress.get("card-b")).toEqual({ done: 0, total: 5 });
  });

  it("reports 0/0 for a card whose groups hold no items", () => {
    const progress = foldChecklistProgress([{ id: "g1", cardId: "card-a" }], []);

    expect(progress.get("card-a")).toEqual({ done: 0, total: 0 });
  });

  it("omits cards that have no groups at all", () => {
    const progress = foldChecklistProgress([], []);

    expect(progress.size).toBe(0);
  });

  it("ignores tallies for groups outside the board", () => {
    const progress = foldChecklistProgress(
      [{ id: "g1", cardId: "card-a" }],
      [tally("g1", true, 1), tally("stray", true, 99)],
    );

    expect(progress.get("card-a")).toEqual({ done: 1, total: 1 });
    expect(progress.size).toBe(1);
  });

  it("counts a fully finished card as done equal to total", () => {
    const progress = foldChecklistProgress(
      [{ id: "g1", cardId: "card-a" }],
      [tally("g1", true, 6)],
    );

    expect(progress.get("card-a")).toEqual({ done: 6, total: 6 });
  });
});
