import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHead, Panel } from "@/components/doctor/portalUi";
import PlanEditor, { type PlanItem } from "@/components/doctor/PlanEditor";
import PatientBrief from "@/components/doctor/PatientBrief";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { prisma } from "@/lib/prisma";
import { humanIssue } from "@/lib/integrations/treatmentPlanCore";
import { getPatientBrief } from "@/lib/queries/patientBrief";

export const metadata = { title: "Treatment plan" };
export const dynamic = "force-dynamic";

export default async function PlanPage({ params }: { params: { id: string } }) {
  const owner = await getOwnDoctor();
  if (!owner) notFound();

  // Scoped by doctorId as well as id: a plan id in a URL is an assertion.
  const plan = await prisma.treatmentPlan.findFirst({
    where: { id: params.id, doctorId: owner.doctorId },
    select: {
      id: true,
      sharedAt: true,
      patientUserId: true,
      patient: { select: { name: true, publicId: true } },
      items: { orderBy: { sortOrder: "asc" } },
      scan: {
        select: {
          createdAt: true,
          issues: {
            orderBy: { score: "desc" },
            take: 6,
            select: { issueType: true, score: true, severityBand: true },
          },
        },
      },
    },
  });
  if (!plan) notFound();

  /* Who this is for. The screen showed a name and a list of suggestions and
     nothing else about the person — see PatientBrief for why that made the
     plan unplannable. Fetched after the plan so a patient nobody can read
     never costs a query. */
  const brief = await getPatientBrief(owner.doctorId, plan.patientUserId);

  const items: PlanItem[] = plan.items.map((i) => ({
    id: i.id,
    treatment: i.treatment,
    rationale: i.rationale,
    source: i.source,
    state: i.state,
  }));

  return (
    <div className="pb-10">
      <Link
        href="/doctor/portal/plans"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-graphite-500 transition hover:text-graphite-900"
      >
        <ArrowLeft className="h-4 w-4" /> All plans
      </Link>

      <PageHead
        title={`${plan.patient.name ?? "Client"}'s program`}
        mark="program"
        sub={
          plan.sharedAt
            ? "Shared with them — they can read this in their profile. Anything you change from here is visible to them."
            : "A draft. Nothing here reaches the patient until you share it."
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Panel title="Plan" icon="sheet" accent="brand" index={0}>
          <div className="p-4 sm:p-5">
            <PlanEditor
              planId={plan.id}
              items={items}
              sharedAt={
                plan.sharedAt
                  ? plan.sharedAt.toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : null
              }
              aiSource={items.some((i) => i.source === "AI")}
            />
          </div>
        </Panel>

        <div className="space-y-4">
        <Panel
          title="Who this is for"
          sub="Everything that should change what you propose"
          icon="user"
          accent="brand"
          index={1}
        >
          <div className="p-4 sm:p-5">
            {brief ? (
              <PatientBrief brief={brief} />
            ) : (
              <p className="text-sm text-graphite-600">
                This patient&apos;s account is no longer available.
              </p>
            )}
          </div>
        </Panel>

        <Panel
          title="What the analysis measured"
          sub={
            plan.scan
              ? plan.scan.createdAt.toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "No analysis attached"
          }
          icon="pulse"
          accent="violet"
          index={2}
        >
          <div className="p-4 sm:p-5">
            {/* The numbers the suggestions were drawn from, so a doctor can
                check the reasoning rather than take it on trust. */}
            {plan.scan && plan.scan.issues.length > 0 ? (
              <ul className="space-y-2.5">
                {plan.scan.issues.map((i) => (
                  <li key={i.issueType}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold capitalize text-graphite-700">
                        {humanIssue(i.issueType)}
                      </span>
                      <span className="text-sm font-bold tabular-nums text-graphite-900">
                        {i.score === null ? "—" : Math.round(i.score)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-graphite-100">
                      <div
                        className="h-full rounded-full bg-azure-500"
                        style={{ width: `${Math.min(Math.max(i.score ?? 0, 0), 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-graphite-500">
                This plan was started without an analysis.
              </p>
            )}
          </div>
        </Panel>
        </div>
      </div>
    </div>
  );
}
