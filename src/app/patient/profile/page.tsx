import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProfileView from "@/components/patient/ProfileView";
import ProfileSkinSection from "@/components/skin/ProfileSkinSection";
import { buildPatientMenu } from "@/lib/queries/nav";
import { prisma } from "@/lib/prisma";
import {
  getMyAnalyses,
  getMyAppointments,
  getMyProfile,
} from "@/lib/queries/patient";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "My Profile",
  description: "Manage your BluDerma profile and skin snapshot.",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const user = await requireUser("/patient/profile");
  const [profile, analyses, appointments, skinScans] = await Promise.all([
    getMyProfile(user.id),
    getMyAnalyses(user.id, 5),
    getMyAppointments(user.id),
    prisma.skinScan.findMany({
      where: { userId: user.id, status: "done" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, createdAt: true, summary: true },
    }),
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
        <div className="mx-auto max-w-5xl px-4 pb-12">
          <ProfileSkinSection scans={skinScans} />
        </div>
      </main>
      <Footer />
    </>
  );
}
