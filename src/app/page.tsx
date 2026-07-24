"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import RoleModal from "@/components/RoleModal";
import BrandLogo from "@/components/BrandLogo";
import { ROLE_STORAGE_KEY, isExperience, landingPathForRole, roleMeta } from "@/lib/roles";

export default function Home() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (status === "loading") return;

    // A signed-in account goes straight to the area its role belongs to; the
    // stored preference is only a fallback for anonymous visitors.
    if (status === "authenticated" && session?.user?.role) {
      router.replace(landingPathForRole(session.user.role));
      return;
    }

    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(ROLE_STORAGE_KEY);
    } catch {
      stored = null;
    }

    if (isExperience(stored)) {
      router.replace(roleMeta[stored].path);
    } else {
      setShowModal(true);
    }
  }, [router, session, status]);

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
        <div className="mb-6 flex justify-center">
          <BrandLogo href={null} tone="light" size={48} />
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
