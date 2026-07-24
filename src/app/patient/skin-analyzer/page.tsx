import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SkinAnalyzer from "@/components/skin/SkinAnalyzer";
import { buildPatientMenu } from "@/lib/queries/nav";
import { getDoctors } from "@/lib/queries/doctors";
import { getConcerns } from "@/lib/queries/content";
import { buildDayOptions, getSlotsForDoctor } from "@/lib/queries/availability";

export const metadata: Metadata = {
  title: "AI Skin Analyzer",
  description:
    "Analyse your skin from a selfie in seconds, get an overall score across 12 signals, then get matched with the right BluDerma doctor and book an appointment.",
};

/**
 * Short window: the doctor list barely changes, but the "next free slot" hint
 * does. The booking modal fetches live availability when it opens, so a
 * slightly stale hint here is cosmetic rather than misleading.
 */
export const revalidate = 60;

export default async function SkinAnalyzerPage() {
  const [doctors, concerns] = await Promise.all([getDoctors(), getConcerns()]);

  const today = buildDayOptions(new Date(), 1)[0].daySeed;
  const nextSlots = await Promise.all(
    doctors.map(async (d) => {
      const slots = await getSlotsForDoctor(d.id, today);
      return [d.id, slots.find((s) => s.available)?.label ?? null] as const;
    })
  );

  return (
    <>
      <Navbar role="patient" menu={buildPatientMenu()} />
      <main className="min-h-screen bg-[#f7fafc]">
        <SkinAnalyzer
          doctors={doctors}
          concerns={concerns}
          nextSlotBySlug={Object.fromEntries(nextSlots)}
        />
      </main>
      <Footer />
    </>
  );
}
