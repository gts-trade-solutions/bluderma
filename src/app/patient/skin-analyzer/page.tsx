import type { Metadata } from "next";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SkinAnalyzerLanding from "@/components/skin/SkinAnalyzerLanding";
import { buildPatientMenu } from "@/lib/queries/nav";

export const metadata: Metadata = {
  title: "AI Skin Analyzer",
  description:
    "Snap one selfie and our AI reads 12+ skin signals in seconds — an overall score and a concern breakdown to review with a BluDerma doctor.",
};

export const dynamic = "force-dynamic";

export default function SkinAnalyzerPage() {
  return (
    <>
      {/* This is the client home page, so it carries the headline analyzer
          call-to-action in the navbar. */}
      <Navbar role="patient" menu={buildPatientMenu()} overlay />
      <main>
        <SkinAnalyzerLanding />
      </main>
      <Footer />
    </>
  );
}
