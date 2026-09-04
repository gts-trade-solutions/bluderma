import Link from "next/link";

import BrandLogo from "./BrandLogo";

const legal = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Use", href: "/terms" },
  { label: "Client Rights", href: "/client-rights" },
  { label: "Precautions", href: "/precautions" },
];

/**
 * `audience` decides which "Explore" column is printed.
 *
 * The client list — Treatments, Doctors, DIY Diagnosis — is now unreachable
 * for a signed-in practitioner (middleware confines them to /doctor), so
 * printing it on the practitioner pages offered four links that all bounce
 * back to the portal. The doctor column names the things a practitioner can
 * actually open.
 */
export default function Footer({
  audience = "client",
}: {
  audience?: "client" | "doctor";
}) {
  const clinical = audience === "doctor";
  return (
    <footer id="contact" className="on-dark bg-brand-950 text-brand-100">
      <div className="container-page grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <BrandLogo href={clinical ? "/doctor" : "/"} tone="light" size={54} />

          <p className="mt-4 max-w-md text-sm leading-relaxed text-brand-200/80">
            A dermatology and aesthetic treatment reference connecting
            evidence-based skin solutions with the professionals and clients who
            need them. Content is for informational purposes only and does not
            replace an in-person medical consultation.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-white">Explore</h4>
          <ul className="mt-4 space-y-2 text-sm">
            {/* The client destinations. Not a mirror of the navbar — profile
                lives in the account menu, and Rx Skin, Before & After and
                Know Yourself are reached from the hub where they sit in
                context. */}
            {(clinical
              ? [
                  { href: "/doctor", label: "Why list with us" },
                  { href: "/doctor/join", label: "List your practice" },
                  { href: "/doctor/portal", label: "Your portal" },
                ]
              : [
                  { href: "/", label: "Home" },
                  { href: "/patient/explore", label: "Treatments" },
                  { href: "/patient/doctors", label: "Doctors" },
                  { href: "/patient/skin-analyzer", label: "DIY Diagnosis" },
                ]
            ).map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-white">Get in touch</h4>
          <ul className="mt-4 space-y-2 text-sm text-brand-200/80">
            <li>
              <a
                href="mailto:info@bluderma.kr"
                className="hover:text-white"
              >
                info@bluderma.kr
              </a>
            </li>
          </ul>
          {/* The doctor side is a whole audience. It must be reachable from
              the page itself, not only from a first-visit dialog somebody
              dismissed months ago. */}
          <h4 className="mt-6 text-sm font-semibold text-white">
            {clinical ? "Support" : "For doctors"}
          </h4>
          <ul className="mt-4 space-y-2 text-sm text-brand-200/80">
            <li>
              <Link
                href={clinical ? "/doctor/portal/practice" : "/doctor"}
                className="hover:text-white"
              >
                {clinical ? "Your practice settings" : "List your practice"}
              </Link>
            </li>
            {/* The portal link that used to sit here is gone. A footer is
                where somebody looks for a page they have not been to; a
                practitioner returning to their own portal is doing the
                opposite, and that route now lives behind the avatar with the
                rest of their sections. What is left is the pitch, which is
                the one thing a footer should carry for an audience that has
                not arrived yet. */}
          </ul>

          <h4 className="mt-6 text-sm font-semibold text-white">Legal</h4>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-brand-300/70">
            {legal.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-xs text-brand-300/70 sm:flex-row">
          <p>© {new Date().getFullYear()} BluDerma. All rights reserved.</p>
          <p>
            For informational use only, not a substitute for professional
            medical advice.
          </p>
        </div>
      </div>
    </footer>
  );
}
