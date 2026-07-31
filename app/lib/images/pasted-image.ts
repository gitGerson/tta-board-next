import { MAX_INLINE_IMAGE_DATA_URL_LENGTH } from "@/app/lib/rich-text/content";

const allowedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export function validatePastedImageFile(file: File): void {
  if (!allowedImageTypes.has(file.type)) {
    throw new Error("Paste a PNG, JPEG, or WebP image.");
  }
  if (file.size > 10_000_000) {
    throw new Error("The pasted image must be smaller than 10 MB.");
  }
}

export async function compressedPastedImageDataUrl(
  file: File,
): Promise<string> {
  validatePastedImageFile(file);

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1_200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");

  if (!context) {
    bitmap.close();
    throw new Error("The image could not be processed.");
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let quality = 0.82;
  let dataUrl = canvas.toDataURL("image/webp", quality);
  while (dataUrl.length > MAX_INLINE_IMAGE_DATA_URL_LENGTH && quality > 0.42) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL("image/webp", quality);
  }

  if (dataUrl.length > MAX_INLINE_IMAGE_DATA_URL_LENGTH) {
    throw new Error("The image is still too large after compression.");
  }

  return dataUrl;
}

type JsonNode = {
  type?: unknown;
  attrs?: Record<string, unknown>;
  content?: JsonNode[];
};

export function imageSources(value: unknown): string[] {
  const sources: string[] = [];

  function visit(node: unknown): void {
    if (!node || typeof node !== "object" || Array.isArray(node)) return;
    const current = node as JsonNode;
    if (
      current.type === "image" &&
      current.attrs &&
      typeof current.attrs.src === "string"
    ) {
      sources.push(current.attrs.src);
    }
    current.content?.forEach(visit);
  }

  visit(value);
  return sources;
}

export function replaceImageSources<T>(
  value: T,
  replacements: ReadonlyMap<string, string>,
): T {
  function replace(node: unknown): unknown {
    if (Array.isArray(node)) return node.map(replace);
    if (!node || typeof node !== "object") return node;

    const current = node as Record<string, unknown>;
    const next = Object.fromEntries(
      Object.entries(current).map(([key, child]) => [key, replace(child)]),
    );
    const attrs = next.attrs;

    if (
      next.type === "image" &&
      attrs &&
      typeof attrs === "object" &&
      !Array.isArray(attrs)
    ) {
      const source = (attrs as Record<string, unknown>).src;
      if (typeof source === "string" && replacements.has(source)) {
        next.attrs = {
          ...(attrs as Record<string, unknown>),
          src: replacements.get(source),
        };
      }
    }

    return next;
  }

  return replace(value) as T;
}
