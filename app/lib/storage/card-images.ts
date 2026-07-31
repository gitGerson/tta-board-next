import "server-only";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { z } from "zod";
import { requireCurrentUser } from "@/app/lib/dal/auth";
import { NotFoundError } from "@/app/lib/dal/errors";
import { db } from "@/app/lib/db/client";
import { entityIdSchema } from "@/app/lib/kanban/validation";
import { MAX_INLINE_IMAGE_DATA_URL_LENGTH } from "@/app/lib/rich-text/content";
import { cardAccessWhere } from "@/app/lib/services/card-access";

const webpDataUrl = z
  .string()
  .max(MAX_INLINE_IMAGE_DATA_URL_LENGTH)
  .regex(/^data:image\/webp;base64,[a-z0-9+/]+={0,2}$/i);

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function publicBaseUrl(): string {
  return requiredEnvironment("AWS_URL").replace(/\/+$/, "");
}

function s3Client(): S3Client {
  return new S3Client({
    region: requiredEnvironment("AWS_DEFAULT_REGION"),
    endpoint: requiredEnvironment("AWS_ENDPOINT"),
    forcePathStyle: process.env.AWS_USE_PATH_STYLE_ENDPOINT === "true",
    credentials: {
      accessKeyId: requiredEnvironment("AWS_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnvironment("AWS_SECRET_ACCESS_KEY"),
    },
  });
}

export function isStoredCardImageUrl(cardId: string, source: string): boolean {
  return source.startsWith(`${publicBaseUrl()}/cards/${cardId}/`);
}

async function uploadCardImage(input: {
  cardId: string;
  dataUrl: string;
  scope: "descriptions" | "comments";
}): Promise<string> {
  const currentUser = await requireCurrentUser();
  const cardId = entityIdSchema.parse(input.cardId);
  const dataUrl = webpDataUrl.parse(input.dataUrl);
  const card = await db.card.findFirst({
    where: cardAccessWhere(cardId, currentUser.id),
    select: { id: true },
  });

  if (!card) throw new NotFoundError("Card");

  const body = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
  if (body.length === 0 || body.length > 500_000) {
    throw new Error("The compressed image must be smaller than 500 KB.");
  }

  const key = `cards/${card.id}/${input.scope}/${crypto.randomUUID()}.webp`;
  await s3Client().send(
    new PutObjectCommand({
      Bucket: requiredEnvironment("AWS_BUCKET"),
      Key: key,
      Body: body,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return `${publicBaseUrl()}/${key}`;
}

export function uploadCardDescriptionImage(input: {
  cardId: string;
  dataUrl: string;
}): Promise<string> {
  return uploadCardImage({ ...input, scope: "descriptions" });
}

export function uploadCardCommentImage(input: {
  cardId: string;
  dataUrl: string;
}): Promise<string> {
  return uploadCardImage({ ...input, scope: "comments" });
}
