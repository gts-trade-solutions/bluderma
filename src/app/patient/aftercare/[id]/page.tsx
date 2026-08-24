import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { buildPatientMenu } from "@/lib/queries/nav";
import AftercareSheetView, { type SheetData } from "@/components/aftercare/Sheet";
import AcknowledgeButton from "@/components/aftercare/AcknowledgeButton";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Your aftercare instructions" };
export const dynamic = "force-dynamic";

function lines(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/**
 * The patient's own copy.
 *
 * On the dark client surface, but the sheet itself stays a white document.
 * It is something to read and print, and inverting a clinical instruction
 * sheet to match a marketing page would be style at the expense of the thing
 * it is for.
 */
export default async function PatientAftercarePage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser(`/patient/aftercare/${params.id}`);

  const row = await prisma.aftercareSheet.findFirst({
    where: { id: params.id, patientUserId: user.id },
  });
  if (!row) notFound();

  const sheet: SheetData = {
    ...row,
    dos: lines(row.dos),
    donts: lines(row.donts),
    warnings: lines(row.warnings),
  };

  return (
    <>
      <Navbar role="patient" menu={buildPatientMenu()} />
      <main className="bg-[var(--surface)] pb-20 pt-8">
        <div className="container-page">
          <Link
            href="/patient/profile#aftercare"
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted transition hover:text-ink print:hidden"
          >
            <ArrowLeft className="h-4 w-4" /> Back to my profile
          </Link>

          <AftercareSheetView sheet={sheet} />

          {!sheet.acknowledgedAt && (
            <div className="mx-auto mt-4 max-w-3xl print:hidden">
              <AcknowledgeButton id={sheet.id} />
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
