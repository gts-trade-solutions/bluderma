import Link from "next/link";

import BrandLogo from "./BrandLogo";

const socials = [
  {
    label: "Instagram",
    href: "#",
    icon: (
      <path
        d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm5-2.2a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8ZM7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
    ),
  },
  {
    label: "WhatsApp",
    href: "#",
    icon: (
      <path
        d="M12 4a8 8 0 0 0-6.9 12l-1 4 4.1-1A8 8 0 1 0 12 4Zm-2.4 4.2c.2 0 .4 0 .5.4l.7 1.6c.1.2 0 .4 0 .5l-.5.6c-.1.2-.2.3 0 .6a6 6 0 0 0 2.7 2.3c.3.1.4 0 .6-.1l.6-.7c.1-.2.3-.2.5-.1l1.6.8c.2.1.3.2.3.4 0 .6-.9 1.3-1.5 1.3a6.7 6.7 0 0 1-5.8-5.9c0-.7.6-1.5 1.2-1.5Z"
        fill="currentColor"
      />
    ),
  },
  {
    label: "Facebook",
    href: "#",
    icon: (
      <path
        d="M13.5 21v-7h2.3l.4-2.7h-2.7V9.5c0-.8.2-1.3 1.3-1.3H16V5.8c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.1H7.8V14h2.3v7h3.4Z"
        fill="currentColor"
      />
    ),
  },
  {
    label: "TikTok",
    href: "#",
    icon: (
      <path
        d="M14 4c.3 1.9 1.4 3.2 3.3 3.4v2.3c-1.1.1-2.2-.2-3.2-.8v5.3a4.6 4.6 0 1 1-4.6-4.6c.2 0 .5 0 .7.1v2.4a2.2 2.2 0 1 0 1.5 2.1V4H14Z"
        fill="currentColor"
      />
    ),
  },
];

const legal = [
  "Privacy Policy",
  "Terms of Use",
  "Patient Rights",
  "Precautions",
];

export default function Footer() {
  return (
    <footer id="contact" className="bg-brand-950 text-brand-100">
      <div className="container-page grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <BrandLogo tone="light" />

          <p className="mt-4 max-w-md text-sm leading-relaxed text-brand-200/80">
            A dermatology and aesthetic treatment reference connecting
            evidence-based skin solutions with the professionals and patients who
            need them. Content is for informational purposes only and does not
            replace an in-person medical consultation.
          </p>
          <div className="mt-6 flex gap-3">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                aria-label={s.label}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition hover:bg-white/20"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5">
                  {s.icon}
                </svg>
              </a>
            ))}
          </div>
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
                Patient hub
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
            <li>enquiries@bluderma.example</li>
            <li>+91 00000 00000</li>
            <li>Mon–Sat, 9:00–18:00 IST</li>
          </ul>
          <h4 className="mt-6 text-sm font-semibold text-white">Legal</h4>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-brand-300/70">
            {legal.map((l) => (
              <li key={l}>
                <a href="#" className="hover:text-white">
                  {l}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-xs text-brand-300/70 sm:flex-row">
          <p>© {new Date().getFullYear()} BluDerma. All rights reserved.</p>
          <p>MVP demo · Frontend only · Not medical advice.</p>
        </div>
      </div>
    </footer>
  );
}
