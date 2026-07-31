import { describe, expect, it } from "vitest";
import { imageSources, replaceImageSources } from "./pasted-image";

describe("pasted image document helpers", () => {
  const document = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "image",
            attrs: { src: "blob:local-preview", alt: "Screenshot" },
          },
        ],
      },
    ],
  };

  it("collects image sources", () => {
    expect(imageSources(document)).toEqual(["blob:local-preview"]);
  });

  it("replaces only matching image sources without mutating the input", () => {
    const replaced = replaceImageSources(
      document,
      new Map([["blob:local-preview", "https://cdn.test/image.webp"]]),
    );

    expect(imageSources(replaced)).toEqual(["https://cdn.test/image.webp"]);
    expect(imageSources(document)).toEqual(["blob:local-preview"]);
  });
});
