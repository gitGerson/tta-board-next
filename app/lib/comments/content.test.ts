import { describe, expect, it } from "vitest";
import {
  commentText,
  deserializeCommentDocument,
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
