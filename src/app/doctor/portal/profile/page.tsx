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
  TextArea,
  TextField,
} from "@/components/admin/ui";
import {
  Empty,
  Panel,
  Tag,
  portalBtnPrimary,
  portalBtnQuiet,
} from "@/components/doctor/portalUi";
import { SOCIALS, socialLinks } from "@/lib/social";
import Combobox from "@/components/doctor/fields/Combobox";
import AssistTextArea from "@/components/doctor/fields/AssistTextArea";
import ChipMultiSelect from "@/components/doctor/fields/ChipMultiSelect";
import { DOCTOR_SPECIALTIES } from "@/data/specialties";
import { aiEnabled } from "@/lib/integrations/aiAssist";
import {
  getSuggestedTreatments,
  getTreatmentVocabulary,
} from "@/lib/queries/treatmentVocabulary";
import {
  advisoryGaps,
  getApplicationGaps,
  type ApplicationGap,
} from "@/lib/doctor/gaps";

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
      <Empty
        title="No doctor profile linked"
        body="Your account isn't connected to a doctor record yet."
        action={
          user.role === "ADMIN" ? (
            <Link href="/admin/doctors" className={portalBtnPrimary}>
              Link this account
            </Link>
          ) : (
            // A doctor used to get no action here at all, while all four
            // sibling pages offered "Complete onboarding". Same offer.
            <Link href="/doctor/join" className={portalBtnPrimary}>
              Complete onboarding
            </Link>
          )
        }
      />
    );
  }

  const workDays = new Set(doctor.availability.map((a) => a.dayOfWeek));
  const first = doctor.availability[0];

  // Same list the wizard checks, filtered to the non-blocking half.
  const advisory = advisoryGaps(await getApplicationGaps(doctor.id));
  const ai = aiEnabled();
  const [treatmentSuggestions, treatmentVocabulary] = await Promise.all([
    getSuggestedTreatments(),
    getTreatmentVocabulary(),
  ]);

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
            {/* The name is editable. Verification, rating, fee and status are
                not — those are the fields that carry standing, and they stay
                with the admin. See updateOwnProfile for the full reasoning. */}
            <div className="mb-5">
              <TextField
                label="Your name"
                name="name"
                required
                defaultValue={doctor.name}
                hint="As it should appear to clients, and matching your medical registration."
              />
              <p className="mt-2 text-xs text-ink-muted">
                {doctor.fee > 0 ? `₹${doctor.fee} consultation` : "Fee on enquiry"}
                {doctor.reviews > 0
                  ? ` · ${Number(doctor.rating)}★ from ${doctor.reviews} reviews`
                  : " · No reviews yet"}
                {" — "}fees are set per location under{" "}
                <Link href="/doctor/portal/practice" className="font-semibold underline">
                  My practice
                </Link>
                . Your rating and verified badge are set by our team.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label="Title"
                name="title"
                required
                defaultValue={doctor.title}
                placeholder="MD, Dermatology"
              />
              <Combobox
                label="Specialty"
                name="specialty"
                required
                defaultValue={doctor.specialty}
                options={DOCTOR_SPECIALTIES}
                hint="Pick one or type your own."
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
              <AssistTextArea
                label="About"
                name="about"
                required
                defaultValue={doctor.about}
                aiEnabled={ai}
                draftTask="draft-about"
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <TextArea
                  label="Languages"
                  name="languages"
                  rows={4}
                  hint="One per line."
                  defaultValue={doctor.languages.map((l) => l.name).join("\n")}
                />
                <ChipMultiSelect
                  label="Treatments you offer"
                  name="services"
                  hint="What clients search by."
                  defaultSelected={doctor.services.map((s) => s.name)}
                  suggestions={treatmentSuggestions}
                  vocabulary={treatmentVocabulary}
                  aiEnabled={ai}
                />
              </div>
            </div>
          </Card>

          <Card
            title="Your links"
            description="Shown on your public listing. Clients look you up before they book, and a profile they can check is a profile they trust."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              {SOCIALS.map((sdef) => (
                <TextField
                  key={sdef.key}
                  label={sdef.label}
                  name={sdef.key}
                  placeholder={sdef.placeholder}
                  defaultValue={doctor[sdef.key] ?? ""}
                  hint={
                    sdef.handleBase
                      ? "A handle or the full link — either works."
                      : undefined
                  }
                />
              ))}
            </div>
            <p className="mt-4 text-xs text-ink-muted">
              Leave a field blank to remove that link. Anything that is not a
              real {SOCIALS.map((x) => x.label).slice(0, 2).join(" or ")} address
              is dropped rather than saved, so a mistyped link never goes live.
            </p>
          </Card>
        </EntityForm>

        <ListingPreview doctor={doctor} gaps={advisory} />

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


