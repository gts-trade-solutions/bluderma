/**
 * The value whose unique index prevents two people holding one slot.
 *
 * ── Why this is its own module ───────────────────────────────────────────
 * `Appointment.slotLock` is a real column the app writes, not a generated
 * one, and the unique index on it is the ONLY thing standing between the
 * booking flow and a double booking. Two places now write it — booking, and
 * the hand-over flow that moves an appointment to another practitioner — and
 * two copies of a format string that must match exactly is a bug waiting for
 * the day somebody changes one of them.
 *
 * It cannot live in either caller: both are `"use server"` files, where every
 * export has to be an async function.
 */

/** "<doctorId>@<ISO datetime>". Null once the appointment is cancelled. */
export function slotLockFor(doctorId: string, at: Date): string {
  return `${doctorId}@${at.toISOString()}`;
}
