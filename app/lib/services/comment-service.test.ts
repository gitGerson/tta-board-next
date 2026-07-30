// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError } from "@/app/lib/dal/errors";

const ids = {
  card: "50000000-0000-4000-8000-000000000001",
  author: "10000000-0000-4000-8000-000000000001",
  mentioned: "10000000-0000-4000-8000-000000000002",
} as const;

const mocks = vi.hoisted(() => ({
  requireCurrentUser: vi.fn(),
  cardFindUnique: vi.fn(),
  userFindMany: vi.fn(),
  commentCreate: vi.fn(),
}));

vi.mock("@/app/lib/dal/auth", () => ({
  requireCurrentUser: mocks.requireCurrentUser,
}));

vi.mock("@/app/lib/db/client", () => ({
  db: {
    card: { findUnique: mocks.cardFindUnique },
    user: { findMany: mocks.userFindMany },
    comment: { create: mocks.commentCreate },
  },
}));

import { createComment } from "./comment-service";

const content = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        {
          type: "mention",
          attrs: { id: ids.mentioned, label: "Jane Doe" },
        },
        { type: "text", text: " please review" },
      ],
    },
  ],
} as const;

describe("comment service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentUser.mockResolvedValue({ id: ids.author });
    mocks.cardFindUnique.mockResolvedValue({ id: ids.card });
    mocks.userFindMany.mockResolvedValue([{ id: ids.mentioned }]);
    mocks.commentCreate.mockResolvedValue({ id: "comment-id" });
  });

  it("validates mentioned users and stores versioned rich content", async () => {
    await createComment({ cardId: ids.card, content });

    expect(mocks.userFindMany).toHaveBeenCalledWith({
      where: { id: { in: [ids.mentioned] } },
      select: { id: true },
    });
    expect(mocks.commentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cardId: ids.card,
          authorId: ids.author,
          body: expect.stringContaining('"version":1'),
        }),
      }),
    );
  });

  it("rejects a mention whose user no longer exists", async () => {
    mocks.userFindMany.mockResolvedValue([]);

    await expect(
      createComment({ cardId: ids.card, content }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(mocks.commentCreate).not.toHaveBeenCalled();
  });
});
