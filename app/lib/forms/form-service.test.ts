// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@/app/lib/dal/errors";

const mocks = vi.hoisted(() => ({
  requireCurrentUser: vi.fn(),
  checklistItemFindFirst: vi.fn(),
}));

vi.mock("@/app/lib/dal/auth", () => ({
  requireCurrentUser: mocks.requireCurrentUser,
}));

vi.mock("@/app/lib/db/client", () => ({
  db: {
    checklistItem: { findFirst: mocks.checklistItemFindFirst },
  },
}));

import { loadChecklistFormWorkspace } from "./form-service";

const ACTOR = "10000000-0000-4000-8000-000000000001";
const ITEM = "20000000-0000-4000-8000-000000000001";

const version = {
  id: "30000000-0000-4000-8000-000000000001",
  version: 1,
  status: "PUBLISHED" as const,
  name: "Inspection",
  description: null,
  updatedAt: new Date("2026-07-31T00:00:00.000Z"),
  fields: [],
  sections: [],
};

describe("checklist form workspace authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentUser.mockResolvedValue({ id: ACTOR });
  });

  it("scopes workspace reads to the current checklist PIC", async () => {
    mocks.checklistItemFindFirst.mockResolvedValue({
      id: ITEM,
      title: "Verify asset",
      formVersion: version,
      formSubmissions: [],
    });

    await expect(loadChecklistFormWorkspace(ITEM)).resolves.toMatchObject({
      checklistItemId: ITEM,
      assignedVersion: { name: "Inspection" },
    });
    expect(mocks.checklistItemFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ITEM, picId: ACTOR } }),
    );
  });

  it("does not expose a workspace when the PIC-scoped item is absent", async () => {
    mocks.checklistItemFindFirst.mockResolvedValue(null);
    await expect(loadChecklistFormWorkspace(ITEM)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("keeps preserved history accessible after a form is detached", async () => {
    mocks.checklistItemFindFirst.mockResolvedValue({
      id: ITEM,
      title: "Verify asset",
      formVersion: null,
      formSubmissions: [
        {
          id: "40000000-0000-4000-8000-000000000001",
          revision: 1,
          submittedAt: new Date("2026-07-31T01:00:00.000Z"),
          submittedBy: { displayName: "PIC User" },
          formVersion: version,
          values: [],
        },
      ],
    });

    const workspace = await loadChecklistFormWorkspace(ITEM);
    expect(workspace.assignedVersion).toBeNull();
    expect(workspace.revisions).toHaveLength(1);
  });
});
