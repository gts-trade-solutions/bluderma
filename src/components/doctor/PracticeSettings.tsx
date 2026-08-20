import EntityForm from "@/components/admin/EntityForm";
import { Card, CheckboxField, TextField } from "@/components/admin/ui";
import { savePracticeSettings } from "@/lib/actions/doctorPractice";

/**
 * The three levers a practitioner has over their own diary.
 *
 * Kept together and explained in full, because each one silently changes what
 * clients can book — and a setting that quietly costs you appointments is one
 * you should have to read a sentence about before flipping.
 */
export default function PracticeSettings({
  travelBufferMin,
  requiresApproval,
  priorityHoldPerDay,
  multiClinic,
}: {
  travelBufferMin: number;
  requiresApproval: boolean;
  priorityHoldPerDay: number;
  multiClinic: boolean;
}) {
  return (
    <EntityForm
      action={savePracticeSettings}
      submitLabel="Save settings"
      cancelHref="/doctor/portal/calendar"
      cancelLabel="Back to calendar"
    >
      <Card title="How bookings reach you">
        <CheckboxField
          name="requiresApproval"
          label="Confirm each booking myself"
          defaultChecked={requiresApproval}
          hint="The slot is held while you decide and the client is told you are reviewing it. Leave this off and bookings confirm on the spot, fewer people abandon a booking that is instantly confirmed."
        />
      </Card>

      {multiClinic && (
        <Card title="Travel between your clinics">
          <TextField
            name="travelBufferMin"
            label="Minutes needed to get between locations"
            type="number"
            min={0}
            max={240}
            defaultValue={String(travelBufferMin)}
            hint="We block this much either side of a booking at a different clinic. Set it to the worst realistic journey, not the best, an optimistic number here becomes a client waiting in an empty room."
          />
        </Card>
      )}

      <Card
        title="White Collar priority"
        description="Members pay for a better chance at the times everyone wants."
      >
        <TextField
          name="priorityHoldPerDay"
          label="Slots per day held for members"
          type="number"
          min={0}
          max={10}
          defaultValue={String(priorityHoldPerDay)}
          hint="Taken from the end of the day, where demand is highest. The hold lifts 24 hours before, so an unsold slot is never wasted. You lose nothing by turning it on. Zero switches it off."
        />
      </Card>
    </EntityForm>
  );
}
