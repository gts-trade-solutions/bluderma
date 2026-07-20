"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RoleModal from "@/components/RoleModal";
import { ROLE_STORAGE_KEY, roleMeta } from "@/lib/roles";

export default function Home() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(ROLE_STORAGE_KEY);
    } catch {
      stored = null;
    }
    if (stored === "doctor" || stored === "patient") {
      router.replace(roleMeta[stored].path);
    } else {
      setShowModal(true);
    }
  }, [router]);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-950">
      {/* Ambient branded backdrop behind the entry modal */}
      <div
        className="absolute inset-0 animate-ken-burns bg-cover bg-center opacity-40"
        style={{
          backgroundImage:
            "url(https://images.unsplash.com/photo-1731514771613-991a02407132?auto=format&fit=crop&w=1600&q=80)",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-brand-950/90 via-brand-900/80 to-teal-900/70" />

      <div className="relative z-10 px-6 text-center text-white">
        <div className="mb-6 inline-flex items-center gap-2">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
              <path
                d="M12 3s6 5.5 6 10a6 6 0 1 1-12 0c0-4.5 6-10 6-10Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="text-2xl font-extrabold tracking-tight">
            Blu<span className="text-teal-300">Derma</span>
          </span>
        </div>
        <h1 className="mx-auto max-w-2xl text-balance text-3xl font-bold sm:text-5xl">
          Dermatology &amp; aesthetic care, made clear
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-white/80">
          A trusted reference for skin treatments — built for both the clinicians
          who deliver them and the patients who receive them.
        </p>
        {!showModal && (
          <p className="mt-8 animate-fade-in-fast text-sm text-white/70">
            Loading your experience…
          </p>
        )}
      </div>

      <RoleModal open={showModal} />
    </main>
  );
}
