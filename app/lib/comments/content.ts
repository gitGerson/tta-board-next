export const MAX_COMMENT_TEXT_LENGTH = 5_000;

const allowedNodeTypes = new Set([
  "doc",
  "paragraph",
  "text",
  "hardBreak",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
]);
const allowedMarkTypes = new Set([
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
]);

export type CommentMark = {
  type: "bold" | "italic" | "underline" | "strike" | "code";
};

export type CommentNode = {
  type:
    | "paragraph"
    | "text"
    | "hardBreak"
    | "bulletList"
    | "orderedList"
    | "listItem"
    | "blockquote"
    | "codeBlock";
  text?: string;
  marks?: CommentMark[];
  content?: CommentNode[];
};

export type CommentDocument = {
  type: "doc";
  content?: CommentNode[];
};

type StoredComment = {
  version: 1;
  doc: CommentDocument;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeMark(value: unknown): CommentMark | null {
  if (!isRecord(value) || typeof value.type !== "string") return null;
  if (!allowedMarkTypes.has(value.type)) return null;
  return { type: value.type as CommentMark["type"] };
}

function normalizeNode(
  value: unknown,
  depth: number,
  counter: { nodes: number; text: number },
): CommentNode | null {
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
    if (counter.text > MAX_COMMENT_TEXT_LENGTH) return null;

    const marks = Array.isArray(value.marks)
      ? value.marks.map(normalizeMark)
      : [];
    if (marks.some((mark) => mark === null)) return null;

    return {
      type: "text",
      text: value.text,
      ...(marks.length > 0 ? { marks: marks as CommentMark[] } : {}),
    };
  }

  if (value.type === "hardBreak") {
    return { type: "hardBreak" };
  }

  const content = Array.isArray(value.content)
    ? value.content.map((node) => normalizeNode(node, depth + 1, counter))
    : [];
  if (content.some((node) => node === null)) return null;

  return {
    type: value.type as Exclude<CommentNode["type"], "text" | "hardBreak">,
    ...(content.length > 0 ? { content: content as CommentNode[] } : {}),
  };
}

export function normalizeCommentDocument(
  value: unknown,
): CommentDocument | null {
  if (!isRecord(value) || value.type !== "doc") return null;

  const counter = { nodes: 0, text: 0 };
  const content = Array.isArray(value.content)
    ? value.content.map((node) => normalizeNode(node, 1, counter))
    : [];

  if (content.some((node) => node === null)) return null;

  const document: CommentDocument = {
    type: "doc",
    ...(content.length > 0 ? { content: content as CommentNode[] } : {}),
  };

  return commentText(document).trim() ? document : null;
}

export function commentText(document: CommentDocument): string {
  function nodeText(node: CommentNode): string {
    if (node.type === "text") return node.text || "";
    if (node.type === "hardBreak") return "\n";
    return (node.content || []).map(nodeText).join("");
  }

  return (document.content || []).map(nodeText).join("\n");
}

export function serializeCommentDocument(document: CommentDocument): string {
  const stored: StoredComment = { version: 1, doc: document };
  return JSON.stringify(stored);
}

export function deserializeCommentDocument(body: string): CommentDocument {
  try {
    const stored: unknown = JSON.parse(body);

    if (
      isRecord(stored) &&
      stored.version === 1 &&
      "doc" in stored
    ) {
      const document = normalizeCommentDocument(stored.doc);
      if (document) return document;
    }
  } catch {
    // Existing plain-text comments remain readable.
  }

  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: body }],
      },
    ],
  };
}
