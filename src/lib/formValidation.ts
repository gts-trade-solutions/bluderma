"use client";

/**
 * Client-side validation that actually tells somebody what is wrong.
 *
 * ── The problem this replaces ────────────────────────────────────────────
 * Every long form in this app relied on two things, and between them they
 * left a gap you could lose a doctor in:
 *
 *  1. Native HTML5 `required`. The browser blocks the submit, scrolls to the
 *     FIRST empty control and shows a transient bubble on it. One field at a
 *     time, no record of the other five, and the bubble is gone the moment
 *     you look away. On a six-card onboarding step that means answering one
 *     question, pressing Save, and being sent back for the next one.
 *
 *  2. Field errors returned by the server after a submit. Genuinely good —
 *     but native validation stops the submit ever happening, so on a form
 *     with `required` fields this half never ran at all. The highlighting
 *     was written, wired up, and unreachable.
 *
 * So this sits in front: it finds EVERY problem at once, names each one,
 * marks the card it lives in, and hands back a map in exactly the shape the
 * existing FieldErrorContext already renders. The server checks stay where
 * they are — this is the fast, kind pass, not the authoritative one.
 */

export interface FieldProblem {
  /** The control's `name`, which is the key FieldErrorContext is read by. */
  name: string;
  /** What the form calls it, taken from its own <label>. */
  label: string;
  message: string;
}

export interface ValidationOutcome {
  ok: boolean;
  /** name → message, ready for FieldErrorContext. */
  fields: Record<string, string>;
  problems: FieldProblem[];
}

/**
 * Marks the section a bad field lives in. Put `data-form-section` on any
 * wrapper — Card and Panel both carry it — and the whole card takes a rose
 * outline while something inside it is unanswered. See globals.css.
 */
const SECTION_ATTR = "data-form-section";
const INVALID_ATTR = "data-invalid";

/** Controls that carry no answer and should never be reported. */
function isValidatable(el: Element): el is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  if (
    !(el instanceof HTMLInputElement) &&
    !(el instanceof HTMLSelectElement) &&
    !(el instanceof HTMLTextAreaElement)
  ) {
    return false;
  }
  if (el.disabled || !el.name) return false;
  if (el instanceof HTMLInputElement) {
    if (el.type === "hidden" || el.type === "submit" || el.type === "button" || el.type === "reset") {
      return false;
    }
  }
  // A control the browser has been told to skip.
  return !el.hasAttribute("formnovalidate");
}

/**
 * The name a person would use for this field.
 *
 * Read off the form's own markup rather than passed in, so a field that gets
 * relabelled never grows a stale error message. The trailing " *" that marks
 * a required field is stripped — "Full name * is needed" reads like a bug.
 */
function labelFor(
  form: HTMLFormElement,
  el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
): string {
  const explicit = el.id
    ? form.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(el.id)}"]`)
    : null;
  const wrapping = el.closest("label");
  const text =
    explicit?.textContent ??
    wrapping?.textContent ??
    el.getAttribute("aria-label") ??
    el.getAttribute("placeholder") ??
    "";

  const cleaned = text.replace(/\s*\*\s*$/, "").replace(/\s+/g, " ").trim();
  if (cleaned) return cleaned;

  // Last resort: turn "addressLine1" into "Address line 1".
  return el.name
    .replace(/([A-Z])/g, " $1")
    .replace(/(\d+)/g, " $1")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Our wording, not the browser's.
 *
 * "Please fill out this field" is Chrome's; Safari and Firefox each say
 * something different, and none of them name the field — which is the whole
 * point when the message has to survive being read in a list at the top of
 * the page rather than in a bubble attached to the input.
 */
function messageFor(
  el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  label: string
): string {
  const v = el.validity;

  if (v.valueMissing) {
    if (el instanceof HTMLSelectElement) return `Choose a ${label.toLowerCase()}.`;
    if (el instanceof HTMLInputElement && el.type === "checkbox") {
      return `${label} has to be ticked.`;
    }
    return `${label} is needed.`;
  }
  if (v.typeMismatch) {
    if (el instanceof HTMLInputElement && el.type === "email") {
      return "That does not look like an email address.";
    }
    if (el instanceof HTMLInputElement && el.type === "url") {
      return "That does not look like a web address.";
    }
    return `${label} is not in the right format.`;
  }
  if (v.tooShort && el instanceof HTMLInputElement) {
    return `${label} needs at least ${el.minLength} characters.`;
  }
  if (v.tooLong && el instanceof HTMLInputElement) {
    return `${label} can be at most ${el.maxLength} characters.`;
  }
  if (v.rangeUnderflow && "min" in el) {
    return `${label} cannot be less than ${(el as HTMLInputElement).min}.`;
  }
  if (v.rangeOverflow && "max" in el) {
    return `${label} cannot be more than ${(el as HTMLInputElement).max}.`;
  }
  if (v.patternMismatch) {
    return `${label} is not in the right format.`;
  }
  if (v.stepMismatch) return `${label} is not a permitted value.`;

  // Something we have not accounted for. The browser's text beats nothing.
  return el.validationMessage || `${label} needs checking.`;
}

