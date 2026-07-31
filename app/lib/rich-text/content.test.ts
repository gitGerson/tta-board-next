import { describe, expect, it } from "vitest";
import {
  MAX_INLINE_IMAGE_DATA_URL_LENGTH,
  deserializeRichTextDocument,
  normalizeRichTextDocument,
  serializeRichTextDocument,
} from "./content";

describe("rich text content", () => {
  it("preserves headings and validated inline images", () => {
    const document = normalizeRichTextDocument({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Overview" }],
        },
        {
          type: "image",
          attrs: {
            src: "data:image/png;base64,aGVsbG8=",
            alt: "Diagram",
          },
        },
      ],
    });

    expect(document).not.toBeNull();
    expect(
      deserializeRichTextDocument(serializeRichTextDocument(document!)),
    ).toEqual(document);
  });

  it("rejects oversized inline image data", () => {
    const source =
      "data:image/png;base64," +
      "a".repeat(MAX_INLINE_IMAGE_DATA_URL_LENGTH);

    expect(
      normalizeRichTextDocument({
        type: "doc",
        content: [{ type: "image", attrs: { src: source } }],
      }),
    ).toBeNull();
  });

  it("keeps legacy plain text readable", () => {
    expect(deserializeRichTextDocument("Existing description")).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Existing description" }],
        },
      ],
    });
  });
});
