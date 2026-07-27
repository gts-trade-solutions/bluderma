import type { Metadata } from "next";
import { Suspense } from "react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SkinScanGate from "@/components/skin/SkinScanGate";
import { buildPatientMenu } from "@/lib/queries/nav";

export const metadata: Metadata = {
  title: "AI Skin Analyzer",
  description:
    "Run a camera-based skin analysis in seconds — get an overall score and a concern breakdown to review with a BluDerma clinician.",
};

export const dynamic = "force-dynamic";

export default function SkinAnalyzerPage() {
  return (
    <>
      <Navbar role="patient" menu={buildPatientMenu()} />
      <main className="min-h-screen bg-[#f7fafc]">
        {/* useSearchParams in the gate needs a Suspense boundary. */}
        <Suspense fallback={<div className="h-96" />}>
          <SkinScanGate />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
