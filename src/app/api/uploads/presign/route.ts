import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { authorizeUpload } from "@/lib/uploadAuth";
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  buildKey,
  createPresignedUpload,
  isConfigured,
} from "@/lib/storage";

const schema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(120),
  size: z.number().int().positive(),
  folder: z.string().trim().max(60).default("uploads"),
});

export async function POST(req: Request) {
  if (!isConfigured()) {
    return NextResponse.json(
      {
        error:
          "File uploads aren't configured yet. Add your AWS S3 credentials to .env, or paste an image URL instead.",
        configured: false,
      },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { filename, contentType, size, folder } = parsed.data;

  // Authorised against the folder, so it has to happen after the body parses.
  const auth = await authorizeUpload(folder, req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const isImage = ALLOWED_IMAGE_TYPES.includes(contentType);
  const isVideo = ALLOWED_VIDEO_TYPES.includes(contentType);

  if (!isImage && !isVideo) {
    return NextResponse.json(
      { error: "That file type isn't allowed." },
      { status: 415 }
    );
  }

  // The presigned URL pins Content-Type, but not length — so this is a
  // client-cooperative limit. A bucket-side policy should enforce it too.
  const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (size > maxBytes) {
    return NextResponse.json(
      { error: `That file is too large (max ${Math.round(maxBytes / 1048576)}MB).` },
      { status: 413 }
    );
  }

  const key = buildKey(folder, filename);
  const presigned = await createPresignedUpload({ key, contentType, maxBytes });

  return NextResponse.json({ ...presigned, configured: true });
}

/**
 * Called once the browser's PUT succeeds, so the object is tracked in
 * media_assets rather than existing only in the bucket.
 */
export async function PUT(req: Request) {
  const recordSchema = z.object({
    key: z.string().trim().min(1).max(500),
    url: z.string().trim().min(1).max(2000),
    mimeType: z.string().trim().min(1).max(120),
    sizeBytes: z.number().int().positive().optional(),
    alt: z.string().trim().max(300).optional(),
  });

  const parsed = recordSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const d = parsed.data;

  // The key already encodes the folder the POST authorised, so re-checking it
  // here is what stops a doctor registering an asset under someone else's
  // prefix by calling this half of the flow directly.
  const folder = d.key.split("/")[0] ?? "";
  const auth = await authorizeUpload(folder, req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  await prisma.mediaAsset.upsert({
    where: { storageKey: d.key },
    create: {
      storageKey: d.key,
      url: d.url,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes ?? null,
      alt: d.alt ?? null,
      mediaType: d.mimeType.startsWith("video/") ? "VIDEO" : "IMAGE",
      uploadedById: auth.userId,
    },
    update: { url: d.url, alt: d.alt ?? null },
  });

  return NextResponse.json({ ok: true });
}
