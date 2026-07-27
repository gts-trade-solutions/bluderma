import Link from "next/link";

import BrandLogo from "./BrandLogo";

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
          <BrandLogo tone="light" size={72} />

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
            <li>
              <Link href="/doctor" className="hover:text-white">
                Doctor hub
              </Link>
            </li>
            <li>
              <Link href="/patient" className="hover:text-white">
                Client hub
              </Link>
            </li>
            <li>
              <a href="#treatments" className="hover:text-white">
                All treatments
              </a>
            </li>
            <li>
              <a href="#pricing" className="hover:text-white">
                Pricing &amp; enquiry
              </a>
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
