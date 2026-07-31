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
  labelFindFirst: vi.fn(),
  labelUpdate: vi.fn(),
}));

vi.mock("@/app/lib/dal/auth", () => ({
  requireCurrentUser: mocks.requireCurrentUser,
}));

vi.mock("@/app/lib/db/client", () => ({
  db: {
    $transaction: mocks.transaction,
    label: {
      findFirst: mocks.labelFindFirst,
      update: mocks.labelUpdate,
    },
  },
}));

import { createBoard, deleteEmptyColumn, updateLabel } from "./board-service";

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
      routeKey: "2bbMVYpomAVjUHgE",
      name: "Product",
    });
    mocks.columnCreateMany.mockResolvedValue({ count: 4 });
  });

  it("creates a board and four default columns in one transaction", async () => {
    await createBoard({ name: " Product ", description: null });

    expect(mocks.boardCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        routeKey: expect.stringMatching(/^[A-Za-z0-9_-]{16}$/),
      }),
      select: { id: true, routeKey: true, name: true },
    });
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

  it("updates a label only within its board", async () => {
    const boardId = "20000000-0000-4000-8000-000000000001";
    const labelId = "40000000-0000-4000-8000-000000000001";
    mocks.labelFindFirst.mockResolvedValue({ id: labelId });
    mocks.labelUpdate.mockResolvedValue({ id: labelId });

    await updateLabel({
      boardId,
      labelId,
      name: "Priority",
      color: "#ef4444",
    });

    expect(mocks.labelFindFirst).toHaveBeenCalledWith({
      where: { id: labelId, boardId },
      select: { id: true },
    });
    expect(mocks.labelUpdate).toHaveBeenCalledWith({
      where: { id: labelId },
      data: { name: "Priority", color: "#ef4444" },
      select: { id: true },
    });
  });
});
