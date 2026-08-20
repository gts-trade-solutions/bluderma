import EntityForm from "@/components/admin/EntityForm";
import ImageField from "@/components/admin/ImageField";
import { Card, SelectField, TextField } from "@/components/admin/ui";
import { MEDICAL_COUNCILS } from "@/data/doctorJoin";
import { saveCredentialsStep } from "@/lib/actions/doctorOnboarding";

/**
 * Step 2 — registration.
 *
 * The one part of onboarding the client did not ask for and the platform
 * cannot do without. A directory of practitioners that never checks whether
 * they are registered is not a medical marketplace, and the "verified" badge
 * on every card is a claim we have to be able to stand behind.
 */
export default function CredentialsStep({
  doctor,
  redirectTo = "/doctor/join?step=3",
  cancelHref = "/doctor/join?step=1",
}: {
  doctor: {
    regCouncil: string | null;
    regNumber: string | null;
    regYear: number | null;
    licenceDocUrl: string | null;
  };
  /** Overridden when this step is hosted inside the portal. */
  redirectTo?: string;
  cancelHref?: string;
}) {
  const known = doctor.regCouncil && MEDICAL_COUNCILS.includes(doctor.regCouncil);

  return (
    <EntityForm
      action={saveCredentialsStep}
      submitLabel="Save and continue"
      cancelHref={cancelHref}
      cancelLabel="Back"
      redirectTo={redirectTo}
    >
      <Card
        title="Council registration"
        description="Checked against the council's own register before your profile goes live. Not shown publicly."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            name="regCouncil"
            label="Registering council"
            defaultValue={known ? doctor.regCouncil! : ""}
            options={[
              { value: "", label: "Select a council" },
              ...MEDICAL_COUNCILS.map((c) => ({ value: c, label: c })),
              { value: "Other", label: "Other — tell us below" },
            ]}
            required
          />
          <TextField
            name="regNumber"
            label="Registration number"
            defaultValue={doctor.regNumber ?? ""}
            required
          />
          <TextField
            name="regYear"
            label="Year of registration"
            type="number"
            min={1940}
            max={new Date().getUTCFullYear()}
            defaultValue={doctor.regYear ? String(doctor.regYear) : ""}
            required
          />
        </div>
      </Card>

      <Card
        title="Registration certificate"
        description="A photo or scan is fine. It goes to our review team and nowhere else."
      >
        <ImageField
          name="licenceDocUrl"
          label="Certificate"
          defaultValue={doctor.licenceDocUrl ?? ""}
          folder="credentials"
        />
        <p className="text-xs text-slate-500">
          Optional at this stage, but an application without one takes longer to
          approve because we have to come back and ask.
        </p>
      </Card>
    </EntityForm>
  );
}
