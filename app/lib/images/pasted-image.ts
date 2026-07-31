import { MAX_INLINE_IMAGE_DATA_URL_LENGTH } from "@/app/lib/rich-text/content";

const allowedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function compressedPastedImageDataUrl(
  file: File,
): Promise<string> {
  if (!allowedImageTypes.has(file.type)) {
    throw new Error("Paste a PNG, JPEG, or WebP image.");
  }
  if (file.size > 10_000_000) {
    throw new Error("The pasted image must be smaller than 10 MB.");
  }

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
