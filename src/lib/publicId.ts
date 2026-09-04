import { randomInt } from "node:crypto";

/**
 * The identifier a person is quoted, on paper and on the phone.
 *
 * Every record here already has a cuid, which is exactly right for a foreign
 * key and useless for a human: nobody reads `cmf3k2p9x0001qp7g8h2n4v6z` down a
 * phone line, and it will not fit the "Patient ID" box on an aftercare sheet.
 *
 * ── Why patients and doctors cannot be mistaken for each other ───────────
 * A single glance has to separate them, because these travel on documents
 * that carry both. So they differ in the segment AND in length:
 *
 *   BLU-P-4K7M2Q     a person
 *   BLU-DR-9T3N6XB   a practice
 *
 * ── The alphabet ─────────────────────────────────────────────────────────
 * Crockford's base32: the digits and letters with I, L, O and U removed. The
 * first three are removed because 1/I/L and 0/O are the pairs people
 * transcribe wrongly when reading aloud, and U because dropping it means no
 * random string can spell an obscenity. `normalise()` below accepts the
 * confusable characters on input and folds them to the canonical one, so
 * somebody who types O for 0 is not told their own ID is invalid.
 *
 * ── Random, not sequential ───────────────────────────────────────────────
 * BLU-P-000001 would announce how many clients the business has and let
 * anybody walk the list. 32^6 is about a billion for patients and 32^7 about
 * 34 billion for doctors, so collisions are rare enough that a single retry on
 * the unique index is the whole strategy.
 */

/** Crockford base32, minus the confusable letters. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export const PATIENT_PREFIX = "BLU-P";
export const DOCTOR_PREFIX = "BLU-DR";
export const VENDOR_PREFIX = "BLU-V";
export const GIFT_PREFIX = "BLU-G";
export const ORDER_PREFIX = "BLU-O";
/*
 * Premises, catalogue entries and equipment.
 *
 * Added because everything a clinic quotes on paper needs a form a human can
 * read back: "which of your three branches" and "which laser" are both
 * questions somebody answers over a phone. The shapes stay distinct from the
 * identity ids — five characters, like a vendor — so nothing on a shared
 * document can be mistaken for a patient or a practice.
 */
export const CLINIC_PREFIX = "BLU-C";
export const TREATMENT_PREFIX = "BLU-T";
export const ASSET_PREFIX = "BLU-E";

const PATIENT_LENGTH = 6;
const DOCTOR_LENGTH = 7;
// Five, so a vendor id is shorter than either of the other two. Three parties
// appear on the same correspondence and each has to be distinguishable at a
// glance by shape alone, not by reading the segment carefully.
const VENDOR_LENGTH = 5;
// Longer than the identity ids, because a gift card code is a BEARER token:
// whoever can say it can spend the money. 32^8 is about a trillion, so
// guessing one is not a practical attack even against a clinic that would
// happily try the code somebody read out over the phone.
const GIFT_LENGTH = 8;
const ORDER_LENGTH = 6;
const CLINIC_LENGTH = 5;
const TREATMENT_LENGTH = 5;
const ASSET_LENGTH = 5;

