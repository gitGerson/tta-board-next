import { describe, expect, it } from "vitest";
import {
  commentImageSources,
  commentText,
  deserializeCommentDocument,
  mentionedUserIds,
  normalizeCommentDocument,
  serializeCommentDocument,
} from "./content";

const richComment = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Ship ", marks: [{ type: "bold" }] },
        { type: "text", text: "today" },
      ],
    },
  ],
} as const;

describe("comment content", () => {
  it("normalizes, serializes, and restores rich comment JSON", () => {
    const normalized = normalizeCommentDocument(richComment);

    expect(normalized).not.toBeNull();
    expect(commentText(normalized!)).toBe("Ship today");
    expect(
      deserializeCommentDocument(serializeCommentDocument(normalized!)),
    ).toEqual(normalized);
  });

  it("keeps existing plain-text comments readable", () => {
    expect(commentText(deserializeCommentDocument("Legacy comment"))).toBe(
      "Legacy comment",
    );
  });

  it("preserves mention identity and readable text", () => {
    const document = normalizeCommentDocument({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "mention",
              attrs: {
                id: "10000000-0000-4000-8000-000000000001",
                label: "Jane Doe",
              },
            },
          ],
        },
      ],
    });

    expect(document).not.toBeNull();
    expect(commentText(document!)).toBe("@Jane Doe");
    expect(mentionedUserIds(document!)).toEqual([
      "10000000-0000-4000-8000-000000000001",
    ]);
  });

  it("accepts trusted-shape HTTPS images and supports image-only comments", () => {
    const document = normalizeCommentDocument({
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            src: "https://cdn.example.test/cards/card-id/comments/image.webp",
            alt: "Pasted screenshot",
          },
        },
      ],
    });

    expect(document).not.toBeNull();
    expect(commentImageSources(document!)).toEqual([
      "https://cdn.example.test/cards/card-id/comments/image.webp",
    ]);
  });

  it("rejects empty, oversized, and unsupported documents", () => {
    expect(
      normalizeCommentDocument({ type: "doc", content: [{ type: "paragraph" }] }),
    ).toBeNull();
    expect(
      normalizeCommentDocument({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "x".repeat(5_001) }],
          },
        ],
      }),
    ).toBeNull();
    expect(
      normalizeCommentDocument({
        type: "doc",
        content: [{ type: "image", attrs: { src: "javascript:alert(1)" } }],
      }),
    ).toBeNull();
  });
});
