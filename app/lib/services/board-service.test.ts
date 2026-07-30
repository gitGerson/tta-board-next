// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationError, ConflictError } from "@/app/lib/dal/errors";

const mocks = vi.hoisted(() => ({
  requireCurrentUser: vi.fn(),
  transaction: vi.fn(),
  boardCreate: vi.fn(),
  columnCreateMany: vi.fn(),
  columnFindUnique: vi.fn(),
  columnDelete: vi.fn(),
}));

vi.mock("@/app/lib/dal/auth", () => ({
  requireCurrentUser: mocks.requireCurrentUser,
}));

vi.mock("@/app/lib/db/client", () => ({
  db: { $transaction: mocks.transaction },
}));

import { createBoard, deleteEmptyColumn } from "./board-service";

describe("board service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentUser.mockResolvedValue({
      id: "10000000-0000-4000-8000-000000000001",
    });
    mocks.transaction.mockImplementation(
      async (operation: (tx: unknown) => Promise<unknown>) =>
        operation({
          board: { create: mocks.boardCreate },
          boardColumn: {
            createMany: mocks.columnCreateMany,
            findUnique: mocks.columnFindUnique,
            delete: mocks.columnDelete,
            findMany: vi.fn().mockResolvedValue([]),
          },
        }),
    );
    mocks.boardCreate.mockResolvedValue({
      id: "20000000-0000-4000-8000-000000000001",
      name: "Product",
    });
    mocks.columnCreateMany.mockResolvedValue({ count: 4 });
  });

  it("creates a board and four default columns in one transaction", async () => {
    await createBoard({ name: " Product ", description: null });

    expect(mocks.columnCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ name: "To Do", position: 0 }),
        expect.objectContaining({ name: "In Progress", position: 1 }),
        expect.objectContaining({ name: "Review", position: 2 }),
        expect.objectContaining({ name: "Done", position: 3 }),
      ],
    });
  });

  it("does not start a mutation when authentication fails", async () => {
    mocks.requireCurrentUser.mockRejectedValueOnce(new AuthenticationError());

    await expect(
      createBoard({ name: "Product", description: null }),
    ).rejects.toBeInstanceOf(AuthenticationError);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("refuses to delete a column that still contains cards", async () => {
    mocks.columnFindUnique.mockResolvedValue({
      id: "30000000-0000-4000-8000-000000000001",
      boardId: "20000000-0000-4000-8000-000000000001",
      _count: { cards: 1 },
    });

    await expect(
      deleteEmptyColumn("30000000-0000-4000-8000-000000000001"),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(mocks.columnDelete).not.toHaveBeenCalled();
  });
});
