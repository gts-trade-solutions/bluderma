import EntityForm from "@/components/admin/EntityForm";
import { Card, CheckboxField, TextArea, TextField } from "@/components/admin/ui";
import { saveConsultStep } from "@/lib/actions/doctorOnboarding";

/**
 * Step 5 — how the practitioner works.
 *
 * Also where home visits finally become real: ConsultMode.HOME has existed in
 * the schema and been accepted by the booking action since the start, but no
 * code path ever wrote it, so no doctor could offer one.
 */
export default function ConsultStep({
  doctor,
  concerns,
}: {
  doctor: {
    modes: { mode: string }[];
    languages: { name: string }[];
    services: { name: string }[];
    focus: { concern: { key: string } }[];
    travelBufferMin: number;
    requiresApproval: boolean;
    clinics: unknown[];
  };
  concerns: { key: string; label: string }[];
}) {
  const has = (m: string) => doctor.modes.some((x) => x.mode === m);
  const chosen = new Set(doctor.focus.map((f) => f.concern.key));
  const multiClinic = doctor.clinics.length > 1;

  return (
    <EntityForm
      action={saveConsultStep}
      submitLabel="Save and continue"
      cancelHref="/doctor/join?step=4"
      cancelLabel="Back"
      redirectTo="/doctor/join?step=6"
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
        description="Used to match you to clients whose analysis flags these concerns. Pick the ones you genuinely focus on rather than everything you can do — over-claiming just puts you in front of the wrong people."
      >
        <div className="flex flex-wrap gap-1.5">
          {concerns.map((c) => (
            <label
              key={c.key}
              className="cursor-pointer select-none rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 transition has-[:checked]:border-brand-600 has-[:checked]:bg-brand-600 has-[:checked]:text-white"
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
      </Card>

      <Card title="Services and languages">
        <TextArea
          name="services"
          label="Services you offer"
          rows={4}
          defaultValue={doctor.services.map((s) => s.name).join("\n")}
          hint="One per line, or comma separated."
        />
        <TextArea
          name="languages"
          label="Languages you consult in"
          rows={2}
          defaultValue={doctor.languages.map((l) => l.name).join(", ")}
          hint="Comma separated. e.g. English, Tamil, Hindi"
        />
      </Card>

      <Card
        title="Your diary"
        description="How much control you want over what lands in it."
      >
        {multiClinic && (
          <TextField
            name="travelBufferMin"
            label="Travel time between your clinics (minutes)"
            type="number"
            min={0}
            max={240}
            defaultValue={String(doctor.travelBufferMin)}
            hint="We block this much either side of a booking at a different location, so you are never scheduled somewhere you cannot physically get to."
          />
        )}
        {!multiClinic && (
          <input type="hidden" name="travelBufferMin" value={doctor.travelBufferMin} />
        )}

        <CheckboxField
          name="requiresApproval"
          label="I want to confirm each booking myself"
          defaultChecked={doctor.requiresApproval}
          hint="The slot is held while you decide, and the client is told you are reviewing it. Leave this off and bookings confirm straight away."
        />
      </Card>
    </EntityForm>
  );
}
