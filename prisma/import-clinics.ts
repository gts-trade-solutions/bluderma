/**
 * RETIRED — 18 Aug 2026. Do not run this.
 *
 * It imported 30 real Chennai and Kerala businesses into the Doctor table as
 * clinic contacts. That was wrong twice: they are companies rather than
 * practitioners, so they never belonged in a doctor directory; and the ratings,
 * fees and availability grids attached to them were invented, which
 * misrepresents businesses that actually trade under those names.
 *
 * prisma/seed-clinics.ts removed those rows and replaced them with a clearly
 * fictional demo network. Running this again would undo that, so it refuses
 * unless you pass --i-know-this-reimports-real-businesses.
 *
 * Kept rather than deleted because prisma/clinics.json is the record of where
 * that data came from, and a future real-clinic onboarding may want the source.
 * Any such import must target the Clinic table, not Doctor.
 *
 *   npx tsx prisma/import-clinics.ts          # dry run
 *   npx tsx prisma/import-clinics.ts --write  # apply
 */
import { PrismaClient, ConsultMode } from "@prisma/client";
import fs from "fs";

const prisma = new PrismaClient({ log: ["warn", "error"] });
const WRITE = process.argv.includes("--write");
const AVATAR = "/brand/clinic-avatar.svg";

if (!process.argv.includes("--i-know-this-reimports-real-businesses")) {
  console.error(
    "This importer is retired — see the note at the top of the file.\n" +
      "It would re-add 30 real businesses to the doctor directory as fake\n" +
      "practitioners, undoing prisma/seed-clinics.ts."
  );
  process.exit(1);
}

type Row = {
  company_id: string;
  company_name: string;
  company_type: string;
  region: string;
  country: string;
  head_office_address: string;
  website: string;
  phone_main: string;
  email_general: string;
  notes: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
};

const clean = (v: unknown) => String(v ?? "").trim();

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 70) || "clinic"
  );
}
function firstPhone(v: string): string | null {
  const first = v.split(/[/;]/)[0].trim();
  return first || null;
}
function normUrl(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

async function main() {
  const rows: Row[] = JSON.parse(
    fs.readFileSync("prisma/clinics.json", "utf8")
  );
  console.log(`Clinics in snapshot: ${rows.length}${WRITE ? "" : " (dry run)"}`);

  let i = 0;
  for (const r of rows) {
    const id = clean(r.company_id);
    const companyName = clean(r.company_name) || clean(r.contact_name);
    if (!id || !companyName) continue;

    const contactName = clean(r.contact_name);
    const data = {
      name: companyName,
      title:
        contactName && contactName !== companyName
          ? contactName
          : clean(r.company_type) || "Dermatology & Aesthetics",
      specialty: "Dermatology & Aesthetics",
      clinic: companyName,
      location: clean(r.region) || clean(r.country) || "India",
      image: AVATAR,
      phone:
        firstPhone(clean(r.phone_main)) || firstPhone(clean(r.contact_phone)),
      email: clean(r.email_general) || clean(r.contact_email) || null,
      website: normUrl(clean(r.website)),
      about:
        [clean(r.head_office_address), clean(r.notes)]
          .filter(Boolean)
          .join(" — ") || "Dermatology and aesthetics clinic.",
      fee: 0,
      verified: false,
      isGeneral: false,
      isActive: true,
      sortOrder: 1000 + i,
    };
    const slug = `${slugify(companyName)}-${id.toLowerCase()}`;
    i++;

    if (!WRITE) {
      console.log(`${slug}\t${data.name}\t${data.location}\t${data.phone ?? "-"}`);
      continue;
    }
    const doctor = await prisma.doctor.upsert({
      where: { slug },
      update: data,
      create: { slug, ...data },
      select: { id: true },
    });

    // Make the clinic bookable through the slot picker: an in-clinic mode row
    // (the booking action rejects modes the doctor doesn't offer) + Mon–Sat
    // 09:00–17:30 in 30-min slots, mirroring the seeded doctors. Idempotent —
    // skipDuplicates guards the unique keys on re-runs.
    await prisma.doctorMode.createMany({
      data: [{ doctorId: doctor.id, mode: ConsultMode.CLINIC }],
      skipDuplicates: true,
    });
    await prisma.doctorAvailability.createMany({
      data: [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        doctorId: doctor.id,
        dayOfWeek,
        startTime: "09:00",
        endTime: "17:30",
        slotMinutes: 30,
        isActive: true,
      })),
      skipDuplicates: true,
    });
  }
  console.log(`\n${WRITE ? "Imported/updated" : "Would import"} ${i} clinics.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
