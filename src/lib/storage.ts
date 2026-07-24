import { randomBytes } from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * S3 uploads via presigned PUT URLs: the browser sends the file straight to
 * S3, so large images never pass through the Next.js server.
 *
 * Everything here is optional. Until AWS credentials are set, `isConfigured()`
 * is false and the admin falls back to pasting an image URL — which is how the
 * seeded content already works (all of it is remote CDN links).
 */

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
];
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm"];

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export function isConfigured(): boolean {
  return !!(
    process.env.S3_BUCKET &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_REGION
  );
}

let client: S3Client | undefined;

function s3(): S3Client {
  return (client ??= new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  }));
}

/**
 * Builds the stored object key. The original filename is slugified and
 * suffixed with random bytes — never used raw, since a caller-controlled key
 * could otherwise overwrite an existing object or escape the prefix.
 */
export function buildKey(folder: string, filename: string): string {
  const dot = filename.lastIndexOf(".");
  const ext = (dot > -1 ? filename.slice(dot + 1) : "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 5);

  const base = (dot > -1 ? filename.slice(0, dot) : filename)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "file";

  const safeFolder = folder.replace(/[^a-z0-9/-]/gi, "") || "uploads";
  const unique = randomBytes(6).toString("hex");
  return `${safeFolder}/${base}-${unique}${ext ? `.${ext}` : ""}`;
}

/** Public URL for a stored object — CloudFront when set, else the S3 endpoint. */
export function publicUrlFor(key: string): string {
  const cdn = process.env.CDN_BASE_URL?.replace(/\/$/, "");
  if (cdn) return `${cdn}/${key}`;
  return `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

/**
 * Server-side upload of an in-memory object (used by the image re-host
 * pipeline). No ACL is set — modern buckets enforce Object Ownership with ACLs
 * disabled, so public delivery is via bucket policy or CloudFront, not
 * per-object ACLs.
 */
export async function uploadObject(input: {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}): Promise<string> {
  await s3().send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return publicUrlFor(input.key);
}

export async function createPresignedUpload(input: {
  key: string;
  contentType: string;
  maxBytes: number;
}): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: input.key,
    ContentType: input.contentType,
  });

  const uploadUrl = await getSignedUrl(s3(), command, { expiresIn: 300 });

  return { uploadUrl, publicUrl: publicUrlFor(input.key), key: input.key };
}
