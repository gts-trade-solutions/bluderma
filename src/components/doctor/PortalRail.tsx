"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

import BrandLogo from "@/components/BrandLogo";
import { GlyphIcon } from "./portalUi";

/**
 * The portal's navigation rail.
 *
 * Dark, and deliberately the only dark surface in the portal. A practitioner
 * reads this screen across a whole clinic day and the calendar depends on
 * high-contrast colour coding, so the working canvas stays light — but the
 * chrome is where the brand lives, and a grey tab strip on a grey page was
 * what made this feel like somebody's internal tool rather than the product.
 *
 * On a phone it becomes a slide-in drawer behind a compact top bar, because a
 * fixed 16rem rail on a 375px screen leaves nothing for the appointment list.
 */

export interface RailItem {
  label: string;
  href: string;
  icon: string;
  /** Matched exactly rather than by prefix — /doctor/portal is every page. */
  exact?: boolean;
  badge?: number;
  /**
   * Shown but not navigable, with a reason. Used while a practitioner is still
   * being set up: the pages behind these still work if typed directly (the
   * guard is deliberately status-blind), so this is wayfinding rather than
   * authorisation — it says "not yet", not "not allowed".
   */
  locked?: string;
}

export default function PortalRail({
  items,
  doctorName,
  clinicName,
  status,
}: {
  items: RailItem[];
  doctorName: string;
  clinicName: string | null;
  /** DRAFT | PENDING | APPROVED | REJECTED | SUSPENDED */
  status: string;
}) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);

  // A drawer that survives the navigation it caused is a drawer covering the
  // page you just asked for.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onEsc);
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (item: RailItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {items.map((item) => {
        const active = isActive(item);
        if (item.locked) {
          return (
            <span
              key={item.href}
              title={item.locked}
              aria-disabled="true"
              className="rail-wide flex cursor-default items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/25"
            >
              <span className="text-white/20">
                <GlyphIcon name={item.icon} />
              </span>
              <span className="rail-label min-w-0 flex-1 truncate">{item.label}</span>
              <span aria-hidden className="rail-label text-white/20">
                <GlyphIcon name="lock" />
              </span>
            </span>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={`rail-wide group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              active
                ? "bg-gradient-to-r from-white/[0.12] to-white/[0.04] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                : "text-white/55 hover:bg-white/[0.05] hover:text-white/90"
            }`}
          >
            {/* The active marker is a teal edge rather than a filled pill —
                it reads at a glance without competing with the badge. */}
            <span
              aria-hidden
              className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-teal-400 transition-opacity ${
                active ? "opacity-100" : "opacity-0"
              }`}
            />
            <span className={active ? "text-teal-300" : "text-white/45 group-hover:text-white/70"}>
              <GlyphIcon name={item.icon} />
            </span>
            <span className="rail-label min-w-0 flex-1 truncate">{item.label}</span>
            {item.badge ? (
              <span className="rail-badge grid h-5 min-w-[20px] shrink-0 place-items-center rounded-full bg-amber-400 px-1 text-[11px] font-bold text-[#0b1220]">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  const initial = doctorName.replace(/^Dr\.?\s+/i, "").trim().charAt(0).toUpperCase() || "D";

  const identity = (
    <div className="px-5 pb-5 pt-6">
      <span className="rail-label block">
        <BrandLogo href="/doctor" size={40} tone="light" />
      </span>
      {/* A monogram and a hairline of teal — the small amount of ceremony that
          separates "an internal tool" from "your practice". */}
      <div
        title={doctorName}
        className="rail-wide mt-5 flex items-center gap-3 rounded-2xl bg-gradient-to-br from-white/[0.09] to-white/[0.03] px-3.5 py-3.5 ring-1 ring-white/10"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-teal-400 to-brand-500 font-display text-base font-bold text-[#0b1220]">
          {initial}
        </span>
        <div className="rail-label min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white">{doctorName}</p>
        <p className="mt-0.5 truncate text-[11px] text-white/45">
          {clinicName || "No clinic yet"}
        </p>
        <StatusPill status={status} />
        </div>
      </div>
    </div>
  );

  const footer = (
    <div className="border-t border-white/10 p-3">
      <button
        onClick={() => signOut({ callbackUrl: "/doctor" })}
        title="Sign out"
        className="rail-wide flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/50 transition hover:bg-white/[0.05] hover:text-white/85"
      >
        <span aria-hidden className="text-white/40">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M15 17l5-5-5-5M20 12H9M12 20H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6" />
          </svg>
        </span>
        <span className="rail-label">Sign out</span>
      </button>
    </div>
  );

  return (
    <>
      {/* ── Desktop rail ──────────────────────────────────────────────── */}
      <aside className="portal-rail on-dark fixed inset-y-0 left-0 z-40 hidden flex-col bg-[#0b1220] lg:flex">
        {identity}
        {nav}
        <CollapseToggle />
        {footer}
      </aside>

      {/* ── Mobile bar ────────────────────────────────────────────────── */}
      <div className="on-dark sticky top-0 z-40 flex h-14 items-center gap-3 bg-[#0b1220] px-4 lg:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="grid h-9 w-9 place-items-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-5 w-5">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <BrandLogo href="/doctor" size={34} tone="light" />
        <span className="ml-auto truncate text-xs font-semibold text-white/50">
          {doctorName}
        </span>
        {items.some((i) => i.badge) && (
          <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-amber-400 px-1 text-[11px] font-bold text-[#0b1220]">
            {items.reduce((n, i) => n + (i.badge ?? 0), 0)}
          </span>
        )}
      </div>

      {/* ── Mobile drawer ─────────────────────────────────────────────── */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]"
          />
          <aside className="on-dark relative flex h-full w-72 max-w-[85vw] flex-col bg-[#0b1220] shadow-2xl">
            {identity}
            {nav}
            {footer}
          </aside>
        </div>
      )}
    </>
  );
}

/**
 * Collapses the rail to its glyphs, and remembers the choice.
 *
 * The state lives on `<html>` as a data attribute rather than in React. The
 * shell that has to give back its left padding is a server component, so a
 * React boolean here could not reach it without making the whole portal
 * layout client-rendered — and the CSS in globals.css does the whole job
 * from one attribute. See the note there about the pre-paint script.
 *
 * Desktop only. Below `lg` the rail is already a drawer, and a control that
 * collapses something not currently on screen is a control that does nothing.
 */
function CollapseToggle() {
  const [collapsed, setCollapsed] = useState(false);

  // Read on mount rather than during render: `document` does not exist on the
  // server, and the attribute has already been set by the inline script, so
  // this only syncs the button's own label to what is on screen.
  useEffect(() => {
    setCollapsed(
      document.documentElement.getAttribute("data-rail") === "collapsed"
    );
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    if (next) document.documentElement.setAttribute("data-rail", "collapsed");
    else document.documentElement.removeAttribute("data-rail");
    try {
      localStorage.setItem("bd-rail", next ? "collapsed" : "open");
    } catch {
      // Private browsing, or storage disabled. The rail still collapses for
      // this visit; it just will not be remembered for the next one.
    }
  }

  return (
    <div className="px-3 pb-1">
      <button
        onClick={toggle}
        title={collapsed ? "Expand the menu" : "Collapse the menu"}
        aria-label={collapsed ? "Expand the menu" : "Collapse the menu"}
        className="rail-wide flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/40 transition hover:bg-white/[0.05] hover:text-white/80"
      >
        <span aria-hidden className="shrink-0">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-5 w-5 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
          >
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </span>
        <span className="rail-label">Collapse menu</span>
      </button>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "APPROVED") {
    return (
      <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-teal-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-300">
        <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
        Live
      </span>
    );
  }
  const copy: Record<string, { label: string; skin: string }> = {
    DRAFT: { label: "Draft", skin: "bg-amber-400/15 text-amber-300" },
    PENDING: { label: "In review", skin: "bg-blue-400/15 text-blue-300" },
    REJECTED: { label: "Needs changes", skin: "bg-rose-400/15 text-rose-300" },
    SUSPENDED: { label: "Paused", skin: "bg-white/10 text-white/60" },
  };
  const c = copy[status] ?? copy.PENDING;
  return (
    <span
      className={`mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${c.skin}`}
    >
      {c.label}
    </span>
  );
}
