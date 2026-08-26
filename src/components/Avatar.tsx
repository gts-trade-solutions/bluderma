/**
 * Somebody's picture, or a drawn stand-in for it.
 *
 * ── Why the initial had to go ────────────────────────────────────────────
 * Every avatar with no photograph fell back to the first letter of the name
 * on a coloured circle. Three things were wrong with it. A doctor whose
 * account was opened as "Dr. Nithya Raghavan" got an N, one opened under a
 * clinic's name got a K, and neither was recognisable as the same person
 * across two screens. It reads as a placeholder rather than as a person,
 * which is exactly what it is. And it says nothing about WHO this is — the
 * portal header and the client navbar drew the same circle for a practitioner
 * and a patient.
 *
 * A drawn figure fixes all three: it is stable, it is obviously a stand-in
 * rather than a broken image, and the doctor version wears a coat and a
 * stethoscope so the two roles are told apart at a glance.
 *
 * ── Why the mark is inline SVG ───────────────────────────────────────────
 * It inherits colour, so one component serves the navy navbar and the light
 * portal header without a second asset, and it stays sharp at 9px and at 96.
 */

export type AvatarRole = "doctor" | "patient" | "admin";

export default function Avatar({
  src,
  alt = "",
  role = "patient",
  size = 36,
  /** Extra classes on the wrapper — usually a ring. */
  className = "",
}: {
  /** The real photograph. Anything falsy falls through to the mark. */
  src?: string | null;
  alt?: string;
  role?: AvatarRole;
  size?: number;
  className?: string;
}) {
  // `align-middle` and `leading-none` so an INLINE wrapper cannot stretch the
  // box: an inline-level avatar otherwise sits on the baseline and drags the
  // line-box's descender space along with it, which turns any ring drawn by
  // the parent into an oval. See AccountMenu, where that is what happened.
  const shell = `inline-grid shrink-0 place-items-center overflow-hidden rounded-full align-middle leading-none ${className}`;

  if (src) {
    return (
      <span className={shell} style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          width={size}
          height={size}
        />
      </span>
    );
  }

  // The stand-in. Tinted by role rather than by a hash of the name: a colour
  // derived from a name changes when somebody corrects their spelling, which
  // is the opposite of an identity mark's job.
  const skin =
    role === "doctor"
      ? "bg-gradient-to-br from-brand-600 to-teal-500 text-white"
      : role === "admin"
        ? "bg-gradient-to-br on-dark from-slate-700 to-slate-500 text-white"
        : "bg-gradient-to-br from-slate-200 to-slate-300 text-slate-600";

  return (
    <span
      className={`${shell} ${skin}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={alt || (role === "doctor" ? "Doctor" : "Profile")}
    >
      {role === "doctor" ? (
        <DoctorMark size={size} />
      ) : (
        <PersonMark size={size} />
      )}
    </span>
  );
}

/** A head and shoulders. Deliberately plain: it is a placeholder, not art. */
function PersonMark({ size }: { size: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ width: size * 0.58, height: size * 0.58 }}
    >
      <circle cx="12" cy="9" r="3.4" />
      <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
    </svg>
  );
}

/**
 * The same figure in a coat, with a stethoscope.
 *
 * The lapels are what actually read at 36px — the stethoscope is a few pixels
 * and is there for the larger sizes, where its absence would look like a
 * missing detail rather than a simpler drawing.
 */
function DoctorMark({ size }: { size: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ width: size * 0.62, height: size * 0.62 }}
    >
      <circle cx="12" cy="8" r="3.2" />
      {/* Shoulders, with the coat opening. */}
      <path d="M5 20a7 7 0 0 1 4.2-6.4L12 17l2.8-3.4A7 7 0 0 1 19 20" />
      {/* Stethoscope: down one lapel, round, and up to the bell. */}
      <path d="M9.4 13.9v2.3a2.3 2.3 0 0 0 4.6 0" strokeWidth="1.3" />
      <circle cx="16.2" cy="16.4" r="1.15" strokeWidth="1.3" />
    </svg>
  );
}
