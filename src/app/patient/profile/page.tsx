import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProfileView from "@/components/patient/ProfileView";
import { buildPatientMenu } from "@/lib/queries/nav";
import {
  getMyAnalyses,
  getMyAppointments,
  getMyProfile,
} from "@/lib/queries/patient";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "My Profile",
  description: "Manage your BluDerma patient profile and skin snapshot.",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const user = await requireUser("/patient/profile");
  const [profile, analyses, appointments] = await Promise.all([
    getMyProfile(user.id),
    getMyAnalyses(user.id, 5),
    getMyAppointments(user.id),
  ]);

  const upcoming = appointments.filter(
    (a) => a.status !== "CANCELLED" && !a.isPast
  );

  return (
    <>
      <Navbar role="patient" menu={buildPatientMenu()} />
      <main className="min-h-screen bg-[#f7fafc]">
        <ProfileView
          profile={profile}
          analyses={analyses}
          appointmentCount={upcoming.length}
        />
      </main>
      <Footer />
    </>
  );
}
