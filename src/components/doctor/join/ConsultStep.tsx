import EntityForm from "@/components/admin/EntityForm";
import ChipMultiSelect from "@/components/doctor/fields/ChipMultiSelect";
import TagPicker from "@/components/doctor/fields/TagPicker";
import { Card, CheckboxField } from "@/components/admin/ui";
import { LANGUAGES, COMMON_LANGUAGES } from "@/data/languages";
import { SPECIALTY_AREAS } from "@/data/specialties";
import { saveConsultStep } from "@/lib/actions/doctorOnboarding";

/**
 * Step 5 — how the practitioner works.
 *
 * Also where home visits finally become real: ConsultMode.HOME has existed in
 * the schema and been accepted by the booking action since the start, but no
 * code path ever wrote it, so no doctor could offer one.
 *
 * ── What is deliberately NOT here ────────────────────────────────────────
 * The diary levers — travel buffer between clinics, and whether each booking
 * waits for approval — used to close this step as a card called "Your diary".
 * They are gone. Onboarding is a practitioner describing their practice, and
 * those two are operating settings about a diary that does not exist yet:
 * asked here they are answered blind, and both have real consequences for
 * what clients can book. They live in My practice instead, alongside the
 * member priority hold, where all three are read together. Nothing was lost —
 * saveConsultStep leaves both columns untouched unless the submission carries
 * the `diarySettings` marker that only that form sets.
 */
export default function ConsultStep({
  doctor,
  concerns,
  redirectTo = "/doctor/join?step=6",
  cancelHref = "/doctor/join?step=4",
  aiEnabled = false,
  treatmentSuggestions = [],
  treatmentVocabulary = [],
}: {
  doctor: {
    modes: { mode: string }[];
    languages: { name: string }[];
    services: { name: string }[];
    specialtyAreas: { name: string }[];
    focus: { concern: { key: string } }[];
    otherFocus: { name: string }[];
    travelBufferMin: number;
    requiresApproval: boolean;
    clinics: unknown[];
  };
  concerns: { key: string; label: string }[];
  /** Overridden when this step is hosted inside the portal. */
  redirectTo?: string;
  cancelHref?: string;
  aiEnabled?: boolean;
  /** Real catalogue names, never invented. */
  treatmentSuggestions?: string[];
  treatmentVocabulary?: string[];
}) {
  const has = (m: string) => doctor.modes.some((x) => x.mode === m);
  const chosen = new Set(doctor.focus.map((f) => f.concern.key));

  return (
    <EntityForm
      action={saveConsultStep}
      submitLabel="Save and continue"
      submitHint="Saves how you consult and opens the last step, where you send the application to us."
      cancelHint="Back to your hours. Nothing on this page is lost."
      cancelHref={cancelHref}
      cancelLabel="Back"
      redirectTo={redirectTo}
    >
      <Card
        title="How you see clients"
        description="Pick everything that applies. Clients filter on this."
      >
        <CheckboxField
          name="offersClinic"
          label="In clinic"
          defaultChecked={has("CLINIC") || doctor.modes.length === 0}
        />
        <CheckboxField name="offersVideo" label="Video consultation" defaultChecked={has("VIDEO")} />
        <CheckboxField
          name="offersHome"
          label="Home visits"
          defaultChecked={has("HOME")}
          hint="Booked against your clinic hours, since you travel during a slot you would otherwise be consulting in. A surcharge is added automatically."
        />
      </Card>

      <Card
        title="What you treat"
        description="Used to match you to clients whose analysis flags these concerns. Pick the ones you genuinely focus on rather than everything you can do. Over-claiming just puts you in front of the wrong people."
      >
        <div className="flex flex-wrap gap-1.5">
          {concerns.map((c) => (
            <label
              key={c.key}
              className="cursor-pointer select-none rounded-full border border-graphite-200 px-3 py-1.5 text-sm font-semibold text-graphite-600 transition has-[:checked]:border-azure-600 has-[:checked]:bg-azure-600 has-[:checked]:text-white"
            >
              <input
                type="checkbox"
                name="concerns"
                value={c.key}
                defaultChecked={chosen.has(c.key)}
                className="sr-only"
              />
              {c.label}
            </label>
          ))}
        </div>

        {/*
          The "and something you do not list" case.

          A fixed set of chips quietly tells a practitioner that anything not
          on it does not count, and dermatology is far too wide a field for a
          curated list to be complete. These are stored apart from the matched
          concerns — see DoctorConcernOther — because they are shown on the
          profile but must not silently join the analyzer's matching index
          under a phrase nobody curated.
        */}
        <div className="mt-5 border-t border-graphite-100 pt-5">
          <TagPicker
            name="otherConcerns"
            label="Something else you treat"
            hint="Anything the list above does not cover, in your own words. Shown on your profile. It will not be used to match you to a skin analysis until we have added it properly, and we will tell you when we do."
            placeholder="Type it and press Enter — e.g. hidradenitis suppurativa"
            defaultSelected={doctor.otherFocus.map((f) => f.name)}
            options={[]}
            max={12}
            emptyNote="Nothing extra. The list above may well cover you."
          />
        </div>
      </Card>

      {/*
        Areas of speciality — a third axis, and genuinely not either of its
        neighbours. `specialty` is the one qualification line on the card;
        services below are the procedures performed. This is what a
        practitioner is known FOR, which is the question a referring doctor
        asks and the one neither of the others answers.
      */}
      <Card
        title="Areas of speciality"
        description="What you would want to be called about. Two or three, not fifteen: a practitioner who claims depth in everything has told a reader nothing."
      >
        <TagPicker
          name="specialtyAreas"
          label="What you are known for"
          hint="Search the list or type your own. Shown on your profile, and it is what a referring doctor reads first."
          placeholder="Search — acne scarring, hair loss, melasma…"
          defaultSelected={doctor.specialtyAreas.map((s) => s.name)}
          options={SPECIALTY_AREAS.map((v) => ({ value: v }))}
          common={[
            "Acne and acne scarring",
            "Pigmentation and melasma",
            "Hair loss and thinning",
            "Anti-ageing and skin rejuvenation",
            "Laser hair removal",
            "Botulinum toxin",
          ]}
          max={8}
          emptyNote="Nothing yet. This is the field clients and referrers read hardest."
        />
      </Card>

      <Card title="Services and languages">
        <ChipMultiSelect
          name="services"
          label="Treatments you offer"
          hint="Tap what applies, search for more, or type your own. These are what clients search by."
          defaultSelected={doctor.services.map((s) => s.name)}
          suggestions={treatmentSuggestions}
          vocabulary={treatmentVocabulary}
          aiEnabled={aiEnabled}
        />

        {/*
          Languages were a comma-separated textarea hinting "English, Tamil,
          Hindi". It produced "tamil", "Tamil ", "Tam" and "English/Tamil"
          across profiles, none of which can be filtered on, and a client who
          needs a consultation in Marathi had no way to find one.
        */}
        <TagPicker
          name="languages"
          label="Languages you consult in"
          hint="Search in English or in the language's own script — typing தமிழ் finds Tamil. Add your own if it is not listed."
          placeholder="Search any language…"
          defaultSelected={doctor.languages.map((l) => l.name)}
          options={LANGUAGES.map((l) => ({
            value: l.name,
            alias: l.native,
            note: l.native,
          }))}
          common={COMMON_LANGUAGES}
          max={12}
          emptyNote="At least the one you consult in. Clients filter on this."
        />
      </Card>
    </EntityForm>
  );
}
