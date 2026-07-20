import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AppointmentsView from "@/components/patient/AppointmentsView";

export const metadata: Metadata = {
  title: "My Appointments",
  description: "Your booked BluDerma consultations.",
};

export default function AppointmentsPage() {
  return (
    <>
      <Navbar role="patient" />
      <main className="min-h-screen bg-[#f7fafc]">
        <AppointmentsView />
      </main>
      <Footer />
    </>
  );
}
