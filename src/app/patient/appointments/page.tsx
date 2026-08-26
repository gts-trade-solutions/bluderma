import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AppointmentsView from "@/components/patient/AppointmentsView";
import ReminderOptIn from "@/components/patient/ReminderOptIn";
import { buildPatientMenu } from "@/lib/queries/nav";
import { getMyAppointments } from "@/lib/queries/patient";
import { requireUser } from "@/lib/session";
import {
  evaluateCancellation,
  evaluateReschedule,
} from "@/lib/booking/policy";
import { getBookingPolicy } from "@/lib/booking/policySettings";
import { getMembership, benefitsOf } from "@/lib/subscription/membership";
import type { AppointmentPolicyView } from "@/components/patient/AppointmentControls";

export const metadata: Metadata = {
  title: "My Appointments",
  description: "Your booked BluDerma consultations.",
  robots: { index: false, follow: false },
};

export default async function AppointmentsPage() {
  const user = await requireUser("/patient/appointments");
  const [appointments, policy, membership] = await Promise.all([
    getMyAppointments(user.id),
    getBookingPolicy(),
    getMembership(user.id),
  ]);
  const waiveFee = benefitsOf(membership).waiveCancellationFee;

  // Worked out here, not in the browser, so what the client is told matches
  // exactly what the server will do when they act on it.
  const policies: Record<string, AppointmentPolicyView> = {};
  for (const a of appointments) {
    const at = new Date(`${a.daySeed}T${a.time}:00.000Z`);
    const cancel = evaluateCancellation(at, policy, new Date(), { waiveFee });
    const move = evaluateReschedule(at, a.rescheduleCount, policy);
    policies[a.id] = {
      cancel:
        cancel.kind === "fee"
          ? { kind: "fee", feeInr: cancel.feeInr }
          : cancel.kind === "contact"
          ? { kind: "contact", phone: cancel.phone }
          : cancel.kind === "free"
          ? { kind: "free" }
          : { kind: "not_applicable" },
      reschedule:
        move.kind === "allowed"
          ? { kind: "allowed", remaining: move.remaining }
          : move.kind === "too_late"
          ? { kind: "too_late", phone: move.phone, minHours: move.minHours }
          : move.kind === "limit_reached"
          ? { kind: "limit_reached", phone: move.phone, max: move.max }
          : { kind: "not_applicable" },
    };
  }

  return (
    <>
      <Navbar role="patient" menu={buildPatientMenu()} />
      {/* theme-light, not just a light background: the ink tokens and the
          translucent "raise" surfaces both default to the dark theme, so a
          light page without this class renders near-white text on near-white
          cards. */}
      <main className="theme-light min-h-screen bg-[var(--surface)]">
        <AppointmentsView appointments={appointments} policies={policies} />

        {/*
          Offered here rather than on arrival anywhere. A permission prompt on
          page load is the most-refused dialog on the web and a refusal is
          close to permanent — browsers remember it and will not ask again. On
          the page about their appointments, after they have seen what it is
          for, is the one honest place to ask.
        */}
        <section className="container-page pb-14">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-bold text-slate-900">
              Remind me the day before
            </p>
            <div className="mt-2">
              <ReminderOptIn />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
