import Link from "next/link";

import { Empty, PageHead, Panel, Tag } from "@/components/doctor/portalUi";
import { getOwnDoctor } from "@/lib/doctor/guard";
import {
  PATIENTS_PER_PAGE,
  attachPhones,
  getDoctorPatients,
} from "@/lib/queries/doctorPatients";

export const metadata = { title: "Patients" };
export const dynamic = "force-dynamic";

const stamp = (d: Date) =>
  d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * Everyone this practice has seen, searchable.
 *
 * The portal had a patient RECORD — chart, photographs, notes, care sheets,
 * prescriptions — and no way to reach it except by opening a booking that
 * happened to be theirs. This is the front door to all of it.
 *
 * The search is a plain GET form: the term lives in the URL, so a particular
 * search is a link, the back button works, and the page stays server-rendered.
 */
export default async function PatientsPage({
  searchParams,
}: {
  searchParams?: { q?: string; page?: string };
}) {
  const owner = await getOwnDoctor();
  if (!owner) {
    return (
      <Empty
        title="No practice linked"
        body="This account has no practice record yet."
        icon="user"
      />
    );
  }

  const q = (searchParams?.q ?? "").trim();
  const page = Math.max(0, Number(searchParams?.page ?? 0) || 0);

  const found = await getDoctorPatients(owner.doctorId, { q, page });
  const rows = await attachPhones(owner.doctorId, found.rows);

  const pages = Math.ceil(found.total / PATIENTS_PER_PAGE);
  const href = (p: number) =>
    `/doctor/portal/patients?${new URLSearchParams({
      ...(q ? { q } : {}),
      ...(p > 0 ? { page: String(p) } : {}),
    }).toString()}`;

  return (
    <>
      <PageHead
        title="Your patients"
        mark="patients"
        sub="Everybody who has booked with you, whichever location they came to. Open one for their chart, their photographs and what you have prescribed."
      />

      <Panel
        title={q ? `Matching “${q}”` : "Everyone you have seen"}
        sub={
          q
            ? `${found.total} of ${found.allTime}`
            : `${found.allTime} ${found.allTime === 1 ? "person" : "people"}`
        }
        icon="user"
        accent="brand"
        index={0}
        padded={false}
      >
        {/* A GET form, so the search is in the URL and therefore linkable,
            bookmarkable and survivable by the back button. */}
        <form
          method="GET"
          className="flex flex-wrap items-center gap-2 border-b border-graphite-200 bg-graphite-50 px-4 py-3"
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">Search by name, phone or BluDerma id</span>
            <input
              name="q"
              defaultValue={q}
              placeholder="Name, phone number, or BLU-P-…"
              // 16px on a phone: anything smaller and iOS Safari zooms the
              // page in on focus.
              className="w-full rounded-lg border border-graphite-300 bg-white px-3.5 py-2 text-[16px] text-graphite-900 placeholder:text-graphite-500 focus:border-azure-500 focus:outline-none focus:ring-2 focus:ring-azure-100 sm:text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-graphite-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-graphite-800"
          >
            Search
          </button>
          {q && (
            <Link
              href="/doctor/portal/patients"
              className="rounded-lg px-3 py-2 text-sm font-bold text-graphite-600 transition hover:bg-graphite-100 hover:text-graphite-900"
            >
              Clear
            </Link>
          )}
        </form>

        {rows.length === 0 ? (
          <div className="p-5">
            <Empty
              icon="user"
              title={q ? "Nobody matches that" : "No patients yet"}
              body={
                q
                  ? "Try part of a name, the last few digits of a phone number, or their BluDerma id."
                  : "Anybody who books with you appears here, with their whole history against your practice."
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-graphite-100">
            {rows.map((p) => {
              const inner = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate font-portal text-[15px] font-bold text-graphite-900">
                        {p.name}
                      </span>
                      {p.publicId && (
                        <span className="select-all font-mono text-[10.5px] font-semibold tracking-wide text-graphite-500">
                          {p.publicId}
                        </span>
                      )}
                      {!p.userId && <Tag tone="slate">No account</Tag>}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-graphite-600">
                      <span className="font-semibold">
                        {p.visits} visit{p.visits === 1 ? "" : "s"}
                      </span>
                      {p.phone && <span className="tabular-nums">{p.phone}</span>}
                      {p.lastSeen && <span>last {stamp(p.lastSeen)}</span>}
                    </span>
                  </span>

                  {/* The next booking is the reason most people are looked
                      up, so it gets the right-hand column to itself. */}
                  <span className="shrink-0 text-right">
                    {p.nextVisit ? (
                      <>
                        <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-graphite-500">
                          Next
                        </span>
                        <span className="block text-[13px] font-bold tabular-nums text-graphite-900">
                          {stamp(p.nextVisit)}
                        </span>
                      </>
                    ) : (
                      <span className="text-[12px] font-semibold text-graphite-400">
                        Nothing booked
                      </span>
                    )}
                  </span>
                </>
              );

              return (
                <li key={`${p.userId ?? "guest"}-${p.name}-${p.phone ?? ""}`}>
                  {p.userId ? (
                    <Link
                      href={`/doctor/portal/patients/${p.userId}`}
                      className="flex items-center gap-3 px-4 py-3 transition hover:bg-graphite-50 sm:px-5"
                    >
                      {inner}
                    </Link>
                  ) : (
                    // No account, so no record page. Shown anyway: the
                    // walk-in taken over the phone is exactly who somebody
                    // is searching for, and hiding them would look like the
                    // search was broken.
                    <div
                      className="flex cursor-default items-center gap-3 px-4 py-3 sm:px-5"
                      title="Booked without an account, so there is no record page for them."
                    >
                      {inner}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-graphite-200 px-4 py-3">
            <span className="text-[12px] font-semibold text-graphite-600">
              Page {page + 1} of {pages}
            </span>
            <span className="flex gap-2">
              {page > 0 && (
                <Link
                  href={href(page - 1)}
                  className="rounded-lg border border-graphite-300 bg-white px-3 py-1.5 text-[13px] font-bold text-graphite-800 transition hover:bg-graphite-50"
                >
                  Previous
                </Link>
              )}
              {page + 1 < pages && (
                <Link
                  href={href(page + 1)}
                  className="rounded-lg border border-graphite-300 bg-white px-3 py-1.5 text-[13px] font-bold text-graphite-800 transition hover:bg-graphite-50"
                >
                  Next
                </Link>
              )}
            </span>
          </div>
        )}
      </Panel>
    </>
  );
}
