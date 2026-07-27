import { prisma } from "@/lib/prisma";
import { setUserActive, setUserRole } from "@/lib/actions/admin/users";
import StatusSelect from "@/components/admin/StatusSelect";
import { ToggleButton } from "@/components/admin/RowActions";
import { EmptyState, PageHeader, Pill, Table, Td, Th } from "@/components/admin/ui";

export const metadata = { title: "Users" };
export const dynamic = "force-dynamic";

const ROLE_OPTIONS = [
  { value: "PATIENT", label: "Consultation" },
  { value: "DOCTOR", label: "Doctor" },
  { value: "ADMIN", label: "Admin" },
];

const DATE = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

export default async function UsersPage({
  searchParams,
}: {
  searchParams: { role?: string; q?: string };
}) {
  const role = ["PATIENT", "DOCTOR", "ADMIN"].includes(searchParams.role ?? "")
    ? (searchParams.role as "PATIENT" | "DOCTOR" | "ADMIN")
    : undefined;
  const q = searchParams.q?.trim() || undefined;

  const where = {
    ...(role ? { role } : {}),
    ...(q
      ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] }
      : {}),
  };

  const [users, counts] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        doctor: { select: { name: true, slug: true } },
      },
    }),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
  ]);

  const countBy = Object.fromEntries(counts.map((c) => [c.role, c._count._all]));

  return (
    <>
      <PageHeader
        title="Users"
        description="Every account. Change a role or deactivate an account — this is how you approve or revoke doctor access."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <Tab href="/admin/users" active={!role} label="All" />
        {ROLE_OPTIONS.map((r) => (
          <Tab
            key={r.value}
            href={`/admin/users?role=${r.value}`}
            active={role === r.value}
            label={`${r.label} (${countBy[r.value] ?? 0})`}
          />
        ))}
      </div>

      <form className="mb-5 flex gap-2" action="/admin/users">
        {role && <input type="hidden" name="role" value={role} />}
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name or email…"
          className="w-full max-w-xs rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
        <button className="btn-ghost !px-4 !py-2 text-sm">Search</button>
      </form>

      {users.length === 0 ? (
        <EmptyState title="No users" description="No accounts match this view." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Account</Th>
              <Th className="w-40">Role</Th>
              <Th className="w-40">Doctor record</Th>
              <Th className="w-28">Joined</Th>
              <Th className="w-28 text-right">Active</Th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50/60">
                <Td>
                  <div className="font-semibold text-ink">
                    {u.name ?? "—"}
                  </div>
                  <div className="text-xs text-ink-muted">{u.email}</div>
                </Td>
                <Td>
                  <StatusSelect
                    value={u.role}
                    options={ROLE_OPTIONS}
                    action={async (next) => {
                      "use server";
                      return setUserRole(u.id, next);
                    }}
                  />
                </Td>
                <Td className="text-xs">
                  {u.doctor ? (
                    <a
                      href={`/admin/doctors`}
                      className="font-medium text-brand-600 hover:text-brand-700"
                    >
                      {u.doctor.name}
                    </a>
                  ) : u.role === "DOCTOR" ? (
                    <Pill tone="warn">Not linked</Pill>
                  ) : (
                    <span className="text-ink-muted">—</span>
                  )}
                </Td>
                <Td className="text-xs text-ink-muted">
                  {DATE.format(u.createdAt)}
                </Td>
                <Td>
                  <div className="flex justify-end">
                    <ToggleButton
                      active={u.isActive}
                      activeLabel="Active"
                      inactiveLabel="Disabled"
                      action={async (next) => {
                        "use server";
                        return setUserActive(u.id, next);
                      }}
                    />
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

function Tab({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <a
      href={href}
      className={`inline-flex items-center rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
        active
          ? "border-brand-600 bg-brand-600 text-white"
          : "border-slate-200 bg-white text-ink-soft hover:border-brand-300"
      }`}
    >
      {label}
    </a>
  );
}
