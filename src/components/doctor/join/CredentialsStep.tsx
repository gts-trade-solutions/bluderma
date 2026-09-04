import EntityForm from "@/components/admin/EntityForm";
import ImageField from "@/components/admin/ImageField";
import { Card, SelectField, TextField } from "@/components/admin/ui";
import { MEDICAL_COUNCILS, REGISTRATION_YEARS } from "@/data/doctorJoin";
import { saveCredentialsStep } from "@/lib/actions/doctorOnboarding";

/**
 * Step 2 — registration.
 *
 * The one part of onboarding the client did not ask for and the platform
 * cannot do without. A directory of practitioners that never checks whether
 * they are registered is not a medical marketplace, and the "verified" badge
 * on every card is a claim we have to be able to stand behind.
 *
 * The year is a dropdown rather than a number input. A spinner on a four-digit
 * year is a control nobody can use — reaching 1998 from a blank field is
 * either twenty-six clicks or typing anyway — and it accepted "19", "0" and
 * "20255" on the way to being corrected, each of which the doctor had to see
 * rejected. A list of the only years that can possibly be right removes the
 * whole category.
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
      submitHint="Saves your registration details and opens the next step. These are checked by our team and never shown publicly."
      cancelHint="Back to the previous step. Your answers there are already saved."
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
              { value: "Other", label: "Other: tell us below" },
            ]}
            required
          />
          <TextField
            name="regNumber"
            label="Registration number"
            defaultValue={doctor.regNumber ?? ""}
            required
          />
          <SelectField
            name="regYear"
            label="Year of registration"
            defaultValue={doctor.regYear ? String(doctor.regYear) : ""}
            options={[
              { value: "", label: "Select a year" },
              ...REGISTRATION_YEARS.map((y) => ({
                value: String(y),
                label: String(y),
              })),
            ]}
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
        <p className="text-xs text-graphite-500">
          Optional at this stage, but an application without one takes longer to
          approve because we have to come back and ask.
        </p>
      </Card>
    </EntityForm>
  );
}
