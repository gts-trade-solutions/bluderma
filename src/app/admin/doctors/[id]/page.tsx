import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { saveDoctor } from "@/lib/actions/admin/doctors";
import EntityForm from "@/components/admin/EntityForm";
import ImageField from "@/components/admin/ImageField";
import {
  Card,
  CheckboxField,
  PageHeader,
  TextArea,
  TextField,
} from "@/components/admin/ui";

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

export async function generateMetadata({ params }: { params: { id: string } }) {
  if (params.id === "new") return { title: "New doctor" };
  const d = await prisma.doctor.findUnique({
    where: { id: params.id },
    select: { name: true },
  });
  return { title: d ? `Edit ${d.name}` : "Doctor" };
}

export default async function DoctorEditPage({
  params,
}: {
  params: { id: string };
}) {
  const isNew = params.id === "new";

  const [doctor, concerns] = await Promise.all([
    isNew
      ? null
      : prisma.doctor.findUnique({
          where: { id: params.id },
          include: {
            focus: { include: { concern: { select: { key: true } } } },
            languages: { orderBy: { sortOrder: "asc" } },
            services: { orderBy: { sortOrder: "asc" } },
            modes: true,
            availability: { orderBy: { dayOfWeek: "asc" } },
            user: { select: { email: true } },
          },
        }),
    prisma.skinConcern.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { key: true, label: true },
    }),
  ]);

  if (!isNew && !doctor) notFound();

  const focusKeys = new Set(doctor?.focus.map((f) => f.concern.key) ?? []);
  const workDays = new Set(doctor?.availability.map((a) => a.dayOfWeek) ?? []);
  const first = doctor?.availability[0];
  const offersClinic = doctor?.modes.some((m) => m.mode === "CLINIC") ?? true;
  const offersVideo = doctor?.modes.some((m) => m.mode === "VIDEO") ?? false;

  const action = async (formData: FormData) => {
    "use server";
    return saveDoctor(isNew ? null : params.id, formData);
  };

  return (
    <>
      <PageHeader
        title={isNew ? "New doctor" : `Edit ${doctor!.name}`}
        description={
          doctor?.userId
            ? "This doctor has a linked login and can see their own appointments."
            : "Directory record only — no login attached yet."
        }
      />

      <EntityForm
        action={action}
        cancelHref="/admin/doctors"
        redirectTo={isNew ? "/admin/doctors" : undefined}
        submitLabel={isNew ? "Create doctor" : "Save changes"}
      >
        <Card title="Profile">
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Name"
              name="name"
              required
              defaultValue={doctor?.name}
              placeholder="Dr. Aarti Menon"
            />
            <TextField
              label="Slug"
              name="slug"
              required
              defaultValue={doctor?.slug}
              placeholder="aarti-menon"
            />
            <TextField
              label="Title"
              name="title"
              required
              defaultValue={doctor?.title}
              placeholder="MD, Dermatology"
            />
            <TextField
              label="Specialty"
              name="specialty"
              required
              defaultValue={doctor?.specialty}
              placeholder="Cosmetic Dermatologist"
            />
            <TextField
              label="Clinic"
              name="clinic"
              required
              defaultValue={doctor?.clinic}
            />
            <TextField
              label="Location"
              name="location"
              required
              defaultValue={doctor?.location}
              placeholder="Bengaluru"
            />
          </div>

          <div className="mt-5 space-y-5">
            <ImageField
              label="Portrait"
              name="image"
              folder="doctors"
              required
              defaultValue={doctor?.image}
            />
            <TextArea
              label="About"
              name="about"
              required
              defaultValue={doctor?.about}
            />
          </div>
        </Card>

        <Card title="Credibility">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <TextField
              label="Rating"
              name="rating"
              type="number"
              step="0.1"
              min={0}
              max={5}
              required
              defaultValue={doctor ? Number(doctor.rating) : 4.5}
            />
            <TextField
              label="Reviews"
              name="reviews"
              type="number"
              min={0}
              required
              defaultValue={doctor?.reviews ?? 0}
            />
            <TextField
              label="Experience (years)"
              name="experienceYears"
              type="number"
              min={0}
              required
              defaultValue={doctor?.experienceYears ?? 0}
            />
            <TextField
              label="Consultation fee (₹)"
              name="fee"
              type="number"
              min={0}
              required
              defaultValue={doctor?.fee ?? 800}
              hint="Existing bookings keep the fee they were made at."
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <CheckboxField
              label="Verified"
              name="verified"
              defaultChecked={doctor?.verified ?? true}
            />
            <CheckboxField
              label="Generalist"
              name="isGeneral"
              hint="Always kept in the suggested list."
              defaultChecked={doctor?.isGeneral ?? false}
            />
            <CheckboxField
              label="Active"
              name="isActive"
              hint="Hidden doctors can't be booked."
              defaultChecked={doctor?.isActive ?? true}
            />
          </div>
        </Card>

        <Card
          title="Focus areas"
          description="Drives which doctors are suggested for a patient's top concerns."
        >
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {concerns.map((c) => (
              <label key={c.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="focus"
                  value={c.key}
                  defaultChecked={focusKeys.has(c.key)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
                />
                <span className="text-ink-soft">{c.label}</span>
              </label>
            ))}
          </div>
        </Card>

        <Card title="Languages & services">
          <div className="grid gap-5 sm:grid-cols-2">
            <TextArea
              label="Languages"
              name="languages"
              rows={4}
              hint="One per line."
              defaultValue={doctor?.languages.map((l) => l.name).join("\n") ?? ""}
            />
            <TextArea
              label="Services"
              name="services"
              rows={4}
              hint="One per line."
              defaultValue={doctor?.services.map((s) => s.name).join("\n") ?? ""}
            />
          </div>
        </Card>

        <Card
          title="Availability"
          description="Bookable slots are generated from these hours, minus anything already booked."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <CheckboxField
              label="In-clinic visits"
              name="offersClinic"
              defaultChecked={offersClinic}
            />
            <CheckboxField
              label="Video consults"
              name="offersVideo"
              defaultChecked={offersVideo}
            />
          </div>

          <div className="mt-5">
            <p className="mb-2 text-sm font-semibold text-ink">Working days</p>
            <div className="flex flex-wrap gap-3">
              {DAYS.map((d) => (
                <label key={d.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="workDays"
                    value={d.value}
                    defaultChecked={
                      doctor ? workDays.has(d.value) : d.value !== 0
                    }
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
                  />
                  <span className="text-ink-soft">{d.label}</span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-muted">
              No days selected means no bookable slots at all.
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

          <div className="mt-5">
            <TextField
              label="Sort order"
              name="sortOrder"
              type="number"
              min={0}
              defaultValue={doctor?.sortOrder ?? 0}
            />
          </div>
        </Card>

        <Card
          title="Login account"
          description="Link this directory profile to a login so the doctor can sign in and see their own appointments. Leave blank for a directory-only listing."
        >
          <TextField
            label="Account email"
            name="linkedUserEmail"
            type="email"
            defaultValue={doctor?.user?.email ?? ""}
            placeholder="doctor@example.com"
            hint="The account must already exist and have the Doctor role (set it under Users). Clearing this field unlinks the login."
          />
        </Card>
      </EntityForm>
    </>
  );
}
