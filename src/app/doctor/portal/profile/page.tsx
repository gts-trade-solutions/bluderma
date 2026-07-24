import Link from "next/link";

import { requireRole } from "@/lib/session";
import { getDoctorForUser } from "@/lib/queries/doctorPortal";
import { updateOwnAvailability, updateOwnProfile } from "@/lib/actions/doctor";
import EntityForm from "@/components/admin/EntityForm";
import ImageField from "@/components/admin/ImageField";
import {
  Card,
  EmptyState,
  TextArea,
  TextField,
} from "@/components/admin/ui";

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

  const profileAction = async (formData: FormData) => {
    "use server";
    return updateOwnProfile(formData);
  };
  const availabilityAction = async (formData: FormData) => {
    "use server";
    return updateOwnAvailability(formData);
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
                No days selected means patients can&apos;t book you at all.
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
      </div>
    </>
  );
}
