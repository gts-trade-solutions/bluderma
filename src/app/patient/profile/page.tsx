import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProfileView from "@/components/patient/ProfileView";

export const metadata: Metadata = {
  title: "My Profile",
  description: "Manage your BluDerma patient profile and skin snapshot.",
};

export default function ProfilePage() {
  return (
    <>
      <Navbar role="patient" />
      <main className="min-h-screen bg-[#f7fafc]">
        <ProfileView />
      </main>
      <Footer />
    </>
  );
}
