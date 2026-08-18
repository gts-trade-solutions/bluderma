import Link from "next/link";

/**
 * A shortcut to the clinician side, for the testing phase.
 *
 * The client home page and the practitioner home page are two front doors for
 * two audiences, and during testing you need to hop between them constantly.
 * The permanent route in is "For clinicians" in the nav and the footer, which
 * is deliberately understated because most visitors are clients — fine in
 * production, tedious when you are checking both sides twenty times an hour.
 *
 * DELIBERATELY UGLY. Dashed amber, a "testing" label, and nothing that looks
 * like product UI — so nobody mistakes it for a design decision, and so it is
 * obvious in a screenshot that this build is not the real thing.
 *
 * IT CANNOT REACH REAL PRODUCTION BY ACCIDENT. It renders when the app is in
 * development, or when NEXT_PUBLIC_TESTING_LINKS is explicitly set to "1" —
 * which is what you would set on a staging deploy. A production build with no
 * flag renders nothing at all, so removing it later is a matter of not
 * setting a variable rather than remembering to delete a component.
 */
export function testingLinksEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_TESTING_LINKS === "1") return true;
  // Never on in production unless the flag above says so.
  return process.env.NODE_ENV === "development";
}

export default function TestingShortcut({
  /**
   * Which side the reader is currently on. The button offers the OTHER one —
   * during testing you cross over constantly, and from /doctor there is no
   * obvious way back to the client home except the footer.
   */
  from = "client",
}: {
  from?: "client" | "clinic";
}) {
  if (!testingLinksEnabled()) return null;

  const onClient = from === "client";

  return (
    <div
      className={`border-b border-dashed ${
        onClient
          ? "border-amber-400/40 bg-amber-400/[0.07]"
          : "border-amber-500/50 bg-amber-50"
      }`}
    >
      <div className="container-page flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
        <span
          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ${
            onClient
              ? "bg-amber-400/20 text-amber-200"
              : "bg-amber-200 text-amber-900"
          }`}
        >
          Testing build
        </span>

        <p className={`text-sm ${onClient ? "text-amber-100/70" : "text-amber-800"}`}>
          You are on the {onClient ? "client" : "clinic"} side.
        </p>

        <Link
          href={onClient ? "/doctor" : "/"}
          className={`ml-auto inline-flex items-center gap-2 rounded-md border px-4 py-1.5 text-sm font-bold transition ${
            onClient
              ? "border-amber-300/50 bg-amber-400/15 text-amber-100 hover:bg-amber-400/25"
              : "border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200"
          }`}
        >
          Go to the {onClient ? "clinic" : "client"} side
          <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}
