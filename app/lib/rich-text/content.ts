export const MAX_RICH_TEXT_LENGTH = 5_000;
export const MAX_RICH_TEXT_IMAGES = 4;
export const MAX_INLINE_IMAGE_DATA_URL_LENGTH = 650_000;
const MAX_TOTAL_IMAGE_DATA_LENGTH = 2_000_000;

const allowedNodeTypes = new Set([
  "doc",
  "paragraph",
  "heading",
  "text",
  "hardBreak",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "image",
]);
const allowedMarkTypes = new Set([
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
]);
const imageDataUrlPattern =
  /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/]+={0,2}$/i;

export type RichTextMark = {
  type: "bold" | "italic" | "underline" | "strike" | "code";
};

export type RichTextNode = {
  type:
    | "paragraph"
    | "heading"
    | "text"
    | "hardBreak"
    | "bulletList"
    | "orderedList"
    | "listItem"
    | "blockquote"
    | "codeBlock"
    | "image";
  text?: string;
  attrs?: {
    level?: 2 | 3;
    src?: string;
    alt?: string | null;
    title?: string | null;
  };
  marks?: RichTextMark[];
  content?: RichTextNode[];
};

export type RichTextDocument = {
  type: "doc";
  content?: RichTextNode[];
};

type StoredRichText = {
  version: 2;
  doc: RichTextDocument;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeMark(value: unknown): RichTextMark | null {
  if (!isRecord(value) || typeof value.type !== "string") return null;
  if (!allowedMarkTypes.has(value.type)) return null;
  return { type: value.type as RichTextMark["type"] };
}

function normalizeNode(
  value: unknown,
  depth: number,
  counter: { nodes: number; text: number; images: number; imageData: number },
): RichTextNode | null {
  if (
    depth > 10 ||
    !isRecord(value) ||
    typeof value.type !== "string" ||
    !allowedNodeTypes.has(value.type) ||
    value.type === "doc"
  ) {
    return null;
  }

  counter.nodes += 1;
  if (counter.nodes > 1_000) return null;

  if (value.type === "text") {
    if (typeof value.text !== "string") return null;
    counter.text += value.text.length;
    if (counter.text > MAX_RICH_TEXT_LENGTH) return null;

    const marks = Array.isArray(value.marks)
      ? value.marks.map(normalizeMark)
      : [];
    if (marks.some((mark) => mark === null)) return null;

    return {
      type: "text",
      text: value.text,
      ...(marks.length > 0 ? { marks: marks as RichTextMark[] } : {}),
    };
  }

  if (value.type === "hardBreak") return { type: "hardBreak" };

  if (value.type === "image") {
    const attrs = isRecord(value.attrs) ? value.attrs : null;
    const src = attrs?.src;
    if (
      typeof src !== "string" ||
      src.length > MAX_INLINE_IMAGE_DATA_URL_LENGTH ||
      !imageDataUrlPattern.test(src)
    ) {
      return null;
    }

    counter.images += 1;
    counter.imageData += src.length;
    if (
      counter.images > MAX_RICH_TEXT_IMAGES ||
      counter.imageData > MAX_TOTAL_IMAGE_DATA_LENGTH
    ) {
      return null;
    }

    const alt =
      typeof attrs?.alt === "string" ? attrs.alt.slice(0, 200) : null;
    return { type: "image", attrs: { src, alt, title: null } };
  }

  const content = Array.isArray(value.content)
    ? value.content.map((node) =>
        normalizeNode(node, depth + 1, counter),
      )
    : [];
  if (content.some((node) => node === null)) return null;

  if (value.type === "heading") {
    const attrs = isRecord(value.attrs) ? value.attrs : null;
    const level = attrs?.level;
    if (level !== 2 && level !== 3) return null;

    return {
      type: "heading",
      attrs: { level },
      ...(content.length > 0
        ? { content: content as RichTextNode[] }
        : {}),
    };
  }

  return {
    type: value.type as Exclude<
      RichTextNode["type"],
      "text" | "hardBreak" | "image" | "heading"
    >,
    ...(content.length > 0 ? { content: content as RichTextNode[] } : {}),
  };
}

export function normalizeRichTextDocument(
  value: unknown,
): RichTextDocument | null {
  if (!isRecord(value) || value.type !== "doc") return null;

  const counter = { nodes: 0, text: 0, images: 0, imageData: 0 };
  const content = Array.isArray(value.content)
    ? value.content.map((node) => normalizeNode(node, 1, counter))
    : [];
  if (content.some((node) => node === null)) return null;

  const document: RichTextDocument = {
    type: "doc",
    ...(content.length > 0 ? { content: content as RichTextNode[] } : {}),
  };

  return richTextPlainText(document).trim() || counter.images > 0
    ? document
    : null;
}

export function serializeRichTextDocument(
  document: RichTextDocument,
): string {
  const stored: StoredRichText = { version: 2, doc: document };
  return JSON.stringify(stored);
}

export function deserializeRichTextDocument(
  value: string,
): RichTextDocument {
  try {
    const stored: unknown = JSON.parse(value);
    if (
      isRecord(stored) &&
      (stored.version === 1 || stored.version === 2) &&
      "doc" in stored
    ) {
      const document = normalizeRichTextDocument(stored.doc);
      if (document) return document;
    }
  } catch {
    // Existing plain-text descriptions remain readable.
  }

  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: value }],
      },
    ],
  };
}

export function richTextPlainText(document: RichTextDocument): string {
  function nodeText(node: RichTextNode): string {
    if (node.type === "text") return node.text || "";
    if (node.type === "hardBreak") return "\n";
    if (node.type === "image") return node.attrs?.alt || "";
    return (node.content || []).map(nodeText).join("");
  }

  return (document.content || []).map(nodeText).join("\n");
}
