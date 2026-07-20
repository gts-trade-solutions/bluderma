"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Role, roleMeta } from "@/lib/roles";
import { buildMenu, buildPatientMenu, NavNode } from "@/data/nav";
import RoleModal from "./RoleModal";

interface NavbarProps {
  role: Role;
}

export default function Navbar({ role }: NavbarProps) {
  const [switchOpen, setSwitchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMobileGroup, setOpenMobileGroup] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const pathname = usePathname();
  const meta = roleMeta[role];
  const menu =
    role === "patient" ? buildPatientMenu() : buildMenu(meta.hubPath);
  // Reference-style: nav always sits on a solid white bar above the content.
  const solid = true;

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 shadow-soft backdrop-blur">

        <div className="container-page flex h-16 items-center justify-between gap-4">
          {/* Brand */}
          <Link
            href={meta.path}
            className="flex shrink-0 items-center gap-2"
            onClick={() => setMobileOpen(false)}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-soft">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                <path
                  d="M12 3s6 5.5 6 10a6 6 0 1 1-12 0c0-4.5 6-10 6-10Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span
              className={`text-lg font-extrabold tracking-tight ${
                solid ? "text-brand-800" : "text-white drop-shadow"
              }`}
            >
              Blu<span className="text-teal-400">Derma</span>
            </span>
          </Link>

          {/* Desktop mega-menu */}
          <nav className="hidden items-center gap-1 lg:flex">
            {menu.map((node) => (
              <DesktopNavItem
                key={node.label}
                node={node}
                solid={solid}
                pathname={pathname}
              />
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`hidden rounded-full px-3 py-1 text-xs font-semibold xl:inline-flex ${
                solid
                  ? "bg-brand-50 text-brand-700 ring-1 ring-brand-100"
                  : "bg-white/15 text-white ring-1 ring-white/25"
              }`}
            >
              {meta.badge}
            </span>
            <button
              onClick={() => setSwitchOpen(true)}
              className={
                solid ? "btn-ghost !px-4 !py-2" : "btn-outline-white !px-4 !py-2"
              }
            >
              Switch
            </button>
            <button
              className={`lg:hidden ${solid ? "text-ink" : "text-white"}`}
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
          <div className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-slate-100 bg-white px-4 pb-8 pt-2 lg:hidden">
            {menu.map((node) => (
              <div key={node.label} className="border-b border-slate-100">
                {node.children ? (
                  <>
                    <button
                      className="flex w-full items-center justify-between py-3.5 text-left text-sm font-semibold text-ink"
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
                              className="block rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-brand-50 hover:text-brand-700"
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
                    className="block py-3.5 text-sm font-semibold text-ink"
                  >
                    {node.label}
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </header>

      {/* Spacer so fixed header doesn't overlap non-hero pages */}
      <RoleModal
        open={switchOpen}
        dismissible
        onClose={() => setSwitchOpen(false)}
      />
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
  const base = `rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
    solid
      ? "text-ink-soft hover:bg-brand-50 hover:text-brand-700"
      : "text-white/90 hover:bg-white/10 hover:text-white"
  }`;

  if (!node.children) {
    const active = !!node.href && pathname === node.href;
    return (
      <Link
        href={node.href ?? "#"}
        className={`${base} ${
          active ? "!bg-brand-600 !text-white" : ""
        }`}
      >
        {node.label}
      </Link>
    );
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
        <div className="overflow-hidden rounded-2xl bg-white p-2 shadow-card ring-1 ring-black/[0.06]">
          {node.children.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="block rounded-xl px-3.5 py-2.5 text-sm text-ink-soft transition-colors hover:bg-brand-50 hover:text-brand-700"
            >
              {c.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
