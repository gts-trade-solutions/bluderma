"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ROLE_STORAGE_KEY, Experience, roleMeta } from "@/lib/roles";
import BrandLogo from "./BrandLogo";

interface RoleModalProps {
  open: boolean;
  /** Whether the user can close the modal without choosing (used for "switch"). */
  dismissible?: boolean;
  onClose?: () => void;
}

const options: {
  role: Experience;
  title: string;
  subtitle: string;
  points: string[];
  accent: string;
  icon: JSX.Element;
}[] = [
  {
    role: "doctor",
    title: "I'm a Doctor",
    subtitle: "Medical professional / clinician",
    points: [
      "Clinical treatment reference",
      "Indications, protocols & product enquiry",
      "Order treatment solutions",
    ],
    accent: "brand",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
        <path
          d="M12 3v3m0 0a5 5 0 0 1 5 5v1a4 4 0 0 1-8 0M12 6a5 5 0 0 0-5 5v1a4 4 0 0 0 8 0m1 4v2a4 4 0 0 1-8 0v-2m10 1a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    role: "patient",
    title: "I'm a Client",
    subtitle: "Exploring treatments for myself",
    points: [
      "Friendly, easy-to-understand guides",
      "What each treatment helps with",
      "Send an enquiry to a clinic",
    ],
    accent: "teal",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
        <path
          d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 0c-3.6 0-6.5 2.4-6.5 6 0 .8.6 1.5 1.5 1.5h10c.9 0 1.5-.7 1.5-1.5 0-3.6-2.9-6-6.5-6Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export default function RoleModal({
  open,
  dismissible = false,
  onClose,
}: RoleModalProps) {
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose?.();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, dismissible, onClose]);

  if (!open) return null;

  const choose = (role: Experience) => {
    try {
      window.localStorage.setItem(ROLE_STORAGE_KEY, role);
    } catch {
      /* storage may be unavailable; navigation still works */
    }
    onClose?.();
    router.push(roleMeta[role].path);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Choose how you want to use BluDerma"
    >
      <div
        className="absolute inset-0 bg-ink/70 backdrop-blur-sm"
        onClick={() => dismissible && onClose?.()}
      />
      <div className="relative z-10 w-full max-w-3xl animate-scale-in rounded-3xl bg-white p-6 shadow-2xl sm:p-9">
        {dismissible && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full p-2 text-ink-muted transition hover:bg-slate-100 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
              <path
                d="m6 6 12 12M18 6 6 18"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}

        <div className="mb-7 text-center">
          <div className="mx-auto mb-3 flex items-center justify-center">
            <BrandLogo href={null} size={52} />
          </div>
          <h2 className="text-2xl font-bold text-ink sm:text-3xl">
            Welcome — how would you like to continue?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-ink-muted">
            Choose the experience made for you — we&apos;ll tailor BluDerma to
            match.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {options.map((opt) => {
            const isBrand = opt.accent === "brand";
            return (
              <button
                key={opt.role}
                onClick={() => choose(opt.role)}
                className={`group flex flex-col rounded-2xl border-2 p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card ${
                  isBrand
                    ? "border-brand-100 hover:border-brand-400"
                    : "border-teal-100 hover:border-teal-400"
                }`}
              >
                <span
                  className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${
                    isBrand
                      ? "bg-brand-50 text-brand-600"
                      : "bg-teal-50 text-teal-600"
                  }`}
                >
                  {opt.icon}
                </span>
                <span className="text-lg font-bold text-ink">{opt.title}</span>
                <span className="mb-3 text-sm text-ink-muted">
                  {opt.subtitle}
                </span>
                <ul className="mt-auto space-y-1.5">
                  {opt.points.map((p) => (
                    <li
                      key={p}
                      className="flex items-start gap-2 text-sm text-ink-soft"
                    >
                      <svg
                        viewBox="0 0 20 20"
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          isBrand ? "text-brand-500" : "text-teal-500"
                        }`}
                        fill="currentColor"
                      >
                        <path d="M8.2 13.3 5 10.1l1.2-1.2 2 2 5-5L14.4 7l-6.2 6.3Z" />
                      </svg>
                      {p}
                    </li>
                  ))}
                </ul>
                <span
                  className={`mt-4 inline-flex items-center gap-1 text-sm font-semibold ${
                    isBrand ? "text-brand-600" : "text-teal-600"
                  }`}
                >
                  Continue
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
                    <path
                      d="m8 5 5 5-5 5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
