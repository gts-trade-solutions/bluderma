"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { Experience, roleMeta } from "@/lib/roles";
import type { NavNode } from "@/lib/queries/nav";
import AccountMenu, { linksFor } from "./AccountMenu";
import BrandLogo from "./BrandLogo";
import KnowYouCta from "./hub/KnowYouCta";
import LocationButton from "./hub/LocationButton";

interface NavbarProps {
  role: Experience;
  /** Built on the server — this component can't query the database. */
  menu: NavNode[];
  /**
   * The highlighted action beside the account menu, which changes with where
   * the visitor is in the funnel:
   *   "know-you" — opens the questionnaire
   *   "none"     — nothing, leaving Sign in in the corner
   */
  cta?: "know-you" | "none";
  /** The location pill. On by default. */
  showLocation?: boolean;
  /**
   * Float the bar over a dark hero instead of sitting on a white one.
   *
   * Transparent only holds while the page is at the top — once the hero has
   * scrolled past, the bar has to go solid or the links end up sitting on
   * whatever happens to be underneath, which is usually white. Pages that
   * pass this must leave room for the bar at the top of their first section,
   * because it is taken out of the flow.
   */
  overlay?: boolean;
  /**
   * What the bar looks like once it has a background. "dark" puts it on the
   * brand navy with light type — the treatment used on pages whose chrome and
   * feature bands are navy, so the bar belongs to them rather than cutting a
   * white stripe across the top.
   */
  chrome?: "light" | "dark";
}