function body(length: number): string {
  let out = "";
  // randomInt, not Math.random: these are quoted as identity, and a
  // predictable sequence is a different kind of value entirely.
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** A fresh patient identifier, e.g. "BLU-P-4K7M2Q". */
export function newPatientId(): string {
  return `${PATIENT_PREFIX}-${body(PATIENT_LENGTH)}`;
}

/** A fresh practitioner identifier, e.g. "BLU-DR-9T3N6XB". */
export function newDoctorId(): string {
  return `${DOCTOR_PREFIX}-${body(DOCTOR_LENGTH)}`;
}

/** A fresh vendor identifier, e.g. "BLU-V-7Q2NX". */
export function newVendorId(): string {
  return `${VENDOR_PREFIX}-${body(VENDOR_LENGTH)}`;
}

/**
 * A fresh gift card code, e.g. "BLU-G-7Q2NX4WM".
 *
 * Deliberately the longest of these. The others identify somebody who has
 * already proved who they are; this one IS the authorisation, so it has to
 * survive being guessed at rather than merely being unique.
 */
export function newGiftCardCode(): string {
  return `${GIFT_PREFIX}-${body(GIFT_LENGTH)}`;
}

/** A fresh order reference, e.g. "BLU-O-4K7M2Q". */
export function newOrderId(): string {
  return `${ORDER_PREFIX}-${body(ORDER_LENGTH)}`;
}

/** A fresh clinic identifier, e.g. "BLU-C-7Q2NX". */
export function newClinicId(): string {
  return `${CLINIC_PREFIX}-${body(CLINIC_LENGTH)}`;
}

/** A fresh treatment identifier, e.g. "BLU-T-4K7M2". */
export function newTreatmentId(): string {
  return `${TREATMENT_PREFIX}-${body(TREATMENT_LENGTH)}`;
}

/** A fresh equipment identifier, e.g. "BLU-E-9T3N6". */
export function newAssetId(): string {
  return `${ASSET_PREFIX}-${body(ASSET_LENGTH)}`;
}

/**
 * Fold what somebody typed into the canonical form.
 *
 * Case, spacing and the confusable characters are all forgiven, because the
 * commonest use of one of these is a receptionist reading it off a printed
 * sheet. Refusing "blu p 4k7m2q" would be pedantry aimed at the wrong person.
 */
export function normalise(input: string): string {
  const cleaned = input
    .toUpperCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const at = cleaned.lastIndexOf("-");
  if (at < 0) return cleaned;

  const prefix = cleaned.slice(0, at);
  const tail = cleaned
    .slice(at + 1)
    // I and L are read as 1, O as 0. U never appears, so anyone who typed one
    // has misread a V.
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0")
    .replace(/U/g, "V");

  return `${prefix}-${tail}`;
}

export function isPatientId(value: string): boolean {
  return new RegExp(`^${PATIENT_PREFIX}-[${ALPHABET}]{${PATIENT_LENGTH}}$`).test(
    normalise(value)
  );
}

export function isDoctorId(value: string): boolean {
  return new RegExp(`^${DOCTOR_PREFIX}-[${ALPHABET}]{${DOCTOR_LENGTH}}$`).test(
    normalise(value)
  );
}

export function isVendorId(value: string): boolean {
  return new RegExp(`^${VENDOR_PREFIX}-[${ALPHABET}]{${VENDOR_LENGTH}}$`).test(
    normalise(value)
  );
}

export function isGiftCardCode(value: string): boolean {
  return new RegExp(`^${GIFT_PREFIX}-[${ALPHABET}]{${GIFT_LENGTH}}$`).test(
    normalise(value)
  );
}

export function isOrderId(value: string): boolean {
  return new RegExp(`^${ORDER_PREFIX}-[${ALPHABET}]{${ORDER_LENGTH}}$`).test(
    normalise(value)
  );
}

export function isClinicId(value: string): boolean {
  return new RegExp(`^${CLINIC_PREFIX}-[${ALPHABET}]{${CLINIC_LENGTH}}$`).test(
    normalise(value)
  );
}

export function isTreatmentId(value: string): boolean {
  return new RegExp(
    `^${TREATMENT_PREFIX}-[${ALPHABET}]{${TREATMENT_LENGTH}}$`
  ).test(normalise(value));
}

export function isAssetId(value: string): boolean {
  return new RegExp(`^${ASSET_PREFIX}-[${ALPHABET}]{${ASSET_LENGTH}}$`).test(
    normalise(value)
  );
}

/**
 * Keep asking for a fresh id until one is free.
 *
 * The unique index is the arbiter, not a pre-flight SELECT: two requests can
 * both find an id unused and then both insert it. `taken` is expected to be a
 * function that attempts the write and reports a duplicate, so the check and
 * the claim are the same operation.
 *
 * Six attempts is not a guess about collision odds, which are negligible. It
 * is a bound so that a genuinely broken index fails loudly instead of spinning.
 */
export async function claimId(
  make: () => string,
  attempt: (id: string) => Promise<boolean>,
  tries = 6
): Promise<string> {
  for (let i = 0; i < tries; i++) {
    const id = make();
    if (await attempt(id)) return id;
  }
  throw new Error("Could not allocate a public id after several attempts.");
}
