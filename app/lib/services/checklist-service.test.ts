// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, NotFoundError } from "@/app/lib/dal/errors";

const mocks = vi.hoisted(() => ({
  requireCurrentUser: vi.fn(),
  transaction: vi.fn(),
  groupFindUnique: vi.fn(),
  itemFindUnique: vi.fn(),
  itemFindMany: vi.fn(),
  itemUpdate: vi.fn(),
  itemDelete: vi.fn(),
}));

vi.mock("@/app/lib/dal/auth", () => ({
  requireCurrentUser: mocks.requireCurrentUser,
}));

vi.mock("@/app/lib/db/client", () => ({
  db: {
    $transaction: mocks.transaction,
    checklistItem: {
      findUnique: mocks.itemFindUnique,
      update: mocks.itemUpdate,
    },
  },
}));

import {
  deleteChecklistItem,
  moveChecklistItem,
  setChecklistItemDone,
} from "./checklist-service";

const ACTOR = "10000000-0000-4000-8000-000000000001";
const ITEM = "20000000-0000-4000-8000-000000000001";
const GROUP_A = "30000000-0000-4000-8000-00000000000a";
const GROUP_B = "30000000-0000-4000-8000-00000000000b";

/** Positions written by the service, keyed by row id. */
function writtenPositions(): Record<string, number> {
  return Object.fromEntries(
    mocks.itemUpdate.mock.calls
      .filter((call) => call[0]?.data?.position !== undefined)
      .map((call) => [call[0].where.id, call[0].data.position]),
  );
}

describe("checklist service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentUser.mockResolvedValue({ id: ACTOR });
    mocks.transaction.mockImplementation(
      async (operation: (tx: unknown) => Promise<unknown>) =>
        operation({
          checklistGroup: { findUnique: mocks.groupFindUnique },
          checklistItem: {
            findUnique: mocks.itemFindUnique,
            findMany: mocks.itemFindMany,
            update: mocks.itemUpdate,
            delete: mocks.itemDelete,
          },
        }),
    );
  });

  describe("moveChecklistItem", () => {
    it("renumbers every sibling when reordering inside one group", async () => {
      mocks.itemFindUnique.mockResolvedValue({
        id: ITEM,
        groupId: GROUP_A,
        group: { cardId: "card-a" },
      });
      mocks.groupFindUnique.mockResolvedValue({
        id: GROUP_A,
        cardId: "card-a",
      });
      mocks.itemFindMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);

      await moveChecklistItem({
        itemId: ITEM,
        targetGroupId: GROUP_A,
        targetIndex: 1,
      });

      expect(writtenPositions()).toEqual({ a: 0, [ITEM]: 1, b: 2 });
    });

    it("clamps an index past the end onto the last slot", async () => {
      mocks.itemFindUnique.mockResolvedValue({
        id: ITEM,
        groupId: GROUP_A,
        group: { cardId: "card-a" },
      });
      mocks.groupFindUnique.mockResolvedValue({
        id: GROUP_A,
        cardId: "card-a",
      });
      mocks.itemFindMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);

      await moveChecklistItem({
        itemId: ITEM,
        targetGroupId: GROUP_A,
        targetIndex: 99,
      });

      expect(writtenPositions()).toEqual({ a: 0, b: 1, [ITEM]: 2 });
    });

    it("refuses to move an item onto another card's group", async () => {
      mocks.itemFindUnique.mockResolvedValue({
        id: ITEM,
        groupId: GROUP_A,
        group: { cardId: "card-a" },
      });
      mocks.groupFindUnique.mockResolvedValue({
        id: GROUP_B,
        cardId: "card-b",
      });

      await expect(
        moveChecklistItem({
          itemId: ITEM,
          targetGroupId: GROUP_B,
          targetIndex: 0,
        }),
      ).rejects.toBeInstanceOf(ConflictError);
      expect(mocks.itemUpdate).not.toHaveBeenCalled();
    });

    it("rejects an unknown item", async () => {
      mocks.itemFindUnique.mockResolvedValue(null);
      mocks.groupFindUnique.mockResolvedValue({
        id: GROUP_A,
        cardId: "card-a",
      });

      await expect(
        moveChecklistItem({
          itemId: ITEM,
          targetGroupId: GROUP_A,
          targetIndex: 0,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("setChecklistItemDone", () => {
    it("stamps who completed it alongside when", async () => {
      mocks.itemFindUnique.mockResolvedValue({ id: ITEM });

      await setChecklistItemDone({ itemId: ITEM, isDone: true });

      const { data } = mocks.itemUpdate.mock.calls[0][0];
      expect(data.isDone).toBe(true);
      expect(data.completedById).toBe(ACTOR);
      expect(data.completedAt).toBeInstanceOf(Date);
    });

    it("clears both stamps when unticked, never one alone", async () => {
      mocks.itemFindUnique.mockResolvedValue({ id: ITEM });

      await setChecklistItemDone({ itemId: ITEM, isDone: false });

      expect(mocks.itemUpdate.mock.calls[0][0].data).toEqual({
        isDone: false,
        completedAt: null,
        completedById: null,
      });
    });
  });

  describe("deleteChecklistItem", () => {
    it("closes the gap left in the group's positions", async () => {
      mocks.itemFindUnique.mockResolvedValue({ id: ITEM, groupId: GROUP_A });
      mocks.itemFindMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);

      await deleteChecklistItem(ITEM);

      expect(mocks.itemDelete).toHaveBeenCalledWith({ where: { id: ITEM } });
      expect(writtenPositions()).toEqual({ a: 0, b: 1 });
    });
  });
});
