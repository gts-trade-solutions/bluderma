import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fieldErrors } from "@/lib/validation";
import { ForbiddenError } from "./guard";

export interface AdminResult {
  ok: boolean;
  error?: string;
  fields?: Record<string, string>;
  id?: string;
}

/**
 * FormData -> plain object. Fields that appear more than once (checkbox
 * groups, multi-selects) collapse to an array so the schemas can read them.
 */
export function formToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) continue;
    const existing = out[key];
    if (existing === undefined) out[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else out[key] = [existing, value];
  }
  return out;
}

/** Normalises a field the schema expects as an array but that may arrive singly. */
export function asArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value === undefined || value === null || value === "") return [];
  return [String(value)];
}

export function parseForm<T extends z.ZodTypeAny>(
  schema: T,
  formData: FormData
):
  | { ok: true; data: z.infer<T> }
  | { ok: false; result: AdminResult } {
  const parsed = schema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return {
      ok: false,
      result: {
        ok: false,
        error: "Please check the highlighted fields.",
        fields: fieldErrors(parsed.error),
      },
    };
  }
  return { ok: true, data: parsed.data };
}

/**
 * Wraps an admin mutation so a thrown ForbiddenError becomes a clean result
 * instead of a Next.js error overlay, and unexpected failures are logged
 * rather than leaked to the client.
 */
export async function runAction(
  label: string,
  fn: () => Promise<AdminResult>
): Promise<AdminResult> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    console.error(`${label} failed`, err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/**
 * Public pages are cached with ISR, so an admin edit is invisible until the
 * affected paths are revalidated.
 */
export function revalidateContent(paths: string[] = []) {
  for (const p of ["/doctor", "/patient/skin-analyzer", ...paths]) {
    revalidatePath(p);
  }
}
