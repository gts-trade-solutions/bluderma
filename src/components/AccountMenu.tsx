"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrator",
  DOCTOR: "Clinician",
  PATIENT: "Consultation",
};

/** Links offered per role, beyond the shared ones. */
function linksFor(role: string): { label: string; href: string }[] {
  if (role === "ADMIN") {
    return [
      { label: "Admin dashboard", href: "/admin" },
      { label: "Enquiries", href: "/admin/enquiries" },
      { label: "Appointments", href: "/admin/appointments" },
    ];
  }
  if (role === "DOCTOR") {
    return [
      { label: "My appointments", href: "/doctor/portal" },
      { label: "My profile", href: "/doctor/portal/profile" },
    ];
  }
  return [
    { label: "My appointments", href: "/patient/appointments" },
    { label: "My profile", href: "/patient/profile" },
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
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Close the menu when navigating.
  useEffect(() => setOpen(false), [pathname]);

  if (status === "loading") {
    return <span className="h-9 w-9 animate-pulse rounded-full bg-slate-100" />;
  }

  if (status !== "authenticated" || !session?.user) {
    return (
      <Link
        href={`/login?callbackUrl=${encodeURIComponent(pathname ?? "/")}`}
        className="btn-ghost !px-4 !py-2"
      >
        Sign in
      </Link>
    );
  }

  const { name, email, role, image } = session.user;
  const initial = (name ?? email ?? "?").trim().charAt(0).toUpperCase();

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
          className="absolute right-0 top-full z-50 mt-2 w-60 animate-scale-in overflow-hidden rounded-2xl bg-white p-2 shadow-card ring-1 ring-black/[0.06]"
        >
          <div className="border-b border-slate-100 px-3 pb-3 pt-2">
            <p className="truncate text-sm font-semibold text-ink">
              {name ?? "Your account"}
            </p>
            <p className="truncate text-xs text-ink-muted">{email}</p>
            <span className="mt-1.5 inline-flex rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
              {ROLE_LABEL[role] ?? role}
            </span>
          </div>

          <div className="py-1">
            {linksFor(role).map((l) => (
              <Link
                key={l.href}
                href={l.href}
                role="menuitem"
                className="block rounded-xl px-3 py-2 text-sm text-ink-soft transition-colors hover:bg-brand-50 hover:text-brand-700"
              >
                {l.label}
              </Link>
            ))}
          </div>

          <div className="border-t border-slate-100 pt-1">
            <button
              role="menuitem"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="block w-full rounded-xl px-3 py-2 text-left text-sm text-rose-600 transition-colors hover:bg-rose-50"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
