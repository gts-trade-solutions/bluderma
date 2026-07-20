import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SkinAnalyzer from "@/components/skin/SkinAnalyzer";

export const metadata: Metadata = {
  title: "AI Skin Analyzer",
  description:
    "Analyse your skin from a selfie in seconds, get an overall score across 12 signals, then get matched with the right BluDerma doctor and book an appointment.",
};

export default function SkinAnalyzerPage() {
  return (
    <>
      <Navbar role="patient" />
      <main className="min-h-screen bg-[#f7fafc]">
        <SkinAnalyzer />
      </main>
      <Footer />
    </>
  );
}
