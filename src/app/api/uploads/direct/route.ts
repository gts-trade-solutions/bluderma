import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { authorizeUpload } from "@/lib/uploadAuth";
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  buildKey,
  isConfigured,
  uploadObject,
} from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A 100MB video through the server is slow; the presigned path handles those
// in seconds and this only ever runs when that path could not.
export const maxDuration = 60;

/**
 * The upload that works when the browser cannot reach S3 itself.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * Every upload in this app is a presigned PUT straight from the browser to
 * S3, which is the right default: an 8MB portrait never touches our server.
 * But it only works if the bucket's CORS configuration names the exact origin
 * the page is served from — scheme, host AND port. In practice it kept not
 * being:
 *
 *   - `next dev` walks up a port when 3000 is taken, so a second dev server
 *     lands on :3003 and every upload starts failing with no code change.
 *   - Testing on a phone means `http://192.168.1.x:3000`, which no origin
 *     list ever contains.
 *   - A new deployment domain fails until somebody remembers to re-run
 *     prisma/setup-s3.ts.
 *
 * In each case `fetch` throws on the refused preflight, the file is never
 * sent, and the doctor is told "storage refused the upload" — which is true
 * and completely unactionable for them.
 *
 * So: same authorisation, same size and type limits, same key builder, the
 * bytes just travel through us. lib/uploadClient.ts tries the presigned path
 * first and only lands here when it could not. An upload now fails only if it
 * genuinely should.
 */
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

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const file = form.get("file");
  const folder = String(form.get("folder") ?? "uploads")
    .trim()
    .slice(0, 60);

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file received." }, { status: 400 });
  }

  // Authorised against the folder, exactly as the presigned route is.
  const auth = await authorizeUpload(folder, req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const contentType = file.type || "application/octet-stream";
  const isImage = ALLOWED_IMAGE_TYPES.includes(contentType);
  const isVideo = ALLOWED_VIDEO_TYPES.includes(contentType);
  if (!isImage && !isVideo) {
    return NextResponse.json(
      { error: "That file type isn't allowed." },
      { status: 415 }
    );
  }

  // Unlike the presigned path, this limit is real rather than
  // client-cooperative: the bytes are in our hands before anything is stored.
  const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: `That file is too large (max ${Math.round(maxBytes / 1048576)}MB).` },
      { status: 413 }
    );
  }

  const key = buildKey(folder, file.name);

  let url: string;
  try {
    url = await uploadObject({
      key,
      body: Buffer.from(await file.arrayBuffer()),
      contentType,
    });
  } catch (e) {
    console.error("direct upload failed", e);
    return NextResponse.json(
      { error: "Storage would not accept the file. Please try again." },
      { status: 502 }
    );
  }

  // Recorded here rather than in a second round trip: the browser already
  // failed once getting to S3, and a fallback that needs another request to
  // finish is a fallback with another way to half-succeed.
  await prisma.mediaAsset
    .upsert({
      where: { storageKey: key },
      create: {
        storageKey: key,
        url,
        mimeType: contentType,
        sizeBytes: file.size,
        mediaType: contentType.startsWith("video/") ? "VIDEO" : "IMAGE",
        uploadedById: auth.userId,
      },
      update: { url },
    })
    .catch((e) => console.error("media asset record failed", e));

  return NextResponse.json({ url, key, publicUrl: url, via: "server" });
}
