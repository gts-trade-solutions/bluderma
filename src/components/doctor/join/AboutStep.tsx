import EntityForm from "@/components/admin/EntityForm";
import ImageField from "@/components/admin/ImageField";
import { Card, TextArea, TextField } from "@/components/admin/ui";
import { saveAboutStep } from "@/lib/actions/doctorOnboarding";

/** Step 1 — the part of the profile a client actually reads. */
export default function AboutStep({
  doctor,
}: {
  doctor: {
    name: string;
    title: string;
    specialty: string;
    experienceYears: number;
    image: string;
    about: string;
  };
}) {
  return (
    <EntityForm
      action={saveAboutStep}
      submitLabel="Save and continue"
      cancelHref="/doctor"
      cancelLabel="Back"
      redirectTo="/doctor/join?step=2"
    >
      <Card title="Who you are">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField name="name" label="Full name" defaultValue={doctor.name} required />
          <TextField
            name="title"
            label="Qualifications"
            defaultValue={doctor.title}
            hint="As you would like them printed. e.g. MBBS, MD (Dermatology)"
            required
          />
          <TextField
            name="specialty"
            label="Specialty"
            defaultValue={doctor.specialty}
            hint="e.g. Dermatology, Aesthetic medicine, Trichology"
            required
          />
          <TextField
            name="experienceYears"
            label="Years in practice"
            type="number"
            min={0}
            max={70}
            defaultValue={String(doctor.experienceYears)}
            required
          />
        </div>
      </Card>

      <Card
        title="Your photograph"
        description="A clear head-and-shoulders picture. Clients skip listings without one far more often than any other single thing."
      >
        <ImageField name="image" label="Photo" defaultValue={doctor.image} folder="doctors" />
      </Card>

      <Card
        title="About you"
        description="Written in your own words, for someone deciding whether to see you. What you treat most, how you approach it, anything that sets your practice apart."
      >
        <TextArea
          name="about"
          label="Introduction"
          rows={7}
          defaultValue={doctor.about}
          hint="At least a couple of sentences."
          required
        />
      </Card>
    </EntityForm>
  );
}
