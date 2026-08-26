"use client";

import Link from"next/link";
import { usePathname } from"next/navigation";
import { signOut, useSession } from"next-auth/react";
import { useEffect, useRef, useState } from"react";
import Avatar from "@/components/Avatar";

const ROLE_LABEL: Record<string, string> = {
  ADMIN:"Administrator",
  DOCTOR:"Doctor",
  PATIENT:"Consultation",
};

/** Links offered per role, beyond the shared ones. */
export interface AccountLink {
  label: string;
  href: string;
  /**
   * One line saying where the link goes.
   *
   * Every other item in the mobile drawer carries one, and the account rows
   * did not, which is part of why they read as an afterthought stapled to the
   * bottom of the menu. The desktop dropdown deliberately ignores these: it is
   * a small popover where two-line rows would double its height for no gain.
   */
  tagline?: string;
}

export function linksFor(role: string): AccountLink[] {
  if (role ==="ADMIN") {
    return [
      { label:"Admin dashboard", href:"/admin", tagline:"The platform at a glance" },
      { label:"Enquiries", href:"/admin/enquiries", tagline:"Messages sent from the site" },
      { label:"Appointments", href:"/admin/appointments", tagline:"Every booking, across all doctors" },
    ];
  }
  if (role ==="DOCTOR") {
    // "Doctor portal" and "My appointments" both pointed at /doctor/portal —
    // two rows, one destination. These are the portal's actual sections.
    return [
      { label:"Today", href:"/doctor/portal", tagline:"Your day, visit by visit" },
      { label:"Calendar", href:"/doctor/portal/calendar", tagline:"Your diary across every clinic" },
      { label:"My practice", href:"/doctor/portal/practice", tagline:"Clinics, hours and fees" },
      { label:"My profile", href:"/doctor/portal/profile", tagline:"How clients see you" },
    ];
  }
  return [
    { label:"My appointments", href:"/patient/appointments", tagline:"Upcoming visits and everything past" },
    { label:"My profile", href:"/patient/profile", tagline:"Reports, wallet, prescriptions and treatments" },
  ];
}

export default function AccountMenu() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key ==="Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Close the menu when navigating.
  useEffect(() => setOpen(false), [pathname]);

  if (status ==="loading") {
    return <span className="h-9 w-9 animate-pulse rounded-full bg-white/10" />;
  }

  if (status !=="authenticated" || !session?.user) {
    return (
      // Solid white, not a translucent ghost. This sits over the hero
      // photograph, and a white-on-white-ish button vanishes wherever the
      // image happens to be bright.
      <Link
        href={`/login?callbackUrl=${encodeURIComponent(pathname ??"/")}`}
        className="inline-flex items-center rounded-full border border-transparent bg-white px-5 py-2 [.theme-light_&]:border-slate-300 text-sm font-bold text-[var(--on-sheet)] shadow-[0_2px_12px_-2px_rgba(0,0,0,0.35)] transition hover:bg-teal-100"
      >
        Sign in
      </Link>
    );
  }

  const { name, email, role, image } = session.user;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-full ring-2 ring-white transition hover:opacity-90"
      >
        {/* A drawn figure rather than the first letter of the name. See
            Avatar.tsx — the initial was unrecognisable across screens and
            said nothing about whether this was a doctor or a client. */}
        <Avatar
          src={image}
          alt={name ?? email ?? "Your account"}
          role={
            role === "DOCTOR" ? "doctor" : role === "ADMIN" ? "admin" : "patient"
          }
          size={36}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-60 animate-scale-in overflow-hidden rounded-2xl sheet p-2"
        >
          <div className="border-b border-white/10 px-3 pb-3 pt-2">
            <p className="truncate text-sm font-semibold text-ink">
              {name ??"Your account"}
            </p>
            <p className="truncate text-xs text-ink-muted">{email}</p>
            <span className="mt-1.5 inline-flex rounded-full bg-brand-400/[12%] px-2 py-0.5 text-[11px] font-semibold text-brand-200">
              {ROLE_LABEL[role] ?? role}
            </span>
          </div>

          <div className="py-1">
            {linksFor(role).map((l) => (
              <Link
                key={l.href}
                href={l.href}
                role="menuitem"
                className="block rounded-xl px-3 py-2 text-sm text-ink-soft transition-colors hover:bg-brand-400/[12%] hover:text-brand-200"
              >
                {l.label}
              </Link>
            ))}
          </div>

          <div className="border-t border-white/10 pt-1">
            <button
              role="menuitem"
              onClick={() => signOut({ callbackUrl:"/" })}
              className="block w-full rounded-xl px-3 py-2 text-left text-sm text-rose-600 transition-colors hover:bg-rose-500/[12%]"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
