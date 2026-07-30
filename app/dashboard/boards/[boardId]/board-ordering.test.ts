import { describe, expect, it } from "vitest";
import type { BoardDTO, CardSummaryDTO } from "@/app/lib/dal/boards";
import { repositionCard, repositionColumns } from "./board-ordering";

function card(id: string, position: number): CardSummaryDTO {
  return {
    id,
    title: id,
    description: null,
    position,
    dueAt: null,
    assignee: null,
    labels: [],
    commentCount: 0,
  };
}

function board(): BoardDTO {
  return {
    id: "board",
    name: "Delivery",
    description: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    labels: [],
    columns: [
      {
        id: "todo",
        name: "To Do",
        position: 0,
        cards: [card("a", 0), card("b", 1), card("c", 2)],
      },
      {
        id: "done",
        name: "Done",
        position: 1,
        cards: [card("d", 0)],
      },
    ],
  };
}

describe("board ordering", () => {
  it("reorders cards within a column and renumbers positions", () => {
    const result = repositionCard(board(), "a", "todo", 2);

    expect(result.columns[0].cards.map((item) => item.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
    expect(result.columns[0].cards.map((item) => item.position)).toEqual([
      0, 1, 2,
    ]);
  });

  it("moves cards across columns without mutating the source board", () => {
    const source = board();
    const result = repositionCard(source, "b", "done", 1);

    expect(source.columns[0].cards.map((item) => item.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(result.columns[0].cards.map((item) => item.id)).toEqual(["a", "c"]);
    expect(result.columns[1].cards.map((item) => item.id)).toEqual(["d", "b"]);
    expect(result.columns[1].cards.map((item) => item.position)).toEqual([0, 1]);
  });

  it("reorders columns and renumbers positions", () => {
    const result = repositionColumns(board(), "done", 0);

    expect(result.columns.map((column) => column.id)).toEqual(["done", "todo"]);
    expect(result.columns.map((column) => column.position)).toEqual([0, 1]);
  });

  it("returns the same board for unknown targets", () => {
    const source = board();

    expect(repositionCard(source, "a", "missing", 0)).toBe(source);
    expect(repositionColumns(source, "missing", 0)).toBe(source);
  });
});
