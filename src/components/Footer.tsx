import Link from "next/link";

import BrandLogo from "./BrandLogo";
import FooterSignIn from "./FooterSignIn";

const legal = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Use", href: "/terms" },
  { label: "Client Rights", href: "/client-rights" },
  { label: "Precautions", href: "/precautions" },
];

export default function Footer() {
  return (
    <footer id="contact" className="bg-brand-950 text-brand-100">
      <div className="container-page grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <BrandLogo href="/" tone="light" size={54} />

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
            <li>
              <Link href="/" className="hover:text-white">
                Home
              </Link>
            </li>
            <li>
              <Link href="/patient/explore" className="hover:text-white">
                Treatments
              </Link>
            </li>
            <li>
              <Link href="/patient/doctors" className="hover:text-white">
                Doctors
              </Link>
            </li>
            <li>
              <Link href="/patient/skin-analyzer" className="hover:text-white">
                DIY Diagnosis
              </Link>
            </li>
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
            <li>Mon–Fri, 9:00–18:00 KST</li>
          </ul>
          {/* The doctor side is a whole audience. It must be reachable from
              the page itself, not only from a first-visit dialog somebody
              dismissed months ago. */}
          <h4 className="mt-6 text-sm font-semibold text-white">
            For doctors
          </h4>
          <ul className="mt-4 space-y-2 text-sm text-brand-200/80">
            <li>
              <Link href="/doctor" className="hover:text-white">
                List your practice
              </Link>
            </li>
            {/* Gated on the session — see the component. This used to offer
                "Doctor sign in" to signed-in doctors, and to clients who were
                then bounced when they followed it. */}
            <FooterSignIn />
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
            For informational use only — not a substitute for professional
            medical advice.
          </p>
        </div>
      </div>
    </footer>
  );
}