/**
 * Everything a client sees, as they see it.
 *
 * The edit form is a set of inputs; it does not answer "what does my listing
 * actually look like now, and what is missing from it". A practitioner asking
 * why nobody books them is usually looking at a listing with no photo, no
 * languages and no links, and had no single place that said so.
 */
function ListingPreview({
  doctor,
  gaps,
}: {
  /** Advisory gaps from lib/doctor/gaps.ts — the same list the wizard uses. */
  gaps: ApplicationGap[];
  doctor: {
    slug: string;
    name: string;
    title: string;
    specialty: string;
    image: string;
    about: string;
    clinic: string;
    location: string;
    fee: number;
    experienceYears: number;
    verified: boolean;
    status: string;
    rating: unknown;
    reviews: number;
    languages: { name: string }[];
    services: { name: string }[];
    focus: { concern: { label: string } }[];
    modes: { mode: string }[];
    regCouncil: string | null;
    regNumber: string | null;
    regYear: number | null;
    instagram: string | null;
    facebook: string | null;
    linkedin: string | null;
    youtube: string | null;
    website: string | null;
  };
}) {
  const links = socialLinks(doctor);


  return (
    <Panel>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            How your listing reads
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Exactly what a client sees before they decide to book you.
          </p>
        </div>
        <Link href={`/patient/book/${doctor.slug}`} className={portalBtnQuiet}>
          Open it
        </Link>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        {doctor.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={doctor.image}
            alt=""
            className="h-24 w-24 shrink-0 rounded-2xl object-cover ring-1 ring-slate-200"
          />
        ) : (
          <div className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl bg-slate-100 text-center text-[11px] font-semibold text-slate-400 ring-1 ring-slate-200">
            No photo
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-bold text-slate-900">
            {doctor.name}
          </p>
          <p className="text-sm text-slate-600">
            {[doctor.title, doctor.specialty].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {[doctor.clinic, doctor.location].filter(Boolean).join(", ")}
          </p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {doctor.verified && <Tag tone="teal">Verified</Tag>}
            {doctor.experienceYears > 0 && (
              <Tag>{doctor.experienceYears} yrs experience</Tag>
            )}
            {doctor.fee > 0 && <Tag>₹{doctor.fee} consultation</Tag>}
            {doctor.reviews > 0 && (
              <Tag>
                {String(doctor.rating)} from {doctor.reviews} reviews
              </Tag>
            )}
          </div>
        </div>
      </div>

      {doctor.about && (
        <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-slate-700">
          {doctor.about}
        </p>
      )}

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Detail label="Treats" items={doctor.focus.map((f) => f.concern.label)} />
        <Detail label="Services" items={doctor.services.map((x) => x.name)} />
        <Detail label="Languages" items={doctor.languages.map((x) => x.name)} />
        <Detail
          label="Consults by"
          items={doctor.modes.map((m) =>
            m.mode === "clinic" ? "In clinic" : m.mode === "video" ? "Video" : "Home visit"
          )}
        />
      </div>

      {/* Registration is never published — it is shown here so the doctor can
          confirm we hold the right details. */}
      {(doctor.regCouncil || doctor.regNumber) && (
        <p className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
          <strong className="font-semibold text-slate-700">
            Registration on file
          </strong>{" "}
          — {[doctor.regCouncil, doctor.regNumber, doctor.regYear].filter(Boolean).join(" · ")}.
          Checked by our team and never shown to clients.
        </p>
      )}

      <div className="mt-5">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
          Your links
        </p>
        {links.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {links.map((l) => (
              <a
                key={l.key}
                href={l.url}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                {l.label} · {l.handle}
              </a>
            ))}
          </div>
        ) : (
          <p className="mt-1.5 text-sm text-slate-400">
            None yet. Add them above.
          </p>
        )}
      </div>

      {gaps.length > 0 && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-bold text-amber-900">
            Your listing is missing {gaps.length === 1 ? "one thing" : `${gaps.length} things`}
          </p>
          <ul className="mt-1.5 list-inside list-disc text-sm text-amber-900/90">
            {gaps.map((g) => (
              <li key={g.key}>{g.label}</li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

function Detail({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      {items.length ? (
        <p className="mt-1 text-sm text-slate-700">{items.join(", ")}</p>
      ) : (
        <p className="mt-1 text-sm text-slate-400">Not set</p>
      )}
    </div>
  );
}
