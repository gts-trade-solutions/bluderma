"use client";

import Link from"next/link";
import { usePathname } from"next/navigation";
import { signOut, useSession } from"next-auth/react";
import { useEffect, useRef, useState } from"react";

const ROLE_LABEL: Record<string, string> = {
  ADMIN:"Administrator",
  DOCTOR:"Doctor",
  PATIENT:"Consultation",
};

/** Links offered per role, beyond the shared ones. */
export function linksFor(role: string): { label: string; href: string }[] {
  if (role ==="ADMIN") {
    return [
      { label:"Admin dashboard", href:"/admin" },
      { label:"Enquiries", href:"/admin/enquiries" },
      { label:"Appointments", href:"/admin/appointments" },
    ];
  }
  if (role ==="DOCTOR") {
    // "Doctor portal" and "My appointments" both pointed at /doctor/portal —
    // two rows, one destination. These are the portal's actual sections.
    return [
      { label:"Today", href:"/doctor/portal" },
      { label:"Calendar", href:"/doctor/portal/calendar" },
      { label:"My practice", href:"/doctor/portal/practice" },
      { label:"My profile", href:"/doctor/portal/profile" },
    ];
  }
  return [
    { label:"My appointments", href:"/patient/appointments" },
    { label:"My profile", href:"/patient/profile" },
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
        className="inline-flex items-center rounded-full border border-transparent bg-white px-5 py-2 [.theme-light_&]:border-slate-300 text-sm font-bold text-[#070d1c] shadow-[0_2px_12px_-2px_rgba(0,0,0,0.35)] transition hover:bg-teal-100"
      >
        Sign in
      </Link>
    );
  }

  const { name, email, role, image } = session.user;
  const initial = (name ?? email ??"?").trim().charAt(0).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-brand-600 text-sm font-bold text-white ring-2 ring-white transition hover:bg-brand-700"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          initial
        )}
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
