import Link from "next/link";
import { DoctorStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { EmptyState, PageHeader, Pill } from "@/components/admin/ui";
import ApplicationReview from "@/components/admin/ApplicationReview";

export const metadata = { title: "Doctor applications" };
export const dynamic = "force-dynamic";

const TONE: Record<string, "success" | "warn" | "danger" | "neutral"> = {
  APPROVED: "success",
  PENDING: "warn",
  DRAFT: "neutral",
  REJECTED: "danger",
  SUSPENDED: "danger",
};

const day = (d: Date | null) =>
  d
    ? d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : "—";

/**
 * The practitioner review queue.
 *
 * Pending first, because that is the actual queue — a doctor waiting on us is
 * a practice not taking bookings. Drafts are shown too, greyed, so it is
 * visible when somebody starts an application and stalls.
 */
export default async function DoctorApplicationsPage({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
  const filter = searchParams?.status?.toUpperCase();
  const valid = Object.values(DoctorStatus).includes(filter as DoctorStatus);

  const [rows, counts] = await Promise.all([
    prisma.doctor.findMany({
      where: valid
        ? { status: filter as DoctorStatus }
        : { status: { not: DoctorStatus.APPROVED } },
      orderBy: [{ submittedAt: "asc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        slug: true,
        name: true,
        title: true,
        specialty: true,
        experienceYears: true,
        image: true,
        about: true,
        phone: true,
        email: true,
        status: true,
        submittedAt: true,
        rejectionReason: true,
        regCouncil: true,
        regNumber: true,
        regYear: true,
        licenceDocUrl: true,
        listedElsewhere: true,
        listedElsewhereNames: true,
        createdAt: true,
        user: { select: { email: true, lastLoginAt: true } },
        clinics: {
          select: {
            feeInr: true,
            isPrimary: true,
            clinic: {
              select: {
                name: true,
                addressLine1: true,
                area: true,
                city: true,
                pincode: true,
                photos: { select: { kind: true, url: true } },
              },
            },
          },
        },
        modes: { select: { mode: true } },
        _count: { select: { availability: true, services: true, languages: true } },
      },
    }),
    prisma.doctor.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const countFor = (s: string) =>
    counts.find((c) => c.status === s)?._count._all ?? 0;

  return (
    <>
      <PageHeader
        title="Doctor applications"
        description="Practitioners who signed themselves up. Nobody appears in search, in recommendations or in booking until they are approved here."
        action={
          <Link href="/admin/doctors" className="btn-ghost">
            Full directory
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {[
          { key: "", label: `Needs attention (${countFor("PENDING") + countFor("DRAFT") + countFor("REJECTED") + countFor("SUSPENDED")})` },
          { key: "PENDING", label: `Waiting on us (${countFor("PENDING")})` },
          { key: "DRAFT", label: `Unfinished (${countFor("DRAFT")})` },
          { key: "REJECTED", label: `Sent back (${countFor("REJECTED")})` },
          { key: "APPROVED", label: `Live (${countFor("APPROVED")})` },
          { key: "SUSPENDED", label: `Paused (${countFor("SUSPENDED")})` },
        ].map((t) => (
          <a
            key={t.key}
            href={
              t.key
                ? `/admin/doctor-applications?status=${t.key}`
                : "/admin/doctor-applications"
            }
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
              (filter ?? "") === t.key
                ? "bg-ink text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {t.label}
          </a>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing to review"
          description="New doctor applications land here as soon as they are submitted."
        />
      ) : (
        <ul className="space-y-4">
          {rows.map((d) => {
            const primary = d.clinics.find((c) => c.isPrimary) ?? d.clinics[0];
            return (
              <li
                key={d.id}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div className="flex flex-wrap items-start gap-4">
                  {d.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={d.image}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-slate-100 text-xs font-semibold text-slate-400">
                      No photo
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-ink">{d.name || "Unnamed"}</h3>
                      <Pill tone={TONE[d.status] ?? "neutral"}>{d.status}</Pill>
                    </div>
                    <p className="text-sm text-ink-muted">
                      {[d.title, d.specialty].filter(Boolean).join(" · ") || (
                        <span className="italic">No qualifications entered</span>
                      )}
                      {d.experienceYears > 0 && ` · ${d.experienceYears} yrs`}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {d.user?.email ?? d.email ?? "no email"}
                      {d.phone ? ` · ${d.phone}` : ""}
                      {d.submittedAt
                        ? ` · submitted ${day(d.submittedAt)}`
                        : ` · started ${day(d.createdAt)}`}
                    </p>
                  </div>
                </div>

                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <Fact label="Registration">
                    {d.regCouncil && d.regNumber ? (
                      <>
                        {d.regNumber}
                        <span className="block text-xs text-ink-muted">
                          {d.regCouncil}
                          {d.regYear ? `, ${d.regYear}` : ""}
                        </span>
                        {d.licenceDocUrl ? (
                          <a
                            /* Certificates sit in a private bucket prefix, so
                               this goes through the signed-view route rather
                               than at the stored URL, which would 403. */
                            href={`/api/uploads/view?url=${encodeURIComponent(
                              d.licenceDocUrl
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-0.5 inline-block text-xs font-semibold text-brand-700 hover:underline"
                          >
                            View certificate →
                          </a>
                        ) : (
                          <span className="mt-0.5 block text-xs font-semibold text-amber-700">
                            No certificate uploaded
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="font-semibold text-rose-600">
                        Not provided: cannot approve
                      </span>
                    )}
                  </Fact>

                  <Fact label="Practice">
                    {primary ? (
                      <>
                        {primary.clinic.name}
                        <span className="block text-xs text-ink-muted">
                          {primary.clinic.addressLine1}, {primary.clinic.area},{" "}
                          {primary.clinic.city} {primary.clinic.pincode}
                        </span>
                        <span className="block text-xs text-ink-muted">
                          {d.clinics.length}{" "}
                          {d.clinics.length === 1 ? "location" : "locations"} ·{" "}
                          {d._count.availability} weekly sessions ·{" "}
                          {primary.feeInr > 0
                            ? `₹${primary.feeInr.toLocaleString("en-IN")}`
                            : "fee on enquiry"}
                        </span>
                      </>
                    ) : (
                      <span className="font-semibold text-rose-600">
                        No location added
                      </span>
                    )}
                  </Fact>

                  {/*
                    Never a reason to refuse anybody. It is here because a
                    practitioner already taking bookings elsewhere has a
                    calendar we cannot see, which is the commonest cause of a
                    clash in their first month — so whoever approves them
                    knows to talk about it.

                    The three states are genuinely three: NULL means the
                    question was skipped, which is not the same as "no", and
                    the column is nullable precisely so this can say so.
                  */}
                  <Fact label="Listed elsewhere">
                    {d.listedElsewhere === true ? (
                      <>
                        Yes
                        <span className="block text-xs text-ink-muted">
                          {d.listedElsewhereNames || "Did not say which"}
                        </span>
                      </>
                    ) : d.listedElsewhere === false ? (
                      "No"
                    ) : (
                      <span className="text-ink-muted">Not answered</span>
                    )}
                  </Fact>
                </dl>

                {d.about && (
                  <p className="mt-3 line-clamp-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {d.about}
                  </p>
                )}

                {d.rejectionReason && (
                  <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                    <strong>Sent back:</strong> {d.rejectionReason}
                  </p>
                )}

                <div className="mt-4 border-t border-slate-100 pt-4">
                  <ApplicationReview
                    doctorId={d.id}
                    status={d.status}
                    name={d.name}
                    canApprove={Boolean(
                      d.regCouncil?.trim() && d.regNumber?.trim() && primary
                    )}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">
        {label}
      </dt>
      <dd className="mt-0.5 text-ink">{children}</dd>
    </div>
  );
}