/** Clears the marks from a previous attempt so nothing lingers once fixed. */
export function clearSectionMarks(form: HTMLFormElement): void {
  form
    .querySelectorAll(`[${SECTION_ATTR}][${INVALID_ATTR}]`)
    .forEach((el) => el.removeAttribute(INVALID_ATTR));
  // Fields marked by a previous pass. Cleared here rather than left to React
  // because most of these forms are uncontrolled and hand-rolled — there is
  // no prop to flip. Fields that render their own aria-invalid from
  // FieldErrorContext simply set it again on the next paint.
  form
    .querySelectorAll('[data-validated-invalid="true"]')
    .forEach((el) => {
      el.removeAttribute("aria-invalid");
      el.removeAttribute("data-validated-invalid");
    });
}

/**
 * Marks one control as bad.
 *
 * `aria-invalid` is what globals.css colours, and it is the one hook that
 * works for every field in the app: the shared components in ui.tsx set it
 * from context, and the two dozen hand-rolled `<label><input/></label>` forms
 * get it from here. The companion data attribute exists only so the next pass
 * knows which ones were ours to clear.
 */
function markInvalid(el: Element): void {
  el.setAttribute("aria-invalid", "true");
  el.setAttribute("data-validated-invalid", "true");
}

/**
 * Every problem on the form, in the order they appear on the page.
 *
 * Order matters: the summary at the top has to read top-to-bottom, or
 * "and three more" sends somebody scrolling in the wrong direction.
 */
export function validateForm(form: HTMLFormElement): ValidationOutcome {
  clearSectionMarks(form);

  const problems: FieldProblem[] = [];
  const fields: Record<string, string> = {};
  const seen = new Set<string>();

  for (const el of Array.from(form.elements)) {
    if (!isValidatable(el)) continue;
    if (el.checkValidity()) continue;

    // A radio group reports once per button. One entry per name.
    if (seen.has(el.name)) continue;
    seen.add(el.name);

    const label = labelFor(form, el);
    const message = messageFor(el, label);

    problems.push({ name: el.name, label, message });
    fields[el.name] = message;

    markInvalid(el);
    el.closest(`[${SECTION_ATTR}]`)?.setAttribute(INVALID_ATTR, "true");
  }

  return { ok: problems.length === 0, fields, problems };
}

/**
 * Puts the cursor in the named field and brings it into view.
 *
 * `block: "center"` rather than the default: a field scrolled to the very top
 * of the viewport loses its own label to the sticky portal header, which is a
 * particularly unhelpful place to land somebody who is looking for a label.
 */
export function focusField(form: HTMLFormElement, name: string): void {
  const el = form.querySelector<HTMLElement>(`[name="${CSS.escape(name)}"]`);
  if (!el) return;

  el.scrollIntoView({ behavior: "smooth", block: "center" });
  // Focus after the scroll starts; focusing first makes the browser jump.
  window.setTimeout(() => {
    try {
      (el as HTMLInputElement).focus({ preventScroll: true });
    } catch {
      el.focus();
    }
  }, 120);
}

/**
 * Turns a server's `name → message` map into the same shape the summary
 * renders, borrowing each field's label from the live form.
 *
 * A rule only the server can check ("that registration number is already
 * listed") should read exactly like a missing field does, and land in the
 * same list, or the form has two different vocabularies for the same idea.
 */
export function problemsFromFields(
  form: HTMLFormElement,
  fields: Record<string, string>
): FieldProblem[] {
  const out: FieldProblem[] = [];

  for (const [name, message] of Object.entries(fields)) {
    const el = form.querySelector<HTMLElement>(`[name="${CSS.escape(name)}"]`);
    const label =
      el && isValidatable(el)
        ? labelFor(form, el)
        : name.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

    out.push({ name, label, message });
    if (el) markInvalid(el);
    el?.closest(`[${SECTION_ATTR}]`)?.setAttribute(INVALID_ATTR, "true");
  }

  return out;
}