export default function Navbar({
  role,
  menu,
  cta = "know-you",
  showLocation = true,
  overlay = false,
  chrome = "dark",
}: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMobileGroup, setOpenMobileGroup] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!overlay) return;
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [overlay]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const pathname = usePathname();
  const { data: session, status } = useSession();
  const meta = roleMeta[role];
  // Two separate questions: does the bar have a background at all, and is
  // that background dark? Transparent-over-a-hero and navy-chrome both want
  // light type, but for different reasons.
  const opaque = !overlay || scrolled || mobileOpen;
  const onDark = !opaque || chrome === "dark";

  return (
    <>
      <header
        className={`top-0 z-40 transition-colors duration-300 ${
          overlay ? "fixed inset-x-0" : "sticky"
        } ${
          !opaque
            ? "bg-transparent"
            : chrome === "dark"
            ? "bg-[#070d1c]/95 shadow-soft backdrop-blur"
            : "bg-white/95 shadow-soft backdrop-blur"
        }`}
      >

        <div className="container-page flex h-20 items-center justify-between gap-4">
          {/* Brand */}
          {/* The logo always goes home. It used to use the role's landing
              path, which sent a client clicking the brand mark into the skin
              analyzer — never what a logo should do. */}
          <BrandLogo
            href={role === "doctor" ? "/doctor" : "/"}
            tone={onDark ? "light" : "dark"}
            size={46}
            showMark={false}
            onClick={() => setMobileOpen(false)}
          />

          {/* Desktop mega-menu */}
          <nav className="hidden items-center gap-1 lg:flex">
            {menu.map((node) => (
              <DesktopNavItem
                key={node.label}
                node={node}
                solid={!onDark}
                pathname={pathname}
              />
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex shrink-0 items-center gap-2">
            {cta === "know-you" && <KnowYouCta variant="nav" />}
            {showLocation && (
              <div className="hidden md:block">
                <LocationButton />
              </div>
            )}
            <AccountMenu />
            <button
              className={`lg:hidden ${onDark ? "text-white" : "text-ink"}`}
              aria-label="Toggle menu"
              onClick={() => setMobileOpen((v) => !v)}
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
                <path
                  d={mobileOpen ? "M6 6l12 12M18 6 6 18" : "M4 7h16M4 12h16M4 17h16"}
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-white/10 bg-white/[0.04] px-4 pb-8 pt-2 lg:hidden">
            {(cta !== "none" || showLocation) && (
              <div className="space-y-2 pb-4 pt-2">
                {cta !== "none" && (
                  <Link
                    href="/patient/know-you"
                    onClick={() => setMobileOpen(false)}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-brand-600 to-teal-500 px-4 py-3 text-sm font-semibold text-white shadow-soft"
                  >
                    <ClipboardList className="h-4 w-4" />
                    Know About You
                  </Link>
                )}
                {showLocation && <LocationButton variant="block" />}
              </div>
            )}
            {menu.map((node) => (
              <div key={node.label} className="border-b border-white/10">
                {node.children ? (
                  <>
                    <button
                      className="flex w-full items-center justify-between py-3.5 text-left text-base font-bold text-ink"
                      onClick={() =>
                        setOpenMobileGroup((g) =>
                          g === node.label ? null : node.label
                        )
                      }
                    >
                      {node.label}
                      <svg
                        viewBox="0 0 20 20"
                        className={`h-4 w-4 text-ink-muted transition-transform ${
                          openMobileGroup === node.label ? "rotate-180" : ""
                        }`}
                        fill="none"
                      >
                        <path
                          d="m5 8 5 5 5-5"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    {openMobileGroup === node.label && (
                      <ul className="pb-3">
                        {node.children.map((c) => (
                          <li key={c.href}>
                            <Link
                              href={c.href}
                              onClick={() => setMobileOpen(false)}
                              className="block rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-brand-400/[12%] hover:text-brand-200"
                            >
                              {c.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <Link
                    href={node.href ?? "#"}
                    onClick={() => setMobileOpen(false)}
                    className="block py-3.5"
                  >
                    <span className="block text-base font-bold text-ink">
                      {node.label}
                    </span>
                    {node.tagline && (
                      <span className="mt-0.5 block text-xs leading-snug text-ink-muted">
                        {node.tagline}
                      </span>
                    )}
                  </Link>
                )}
              </div>
            ))}

            {/* Account actions — the avatar dropdown is easy to miss on mobile,
                so sign in / sign out lives here in the drawer too. */}
            <div className="mt-4 pt-2">
              {status === "authenticated" && session?.user ? (
                <>
                  <div className="px-1 pb-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      {session.user.name ?? "Your account"}
                    </p>
                    <p className="truncate text-xs text-ink-muted">
                      {session.user.email}
                    </p>
                  </div>
                  {linksFor(session.user.role).map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setMobileOpen(false)}
                      className="block rounded-lg px-1 py-2.5 text-sm font-medium text-ink-soft hover:text-brand-200"
                    >
                      {l.label}
                    </Link>
                  ))}
                  <button
                    onClick={() => {
                      setMobileOpen(false);
                      signOut({ callbackUrl: "/" });
                    }}
                    className="mt-1 block w-full rounded-lg px-1 py-2.5 text-left text-sm font-semibold text-rose-600"
                  >
                    Sign out
                  </button>
                </>
              ) : status === "unauthenticated" ? (
                <Link
                  href={`/login?callbackUrl=${encodeURIComponent(pathname ?? "/")}`}
                  onClick={() => setMobileOpen(false)}
                  className="btn-primary w-full"
                >
                  Sign in
                </Link>
              ) : null}
            </div>
          </div>
        )}
      </header>
    </>
  );
}

function DesktopNavItem({
  node,
  solid,
  pathname,
}: {
  node: NavNode;
  solid: boolean;
  pathname?: string | null;
}) {
  const base = `rounded-full px-4 py-2 text-base font-semibold tracking-[-0.005em] transition-colors ${
    solid
      ? "text-ink-soft hover:bg-brand-400/[12%] hover:text-brand-200"
      : "text-white/90 hover:bg-white/10 hover:text-white"
  }`;

  if (!node.children) {
    const active = !!node.href && pathname === node.href;
    const link = (
      <Link
        href={node.href ?? "#"}
        className={`${base} ${active ? "!bg-brand-600 !text-white" : ""}`}
      >
        {node.label}
      </Link>
    );

    // The hover tagline card was removed on 19 Aug 2026.
    //
    // Two things were wrong with it. Its surface was `bg-white/[0.04]` — a
    // translucent white built for the dark client theme — so on the light
    // doctor chrome it rendered as a near-invisible ghost box floating over
    // the hero, which is what it looked like in the bug report. And it was
    // hover-only, so on every touch device it did not exist at all.
    //
    // The labels are short and self-explanatory; the taglines still appear in
    // the mobile drawer, where there is room to stack them under each item and
    // no hover is required to read them.
    return link;
  }

  return (
    <div className="group relative">
      <button className={`inline-flex items-center gap-1 ${base}`}>
        {node.label}
        <svg
          viewBox="0 0 20 20"
          className="h-3.5 w-3.5 opacity-70 transition-transform group-hover:rotate-180"
          fill="none"
        >
          <path
            d="m5 8 5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {/* Dropdown */}
      <div className="pointer-events-none absolute left-1/2 top-full z-50 w-64 -translate-x-1/2 pt-3 opacity-0 transition-all duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
        <div className="overflow-hidden rounded-2xl bg-white/[0.04] p-2 shadow-card ring-1 ring-black/[0.06]">
          {node.children.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="block rounded-xl px-3.5 py-2.5 text-sm text-ink-soft transition-colors hover:bg-brand-400/[12%] hover:text-brand-200"
            >
              {c.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
