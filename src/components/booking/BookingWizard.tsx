"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { Doctor } from "@/data/doctors";
import type { DayOption, Slot } from "@/lib/queries/availability";
import { bookAppointment } from "@/lib/actions/booking";
import { useRazorpayCheckout } from "@/hooks/useRazorpayCheckout";
import { applyMemberDiscount } from "@/lib/subscription/plan";

/**
 * The client booking flow, one question per screen.
 *
 * Modelled on /doctor/join, and for the same reason: the step lives in the
 * URL, so every "next" is a real navigation and the browser Back button walks
 * the flow without any history interception. No dialog, no nested scroll, no
 * confirm button hiding below a fold inside a fold.
 *
 * The selections ride in the URL too (clinic, day, time, mode). That makes a
 * part-finished booking survive the sign-in round trip, which is the one place
 * a client would otherwise lose their work. Name, phone and notes stay in
 * component state — those are personal and have no business in a URL.
 */

type StepId = "clinic" | "when" | "how" | "you" | "confirm";

interface Props {
  doctor: Doctor;
  signedIn: boolean;
  patientName: string;
  homeVisitFee: number;
  onlinePayment: boolean;
  receptionPhone: string;
  memberDiscountPercent: number;
  memberPlanName: string | null;
  initial: { step: string; clinic: string; day: string; time: string; mode: string };
}

const MODE_COPY: Record<string, { label: string; sub: string }> = {
  clinic: { label: "At the clinic", sub: "In person, at the address below" },
  video: { label: "Video consultation", sub: "A link is sent before your slot" },
  home: { label: "Home visit", sub: "The doctor comes to you" },
};

