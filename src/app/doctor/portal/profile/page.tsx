import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getDoctorForUser } from "@/lib/queries/doctorPortal";
import {
  addOwnTimeOff,
  removeOwnTimeOff,
  updateOwnAvailability,
  updateOwnProfile,
} from "@/lib/actions/doctor";
import EntityForm from "@/components/admin/EntityForm";
import ImageField from "@/components/admin/ImageField";
import { DeleteButton } from "@/components/admin/RowActions";
import {
  Card,
  EmptyState,
  TextArea,
  TextField,
} from "@/components/admin/ui";

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const DAY_MS = 24 * 60 * 60 * 1000;

export const metadata = { title: "My profile" };
export const dynamic = "force-dynamic";

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

export default async function DoctorProfilePage() {
  const user = await requireRole(["DOCTOR", "ADMIN"], "/doctor/portal/profile");
  const doctor = await getDoctorForUser(user.id);

  if (!doctor) {
    return (
      <EmptyState
        title="No doctor profile linked"
        description="Your account isn't connected to a doctor record yet."
        action={
          user.role === "ADMIN" ? (
            <Link href="/admin/doctors" className="btn-primary">
              Go to Doctors admin
            </Link>
          ) : undefined
        }
      />
    );
  }

  const workDays = new Set(doctor.availability.map((a) => a.dayOfWeek));
  const first = doctor.availability[0];

  const timeOff = await prisma.doctorTimeOff.findMany({
    where: { doctorId: doctor.id, endsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
  });

  const profileAction = async (formData: FormData) => {
    "use server";
    return updateOwnProfile(formData);
  };
  const availabilityAction = async (formData: FormData) => {
    "use server";
    return updateOwnAvailability(formData);
  };
  const timeOffAction = async (formData: FormData) => {
    "use server";
    return addOwnTimeOff(formData);
  };

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">My profile</h1>
        <p className="mt-1 text-sm text-ink-muted">
          These details show on the public site. Your name, fees, rating and
          verification are managed by the clinic admin.
        </p>
      </div>

      <div className="space-y-8">
        <EntityForm
          action={profileAction}
          cancelHref="/doctor/portal"
          submitLabel="Save profile"
        >
          <Card title="About you">
            {/* Name is intentionally read-only — admin-controlled. */}
            <div className="mb-5 rounded-xl bg-slate-50 px-4 py-3 text-sm">
              <span className="font-semibold text-ink">{doctor.name}</span>
              <span className="ml-2 text-ink-muted">
                · ₹{doctor.fee} · {Number(doctor.rating)}★ ({doctor.reviews})
              </span>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label="Title"
                name="title"
                required
                defaultValue={doctor.title}
                placeholder="MD, Dermatology"
              />
              <TextField
                label="Specialty"
                name="specialty"
                required
                defaultValue={doctor.specialty}
              />
              <TextField
                label="Clinic"
                name="clinic"
                required
                defaultValue={doctor.clinic}
              />
              <TextField
                label="Location"
                name="location"
                required
                defaultValue={doctor.location}
              />
            </div>

            <div className="mt-5 space-y-5">
              <ImageField
                label="Portrait"
                name="image"
                folder="doctors"
                required
                defaultValue={doctor.image}
              />
              <TextArea
                label="About"
                name="about"
                required
                defaultValue={doctor.about}
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <TextArea
                  label="Languages"
                  name="languages"
                  rows={4}
                  hint="One per line."
                  defaultValue={doctor.languages.map((l) => l.name).join("\n")}
                />
                <TextArea
                  label="Services"
                  name="services"
                  rows={4}
                  hint="One per line."
                  defaultValue={doctor.services.map((s) => s.name).join("\n")}
                />
              </div>
            </div>
          </Card>
        </EntityForm>

        <EntityForm
          action={availabilityAction}
          cancelHref="/doctor/portal"
          submitLabel="Save availability"
        >
          <Card
            title="Availability"
            description="Bookable slots are generated from these hours, minus anything already booked."
          >
            <div>
              <p className="mb-2 text-sm font-semibold text-ink">Working days</p>
              <div className="flex flex-wrap gap-3">
                {DAYS.map((d) => (
                  <label key={d.value} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="workDays"
                      value={d.value}
                      defaultChecked={workDays.has(d.value)}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
                    />
                    <span className="text-ink-soft">{d.label}</span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-ink-muted">
                No days selected means clients can&apos;t book you at all.
              </p>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-3">
              <TextField
                label="Day starts"
                name="workStart"
                type="time"
                required
                defaultValue={first?.startTime ?? "09:00"}
              />
              <TextField
                label="Day ends"
                name="workEnd"
                type="time"
                required
                defaultValue={first?.endTime ?? "17:30"}
              />
              <TextField
                label="Slot length (minutes)"
                name="slotMinutes"
                type="number"
                min={5}
                max={240}
                required
                defaultValue={first?.slotMinutes ?? 30}
              />
            </div>
          </Card>
        </EntityForm>

        <Card
          title="Time off"
          description="Block out holidays or leave. Bookable slots are hidden for these dates, on top of your weekly hours."
        >
          {timeOff.length > 0 && (
            <ul className="mb-6 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {timeOff.map((t) => {
                const start = DATE_FMT.format(t.startsAt);
                const end = DATE_FMT.format(
                  new Date(t.endsAt.getTime() - DAY_MS)
                );
                const range = start === end ? start : `${start} – ${end}`;
                return (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <span>
                      <span className="font-semibold text-ink">{range}</span>
                      {t.reason && (
                        <span className="ml-2 text-ink-muted">· {t.reason}</span>
                      )}
                    </span>
                    <DeleteButton
                      label="Remove"
                      confirmText={`time off (${range})`}
                      action={async () => {
                        "use server";
                        return removeOwnTimeOff(t.id);
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          )}

          <EntityForm
            action={timeOffAction}
            cancelHref="/doctor/portal/profile"
            submitLabel="Add time off"
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField label="From" name="startDate" type="date" required />
              <TextField label="To" name="endDate" type="date" required />
              <TextField
                label="Reason"
                name="reason"
                placeholder="Optional — e.g. Annual leave"
              />
            </div>
          </EntityForm>
        </Card>
      </div>
    </>
  );
}
