import Link from "next/link";
import { ArrowRight, Check, LogIn } from "lucide-react";

import SmartImage from "@/components/SmartImage";
import { assetUrl } from "@/lib/assetUrl";
import { doctorCta } from "@/lib/doctor/viewer";

/** The practitioner recruitment banner used only on /doctor. */
export default function JoinHero({
  doctorCount,
  clinicCount,
  viewer,
}: {
  doctorCount: number;
  clinicCount: number;
  /**
   * Who is reading this. Offering "Doctor sign in" to somebody already signed
   * in is the kind of detail that makes a site feel like it is not paying
   * attention — and offering "List your practice" to a listed practitioner
   * sends them back through a wizard they finished weeks ago.
   */
  viewer: "guest" | "client" | "doctor-pending" | "doctor-live" | "admin";
}) {
  const live = viewer === "doctor-live" || viewer === "admin";
  const cta = doctorCta(viewer);

  return (
    <section className="on-dark relative isolate flex min-h-[610px] overflow-hidden bg-[#06152a] sm:min-h-[640px]">
      <div className="absolute inset-0">
        <SmartImage
          src={assetUrl("/images/doctor/doctor-practice-hero-v1.png")}
          alt="Dermatologist standing in a modern skin clinic"
          mode="fill"
          className="object-cover object-[55%_center] sm:object-center"
          priority
          sizes="100vw"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-[#06152a]/65 sm:bg-[#06152a]/35"
        />
      </div>

      <div className="container-page relative flex min-w-0 !w-[calc(100%-2.5rem)] items-center !px-0 py-10 sm:!w-full sm:!px-8 sm:py-16">
        <div className="w-[calc(100vw-2.5rem)] min-w-0 max-w-[calc(100vw-2.5rem)] sm:w-full sm:max-w-[43rem]">
          <div className="flex max-w-[18rem] items-start gap-3 text-[11px] font-bold uppercase leading-5 tracking-[0.18em] text-teal-300 sm:max-w-none sm:items-center sm:text-xs">
            <span aria-hidden className="h-px w-8 bg-teal-300" />
            For dermatologists and skin specialists
          </div>

          <h1 className="display mt-4 max-w-[12ch] text-balance text-4xl leading-[1.06] text-white sm:mt-5 sm:text-5xl lg:text-[4rem]">
            Put your practice in front of prepared patients.
          </h1>

          <p className="mt-5 max-w-full text-base leading-7 text-white/80 sm:max-w-[38rem] sm:text-lg sm:leading-8">
            Meet people who have already completed their skin analysis and
            shared what they want treated. Review the brief, manage every
            clinic in one diary, and keep your consultation fee.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href={cta.href}
              className="inline-flex min-h-12 w-full max-w-full items-center justify-center gap-2 rounded-md bg-teal-400 px-6 py-3 text-sm font-bold text-[#06152a] shadow-[0_14px_38px_rgba(20,184,166,0.22)] transition hover:bg-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:w-auto"
            >
              {cta.label}
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>

            {/* Only offered to somebody who is not already signed in. */}
            {viewer === "guest" && (
              <Link
                href="/login?callbackUrl=/doctor/portal"
                className="inline-flex min-h-12 w-full max-w-full items-center justify-center gap-2 rounded-md border border-white/30 bg-[#06152a]/35 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/60 hover:bg-[#06152a]/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:w-auto"
              >
                <LogIn aria-hidden className="h-4 w-4" />
                Doctor sign in
              </Link>
            )}
          </div>

          {viewer === "client" && (
            <p className="mt-4 max-w-[38rem] rounded-md border border-white/20 bg-[#06152a]/40 px-4 py-3 text-sm text-white/75">
              You are signed in as a client. Practitioner accounts are separate
              — you will be asked to register as a doctor, and you can use
              the same email address.
            </p>
          )}

          <div className="mt-5 flex max-w-full flex-wrap gap-x-4 gap-y-2 text-xs text-white/70 sm:gap-x-5 sm:text-sm">
            <Proof>Free to list</Proof>
            <Proof>No consultation commission</Proof>
            <Proof>Verified profiles</Proof>
          </div>

          {doctorCount > 0 && (
            <dl className="mt-8 hidden flex-wrap gap-x-9 gap-y-3 border-t border-white/20 pt-5 sm:flex">
              <Stat
                value={doctorCount}
                label={
                  doctorCount === 1
                    ? "doctor listed"
                    : "doctors listed"
                }
              />
              {clinicCount > 0 && (
                <Stat
                  value={clinicCount}
                  label={clinicCount === 1 ? "clinic" : "clinics"}
                />
              )}
            </dl>
          )}
        </div>
      </div>
    </section>
  );
}

function Proof({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Check aria-hidden className="h-4 w-4 text-teal-300" />
      {children}
    </span>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <dt className="text-2xl font-bold text-white">{value}</dt>
      <dd className="mt-0.5 text-xs text-white/60">{label}</dd>
    </div>
  );
}
