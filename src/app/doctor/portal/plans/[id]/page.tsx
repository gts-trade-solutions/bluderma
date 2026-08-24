import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHead, Panel } from "@/components/doctor/portalUi";
import PlanEditor, { type PlanItem } from "@/components/doctor/PlanEditor";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { prisma } from "@/lib/prisma";
import { humanIssue } from "@/lib/integrations/treatmentPlanCore";

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
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> All plans
      </Link>

      <PageHead
        title={plan.patient.name ?? "Client"}
        sub={
          plan.patient.publicId
            ? `Treatment plan · ${plan.patient.publicId}`
            : "Treatment plan"
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
          index={1}
        >
          <div className="p-4 sm:p-5">
            {/* The numbers the suggestions were drawn from, so a doctor can
                check the reasoning rather than take it on trust. */}
            {plan.scan && plan.scan.issues.length > 0 ? (
              <ul className="space-y-2.5">
                {plan.scan.issues.map((i) => (
                  <li key={i.issueType}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold capitalize text-slate-700">
                        {humanIssue(i.issueType)}
                      </span>
                      <span className="text-sm font-bold tabular-nums text-slate-900">
                        {i.score === null ? "—" : Math.round(i.score)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-teal-500"
                        style={{ width: `${Math.min(Math.max(i.score ?? 0, 0), 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">
                This plan was started without an analysis.
              </p>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
