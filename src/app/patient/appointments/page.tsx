import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AppointmentsView from "@/components/patient/AppointmentsView";
import { buildPatientMenu } from "@/lib/queries/nav";
import { getMyAppointments } from "@/lib/queries/patient";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "My Appointments",
  description: "Your booked BluDerma consultations.",
  robots: { index: false, follow: false },
};

export default async function AppointmentsPage() {
  const user = await requireUser("/patient/appointments");
  const appointments = await getMyAppointments(user.id);

  return (
    <>
      <Navbar role="patient" menu={buildPatientMenu()} />
      <main className="min-h-screen bg-[#f7fafc]">
        <AppointmentsView appointments={appointments} />
      </main>
      <Footer />
    </>
  );
}