export default function BookingWizard({
  doctor,
  signedIn,
  patientName,
  homeVisitFee,
  onlinePayment,
  receptionPhone,
  memberDiscountPercent,
  memberPlanName,
  initial,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { pay: runCheckout } = useRazorpayCheckout();

  const practices = doctor.clinics ?? [];
  // A single-clinic doctor is not asked which one — that screen would be a
  // question with one answer.
  const steps = useMemo<StepId[]>(
    () =>
      practices.length > 1
        ? ["clinic", "when", "how", "you", "confirm"]
        : ["when", "how", "you", "confirm"],
    [practices.length]
  );

  // ── URL is the source of truth for the selection ──────────────────────
  const stepId = (steps.includes(initial.step as StepId)
    ? initial.step
    : steps[0]) as StepId;
  const stepIndex = steps.indexOf(stepId);

  const clinicId =
    practices.find((c) => c.id === initial.clinic)?.id ??
    practices.find((c) => c.isPrimary)?.id ??
    practices[0]?.id ??
    "";
  const clinic = practices.find((c) => c.id === clinicId) ?? null;

  const offeredModes = useMemo(() => {
    const out = doctor.modes.filter((m) => m === "clinic" || m === "video");
    // A home visit is scheduled against clinic hours, so it is only offerable
    // by a doctor who consults in person.
    if (doctor.modes.includes("clinic")) out.push("home" as never);
    return out as string[];
  }, [doctor.modes]);

  const mode = offeredModes.includes(initial.mode)
    ? initial.mode
    : offeredModes[0] ?? "clinic";

  const day = initial.day;
  const time = initial.time;

  const go = useCallback(
    (next: Partial<Record<string, string>>) => {
      const q = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v) q.set(k, v);
        else q.delete(k);
      }
      // push, not replace: each step is a history entry, which is exactly what
      // makes the browser Back button work here without any interception.
      router.push(`${pathname}?${q.toString()}`);
    },
    [params, pathname, router]
  );

  const goStep = (i: number) => go({ step: steps[Math.max(0, Math.min(i, steps.length - 1))] });

  // ── Availability ──────────────────────────────────────────────────────
  const [days, setDays] = useState<DayOption[]>([]);
  const [slotsByDay, setSlotsByDay] = useState<Record<string, Slot[]>>({});
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [slotError, setSlotError] = useState<string | null>(null);

  const loadSlots = useCallback(async () => {
    setLoadingSlots(true);
    setSlotError(null);
    try {
      const qs = new URLSearchParams({ days: "7" });
      if (clinicId) qs.set("clinic", clinicId);
      const res = await fetch(`/api/doctors/${doctor.id}/slots?${qs}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setDays(data.days ?? []);
      setSlotsByDay(data.slots ?? {});
    } catch {
      setSlotError("Could not load available times. Please try again.");
    } finally {
      setLoadingSlots(false);
    }
  }, [doctor.id, clinicId]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  // ── Personal details, deliberately not in the URL ─────────────────────
  const [name, setName] = useState(patientName);
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ awaiting: boolean; paid: boolean } | null>(null);

  useEffect(() => setName((n) => n || patientName), [patientName]);

  // ── Money ─────────────────────────────────────────────────────────────
  const listFee = clinic ? clinic.feeInr : doctor.fee;
  const { payableInr, discountInr } = applyMemberDiscount(listFee, {
    discountPercent: memberDiscountPercent,
    scanCredits: 0,
    priorityBooking: false,
    waiveCancellationFee: false,
  });
  const visitFee = mode === "home" ? homeVisitFee : 0;
  const total = payableInr + visitFee;

  const confirm = async () => {
    if (!day || !time) return;
    setBusy(true);
    setError(null);

    const res = await bookAppointment({
      doctorSlug: doctor.id,
      clinicId: clinicId || undefined,
      daySeed: day,
      time,
      mode: mode as "clinic" | "video" | "home",
      patientName: name.trim() || "Client",
      patientPhone: phone.trim(),
      notes: notes.trim() || undefined,
    });

    if (!res.ok || !res.appointmentId) {
      setError(res.error ?? "Could not complete your booking.");
      setBusy(false);
      void loadSlots();
      return;
    }

    if (res.paymentDue) {
      const outcome = await runCheckout(res.appointmentId);
      if (outcome.status === "failed") {
        setError(outcome.error);
        setBusy(false);
        return;
      }
      if (outcome.status === "cancelled") {
        setError(
          "Your slot is held. Pay from My appointments to confirm it, or cancel it there."
        );
        setBusy(false);
        return;
      }
      setDone({ awaiting: Boolean(res.awaiting), paid: outcome.status === "paid" });
      setBusy(false);
      return;
    }

    setDone({ awaiting: Boolean(res.awaiting), paid: false });
    setBusy(false);
  };

  if (done) {
    return (
      <Confirmed
        doctor={doctor}
        clinicName={clinic?.name ?? doctor.clinic}
        day={day}
        time={time}
        mode={mode}
        awaiting={done.awaiting}
        paid={done.paid}
      />
    );
  }

  const pct = Math.round(((stepIndex + 1) / steps.length) * 100);
  const slots = day ? slotsByDay[day] ?? [] : [];

  return (
    <>
      <div className="h-1 bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-brand-500 to-teal-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        {/* Who this is with — kept visible on every step, because the doctor
            is the thing being chosen and it should never be a guess. */}
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={doctor.image}
            alt=""
            className="h-11 w-11 rounded-full object-cover ring-1 ring-white/10"
          />
          <div className="min-w-0">
            <p className="truncate font-bold text-ink">{doctor.name}</p>
            <p className="truncate text-xs text-ink-muted">{doctor.specialty}</p>
          </div>
        </div>

        <p className="mt-8 text-[11px] font-bold uppercase tracking-widest text-brand-300">
          Step {stepIndex + 1} of {steps.length}
        </p>

        {stepId === "clinic" && (
          <Screen
            title="Where would you like to be seen?"
            sub="Each location keeps its own hours and its own consultation fee."
          >
            <div className="grid gap-3">
              {practices.map((c) => (
                <Choice
                  key={c.id}
                  on={c.id === clinicId}
                  onClick={() => go({ clinic: c.id, day: "", time: "", step: "when" })}
                  title={c.name}
                  sub={`${c.area}, ${c.city}`}
                  aside={c.feeInr > 0 ? `₹${c.feeInr.toLocaleString("en-IN")}` : "On enquiry"}
                />
              ))}
            </div>
          </Screen>
        )}

        {stepId === "when" && (
          <Screen
            title="When suits you?"
            sub={
              clinic
                ? `Live availability at ${clinic.name}.`
                : "Live availability from the doctor's calendar."
            }
          >
            {loadingSlots ? (
              <p className="text-sm text-ink-muted">Checking the calendar…</p>
            ) : slotError ? (
              <p className="rounded-xl bg-rose-500/[12%] px-4 py-3 text-sm text-rose-200">
                {slotError}
              </p>
            ) : days.length === 0 ? (
              <Empty phone={receptionPhone} />
            ) : (
              <>
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                  {days.map((d) => {
                    const free = (slotsByDay[d.daySeed] ?? []).filter((s) => s.available);
                    return (
                      <button
                        key={d.daySeed}
                        onClick={() => go({ day: d.daySeed, time: "" })}
                        disabled={free.length === 0}
                        className={`min-w-[5.5rem] shrink-0 rounded-2xl px-3 py-3 text-center ring-1 transition disabled:opacity-35 ${
                          d.daySeed === day
                            ? "bg-brand-400/[14%] ring-brand-300/50"
                            : "bg-white/[0.04] ring-white/10 hover:bg-white/[0.07]"
                        }`}
                      >
                        <span className="block text-sm font-bold text-ink">{d.label}</span>
                        <span className="block text-[11px] text-ink-muted">{d.sub}</span>
                        <span className="mt-1 block text-[10px] font-semibold text-teal-300">
                          {free.length > 0 ? `${free.length} free` : "full"}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {day && (
                  <div className="mt-6">
                    {slots.filter((s) => s.available).length === 0 ? (
                      <p className="text-sm text-ink-muted">
                        Nothing left on that day — try another.
                      </p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {slots
                          .filter((s) => s.available)
                          .map((s) => (
                            <button
                              key={`${s.clinicId ?? ""}-${s.label}`}
                              onClick={() => go({ time: s.label, step: "how" })}
                              className={`rounded-xl px-3 py-2.5 text-sm font-semibold ring-1 transition ${
                                s.label === time
                                  ? "bg-brand-600 text-white ring-brand-500"
                                  : "bg-white/[0.04] text-ink ring-white/10 hover:bg-white/[0.08]"
                              }`}
                            >
                              {s.label}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </Screen>
        )}

        {stepId === "how" && (
          <Screen title="How would you like to be seen?" sub="You can change this later.">
            <div className="grid gap-3">
              {offeredModes.map((m) => (
                <Choice
                  key={m}
                  on={m === mode}
                  onClick={() => go({ mode: m, step: "you" })}
                  title={MODE_COPY[m]?.label ?? m}
                  sub={
                    m === "clinic" && clinic
                      ? `${clinic.name}, ${clinic.area}`
                      : MODE_COPY[m]?.sub ?? ""
                  }
                  aside={
                    m === "home" && homeVisitFee > 0
                      ? `+₹${homeVisitFee.toLocaleString("en-IN")}`
                      : undefined
                  }
                />
              ))}
            </div>
          </Screen>
        )}

        {stepId === "you" && (
          <Screen
            title="Who is the appointment for?"
            sub="So the clinic knows who to expect, and can reach you if anything changes."
          >
            <div className="grid gap-4">
              <Field label="Full name" value={name} onChange={setName} autoComplete="name" />
              <Field
                label="Mobile"
                value={phone}
                onChange={setPhone}
                type="tel"
                autoComplete="tel"
                hint="Used only for this appointment."
              />
              <div>
                <label className="block text-sm font-semibold text-ink">
                  Anything the doctor should know?
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional — what is bothering you, what you have already tried."
                  className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-500/15"
                />
              </div>
            </div>

            <button
              onClick={() => go({ step: "confirm" })}
              disabled={name.trim().length < 2}
              className="btn-primary mt-7 disabled:opacity-40"
            >
              Review the booking
            </button>
            {name.trim().length < 2 && (
              <p className="mt-2 text-xs text-ink-muted">Enter a name to continue.</p>
            )}
          </Screen>
        )}

        {stepId === "confirm" && (
          <Screen title="Check and confirm" sub="Nothing is booked until you confirm.">
            <dl className="divide-y divide-white/10 rounded-2xl bg-white/[0.04] px-4 ring-1 ring-white/10">
              <Row k="Doctor" v={doctor.name} />
              <Row k="When" v={day && time ? `${day} at ${time}` : "—"} onEdit={() => go({ step: "when" })} />
              <Row
                k="Where"
                v={
                  mode === "video"
                    ? "Video consultation"
                    : mode === "home"
                    ? "Home visit"
                    : clinic
                    ? `${clinic.name}, ${clinic.area}`
                    : doctor.clinic
                }
                onEdit={() => go({ step: "how" })}
              />
              <Row k="Name" v={name || "—"} onEdit={() => go({ step: "you" })} />
              {phone && <Row k="Mobile" v={phone} />}
              <Row k="Consultation" v={`₹${listFee.toLocaleString("en-IN")}`} />
              {discountInr > 0 && (
                <Row
                  k={memberPlanName ?? "Membership"}
                  v={`−₹${discountInr.toLocaleString("en-IN")}`}
                  tone="teal"
                />
              )}
              {visitFee > 0 && (
                <Row k="Home visit" v={`+₹${visitFee.toLocaleString("en-IN")}`} />
              )}
              <Row k="Total" v={`₹${total.toLocaleString("en-IN")}`} strong />
            </dl>

            {error && (
              <p className="mt-4 rounded-xl bg-rose-500/[12%] px-4 py-3 text-sm text-rose-200">
                {error}
              </p>
            )}

            {!signedIn ? (
              <div className="mt-6 rounded-2xl bg-brand-400/[12%] p-4 ring-1 ring-brand-300/30">
                <p className="text-sm text-ink-soft">
                  Sign in to confirm. Your choices are kept — you will come
                  straight back here.
                </p>
                <Link
                  href={`/login?callbackUrl=${encodeURIComponent(
                    `${pathname}?${params.toString()}`
                  )}`}
                  className="btn-primary mt-3 inline-flex"
                >
                  Sign in and confirm
                </Link>
              </div>
            ) : (
              <>
                <button
                  onClick={confirm}
                  disabled={busy || !day || !time}
                  className="btn-primary mt-6 w-full justify-center disabled:opacity-50 sm:w-auto"
                >
                  {busy
                    ? "Confirming…"
                    : onlinePayment && total > 0
                    ? `Pay ₹${total.toLocaleString("en-IN")} and confirm`
                    : "Confirm appointment"}
                </button>
                <p className="mt-3 text-xs text-ink-muted">
                  {onlinePayment && total > 0
                    ? "You will be taken to the payment window. Your slot is held while you pay."
                    : "Pay at the clinic. You can move or cancel this from My appointments."}
                </p>
              </>
            )}
          </Screen>
        )}

        {/* Back is a real navigation on every step, so the browser button and
            this one do the same thing. */}
        {stepIndex > 0 && (
          <button
            onClick={() => goStep(stepIndex - 1)}
            className="mt-8 text-sm font-semibold text-ink-muted transition hover:text-ink"
          >
            ← Back
          </button>
        )}
      </main>
    </>
  );
}

/* ------------------------------- pieces -------------------------------- */

function Screen({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h1 className="display mt-1 text-3xl text-ink sm:text-4xl">{title}</h1>
      {sub && <p className="mt-2 max-w-xl text-ink-soft">{sub}</p>}
      <div className="mt-7">{children}</div>
    </section>
  );
}

function Choice({
  on,
  onClick,
  title,
  sub,
  aside,
}: {
  on: boolean;
  onClick: () => void;
  title: string;
  sub: string;
  aside?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-4 rounded-2xl px-5 py-4 text-left ring-1 transition ${
        on
          ? "bg-brand-400/[14%] ring-brand-300/50"
          : "bg-white/[0.04] ring-white/10 hover:bg-white/[0.07]"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-ink">{title}</span>
        {sub && <span className="mt-0.5 block text-sm text-ink-muted">{sub}</span>}
      </span>
      {aside && (
        <span className="shrink-0 text-sm font-semibold text-ink-soft">{aside}</span>
      )}
      <span aria-hidden className="shrink-0 text-ink-muted">
        →
      </span>
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
  ...rest
}: {
  label: string;
  value: string;
  /** Takes the value, not the event — the native onChange is omitted below. */
  onChange: (v: string) => void;
  hint?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <div>
      <label className="block text-sm font-semibold text-ink">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-500/15"
        {...rest}
      />
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

function Row({
  k,
  v,
  strong,
  tone,
  onEdit,
}: {
  k: string;
  v: string;
  strong?: boolean;
  tone?: "teal";
  onEdit?: () => void;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="text-sm text-ink-muted">{k}</dt>
      <dd className="flex items-baseline gap-3">
        <span
          className={`text-right text-sm ${
            tone === "teal"
              ? "font-semibold text-teal-300"
              : strong
              ? "text-base font-bold text-ink"
              : "text-ink"
          }`}
        >
          {v}
        </span>
        {onEdit && (
          <button
            onClick={onEdit}
            className="text-xs font-semibold text-brand-300 hover:text-brand-200"
          >
            Change
          </button>
        )}
      </dd>
    </div>
  );
}

function Empty({ phone }: { phone: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10">
      <p className="font-bold text-ink">No open times in the next week</p>
      <p className="mt-1 text-sm text-ink-muted">
        This doctor has nothing free at the moment.
        {phone ? ` Call us on ${phone} and we will find you something.` : ""}
      </p>
      <Link href="/patient/doctors" className="btn-ghost mt-4 inline-flex">
        See other doctors
      </Link>
    </div>
  );
}

function Confirmed({
  doctor,
  clinicName,
  day,
  time,
  mode,
  awaiting,
  paid,
}: {
  doctor: Doctor;
  clinicName: string;
  day: string;
  time: string;
  mode: string;
  awaiting: boolean;
  paid: boolean;
}) {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16 text-center sm:px-8">
      <span
        aria-hidden
        className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-teal-400/15 text-2xl"
      >
        {awaiting ? "⏳" : "✓"}
      </span>
      <h1 className="display mt-5 text-3xl text-ink">
        {awaiting ? "Request sent" : "You're booked"}
      </h1>
      <p className="mx-auto mt-3 max-w-md text-ink-soft">
        {awaiting
          ? `${doctor.name} confirms their own bookings. Your slot is held while they review it, and we will email you as soon as they respond.`
          : `${doctor.name} will see you on ${day} at ${time}.`}
      </p>

      <dl className="mx-auto mt-8 max-w-sm divide-y divide-white/10 rounded-2xl bg-white/[0.04] px-4 text-left ring-1 ring-white/10">
        <Row k="When" v={`${day} at ${time}`} />
        <Row
          k="Where"
          v={
            mode === "video"
              ? "Video — link to follow"
              : mode === "home"
              ? "Home visit"
              : clinicName
          }
        />
        {paid && <Row k="Payment" v="Paid" tone="teal" />}
      </dl>

      <p className="mt-6 text-sm text-ink-muted">
        A confirmation is on its way to your email.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/patient/appointments" className="btn-primary">
          My appointments
        </Link>
        <Link href="/patient/explore" className="btn-ghost">
          Keep browsing
        </Link>
      </div>
    </main>
  );
}
