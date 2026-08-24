import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import AftercareSheetView, { type SheetData } from "@/components/aftercare/Sheet";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Aftercare sheet" };
export const dynamic = "force-dynamic";

/** Strings out of a Json column, without trusting the column's shape. */
function lines(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export default async function DoctorAftercareSheetPage({
  params,
}: {
  params: { id: string };
}) {
  const owner = await getOwnDoctor();
  if (!owner) notFound();

  // Scoped by doctorId as well as id: an id in a URL is an assertion, and one
  // doctor must not be able to read another's sheet by guessing.
  const row = await prisma.aftercareSheet.findFirst({
    where: { id: params.id, doctorId: owner.doctorId },
  });
  if (!row) notFound();

  const sheet: SheetData = {
    ...row,
    dos: lines(row.dos),
    donts: lines(row.donts),
    warnings: lines(row.warnings),
  };

  return (
    <div className="pb-10">
      <Link
        href="/doctor/portal/aftercare"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-900 print:hidden"
      >
        <ArrowLeft className="h-4 w-4" /> All sheets
      </Link>
      <AftercareSheetView sheet={sheet} />
    </div>
  );
}
