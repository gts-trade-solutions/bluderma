import type { VisitReason, SymptomDuration } from "@prisma/client";

/**
 * The vocabulary of "why am I coming in", shared by every surface that shows
 * it.
 *
 * The booking form, the doctor's drawer, the day list, the requests queue and
 * the notification emails all render the same booking. Before this they would
 * each have spelled the reason their own way, or — more often — shown nothing
 * at all, because the only thing captured was an optional free-text note that
 * patients almost never filled in. One table, read by all of them.
 */

export interface Choice<T extends string> {
  value: T;
  /** What the patient reads while booking. */
  label: string;
  /** What the doctor reads afterwards. Usually the same. */
  clinical?: string;
  /** Shown under the label in the booking form. */
  hint?: string;
}

export const VISIT_REASONS: Choice<VisitReason>[] = [
  { value: "ACNE", label: "Acne or breakouts", hint: "Pimples, blackheads, oily skin" },
  { value: "PIGMENTATION", label: "Pigmentation or dark spots", hint: "Melasma, tanning, uneven tone" },
  { value: "HAIR_LOSS", label: "Hair loss or thinning", hint: "Shedding, receding, patchy loss" },
  { value: "ANTI_AGEING", label: "Fine lines and ageing", hint: "Wrinkles, sagging, dull skin" },
  { value: "SCARS", label: "Scars or marks", hint: "Acne scars, injury marks, stretch marks" },
  { value: "ROSACEA_REDNESS", label: "Redness or sensitivity", hint: "Flushing, burning, reactive skin" },
  { value: "ECZEMA_PSORIASIS", label: "Rash, itching or flaking", hint: "Eczema, psoriasis, dermatitis" },
  { value: "FUNGAL_INFECTION", label: "Infection", hint: "Fungal, bacterial, warts" },
  { value: "MOLE_CHECK", label: "Mole or growth check", hint: "Something new or changing" },
  { value: "COSMETIC_PROCEDURE", label: "A treatment I want", hint: "Peel, laser, filler, botox" },
  { value: "FOLLOW_UP", label: "Follow-up on earlier treatment" },
  { value: "OTHER", label: "Something else" },
];

export const SYMPTOM_DURATIONS: Choice<SymptomDuration>[] = [
  { value: "UNDER_WEEK", label: "Less than a week" },
  { value: "WEEKS_1_4", label: "A few weeks" },
  { value: "MONTHS_1_6", label: "1 to 6 months" },
  { value: "MONTHS_6_12", label: "6 to 12 months" },
  { value: "OVER_YEAR", label: "More than a year" },
];

/**
 * Self-rated severity.
 *
 * Deliberately worded as impact on daily life rather than as a clinical
 * grade — a patient cannot grade their own acne, but they can say whether it
 * stops them leaving the house, and that is the part that decides urgency.
 */
export const SEVERITIES: { value: number; label: string; short: string }[] = [
  { value: 1, label: "Barely noticeable", short: "Very mild" },
  { value: 2, label: "Noticeable but not bothering me much", short: "Mild" },
  { value: 3, label: "Bothers me most days", short: "Moderate" },
  { value: 4, label: "Affects what I do or wear", short: "Marked" },
  { value: 5, label: "Painful, or badly affecting daily life", short: "Severe" },
];

/**
 * The permitted values, as plain literals.
 *
 * Deliberately derived from the tables above rather than from the generated
 * Prisma enum object. Reading `VisitReason` as a *value* means the schema only
 * works when the generated client in node_modules is current — a dev server
 * started before the last `prisma generate` hands it `undefined`, and
 * z.nativeEnum(undefined) throws "Cannot convert undefined or null to object"
 * while rendering, far from the cause. It also drags @prisma/client into any
 * bundle that validates input. These arrays have neither problem; the suite
 * checks them against the real enum so they cannot silently drift.
 */
export const VISIT_REASON_VALUES = VISIT_REASONS.map((r) => r.value) as [
  VisitReason,
  ...VisitReason[],
];

export const SYMPTOM_DURATION_VALUES = SYMPTOM_DURATIONS.map((d) => d.value) as [
  SymptomDuration,
  ...SymptomDuration[],
];

const REASON_LABEL = new Map(VISIT_REASONS.map((r) => [r.value, r]));
const DURATION_LABEL = new Map(SYMPTOM_DURATIONS.map((d) => [d.value, d]));
const SEVERITY_LABEL = new Map(SEVERITIES.map((s) => [s.value, s]));

export function reasonLabel(v: VisitReason | null | undefined): string | null {
  if (!v) return null;
  const c = REASON_LABEL.get(v);
  return c ? c.clinical ?? c.label : v;
}

export function durationLabel(v: SymptomDuration | null | undefined): string | null {
  if (!v) return null;
  return DURATION_LABEL.get(v)?.label ?? v;
}

export function severityLabel(v: number | null | undefined): string | null {
  if (v == null) return null;
  const s = SEVERITY_LABEL.get(v);
  return s ? `${v}/5 · ${s.short}` : `${v}/5`;
}

/** Severity high enough that a doctor should see it before the day arrives. */
export function isUrgent(severity: number | null | undefined): boolean {
  return (severity ?? 0) >= 4;
}

/**
 * A one-line summary for places with no room for the full intake — the day
 * list, the requests queue, a notification subject.
 */
export function intakeSummary(a: {
  reason: VisitReason | null;
  symptomDuration: SymptomDuration | null;
  severity: number | null;
  isFirstVisit: boolean;
}): string {
  const bits = [
    reasonLabel(a.reason),
    durationLabel(a.symptomDuration),
    a.severity != null ? severityLabel(a.severity) : null,
    a.isFirstVisit ? "First visit" : "Follow-up",
  ].filter(Boolean);
  return bits.length ? bits.join(" · ") : "No reason given";
}

/**
 * Plain-text block for the emails a doctor gets.
 *
 * Kept here rather than inline in the mailer so the wording cannot drift from
 * what the portal shows for the same booking.
 */
export function intakeEmailBlock(a: {
  reason: VisitReason | null;
  reasonDetail: string | null;
  symptomDuration: SymptomDuration | null;
  severity: number | null;
  priorTreatment: string | null;
  medications: string | null;
  allergies: string | null;
  isFirstVisit: boolean;
  patientAge: number | null;
  patientGender: string | null;
}): string {
  const lines: string[] = [];
  const push = (k: string, v: string | null | undefined) => {
    if (v && v.trim()) lines.push(`${k}: ${v.trim()}`);
  };

  push("Reason", reasonLabel(a.reason));
  push("How long", durationLabel(a.symptomDuration));
  push("Severity", severityLabel(a.severity));
  lines.push(`Visit: ${a.isFirstVisit ? "First visit" : "Follow-up"}`);
  const who = [
    a.patientAge != null ? `${a.patientAge}y` : null,
    a.patientGender && a.patientGender !== "UNDISCLOSED" ? a.patientGender.toLowerCase() : null,
  ].filter(Boolean);
  if (who.length) lines.push(`Patient: ${who.join(", ")}`);
  push("In their words", a.reasonDetail);
  push("Already tried", a.priorTreatment);
  push("Medication", a.medications);
  // Allergies are the one field where "none" is worth printing, because a
  // blank line reads as "not asked" and this one always is.
  lines.push(`Allergies: ${a.allergies?.trim() || "none reported"}`);

  return lines.join("\n");
}
