import { sendEmail } from "@/lib/email";

/**
 * Telling the client when the clinic changes their appointment.
 *
 * Until now every appointment email went to the patient about something the
 * PATIENT did. Nothing told them when the clinic moved or cancelled a booking
 * — which is the one case where they have no way of finding out on their own.
 *
 * Every function here is best-effort: a failed send is logged and swallowed,
 * because a mail outage must not roll back a change the doctor has already
 * made and can see on their calendar.
 */

const SIGN_OFF = "BluDerma";

function when(at: Date): string {
  return `${at.toISOString().slice(0, 10)} at ${at.toISOString().slice(11, 16)}`;
}

function wrap(lines: string[]): { text: string; html: string } {
  return {
    text: `${lines.join("\n\n")}\n\n${SIGN_OFF}`,
    html: `${lines.map((l) => `<p>${l.replace(/\n/g, "<br/>")}</p>`).join("")}<p>${SIGN_OFF}</p>`,
  };
}

interface Base {
  to: string | null | undefined;
  patientName: string;
  doctorName: string;
  appointmentId: string;
}

/** The doctor accepted a booking that was waiting on them. */
export async function notifyAccepted(
  p: Base & { at: Date; where: string; meetingUrl?: string | null }
) {
  if (!p.to) return;
  const body = wrap([
    `Hi ${p.patientName},`,
    `${p.doctorName} has confirmed your appointment on <strong>${when(p.at)}</strong>.`,
    `Where: ${p.where}`,
    ...(p.meetingUrl ? [`Join here: ${p.meetingUrl}`] : []),
  ]);
  await sendEmail({
    to: p.to,
    template: "booking-confirmation",
    relatedId: p.appointmentId,
    subject: `${p.doctorName} confirmed your appointment`,
    ...body,
  }).catch((e) => console.error("accept notice failed", e));
}

/** The doctor turned a request down. */
export async function notifyDeclined(
  p: Base & { at: Date; reason: string; phone: string }
) {
  if (!p.to) return;
  const body = wrap([
    `Hi ${p.patientName},`,
    `${p.doctorName} is not able to take your appointment on <strong>${when(p.at)}</strong>.`,
    `Reason given: ${p.reason}`,
    `Nothing has been charged. You can pick another time from your BluDerma account${
      p.phone ? `, or call us on ${p.phone}` : ""
    }.`,
  ]);
  await sendEmail({
    to: p.to,
    template: "booking-confirmation",
    relatedId: p.appointmentId,
    subject: `Your appointment with ${p.doctorName} could not be confirmed`,
    ...body,
  }).catch((e) => console.error("decline notice failed", e));
}

/**
 * The CLINIC moved the appointment.
 *
 * Worded so it is unmistakably not something the client did — someone who
 * turns up at the old time because they skimmed an ambiguous email has been
 * failed by the email.
 */
export async function notifyMovedByClinic(
  p: Base & { from: Date; to_: Date; where: string; reason: string; phone: string }
) {
  if (!p.to) return;
  const body = wrap([
    `Hi ${p.patientName},`,
    `We have had to move your appointment with ${p.doctorName}.`,
    `<strong>Was:</strong> ${when(p.from)}\n<strong>Now:</strong> ${when(p.to_)}`,
    `Where: ${p.where}`,
    ...(p.reason ? [`Reason: ${p.reason}`] : []),
    `If the new time does not work, change it from your BluDerma account${
      p.phone ? ` or call us on ${p.phone}` : ""
    }. This did not count against your own reschedule allowance.`,
  ]);
  await sendEmail({
    to: p.to,
    template: "booking-confirmation",
    relatedId: p.appointmentId,
    subject: `Your appointment with ${p.doctorName} has moved`,
    ...body,
  }).catch((e) => console.error("clinic reschedule notice failed", e));
}

/** The clinic cancelled. No fee is ever charged to the client for this. */
export async function notifyCancelledByClinic(
  p: Base & { at: Date; reason: string; phone: string; refundDue: boolean }
) {
  if (!p.to) return;
  const body = wrap([
    `Hi ${p.patientName},`,
    `We are sorry, your appointment with ${p.doctorName} on <strong>${when(p.at)}</strong> has been cancelled by the clinic.`,
    ...(p.reason ? [`Reason: ${p.reason}`] : []),
    p.refundDue
      ? "You have not been charged a cancellation fee, and anything already paid will be refunded to the original payment method. Refunds usually clear within 5-7 working days."
      : "You have not been charged anything for this.",
    `You can book another time from your BluDerma account${
      p.phone ? `, or call us on ${p.phone}` : ""
    }.`,
  ]);
  await sendEmail({
    to: p.to,
    template: "booking-confirmation",
    relatedId: p.appointmentId,
    subject: `Your appointment with ${p.doctorName} has been cancelled`,
    ...body,
  }).catch((e) => console.error("clinic cancel notice failed", e));
}

/** A meeting link was added or changed for a video consultation. */
export async function notifyMeetingLink(
  p: Base & { at: Date; meetingUrl: string }
) {
  if (!p.to) return;
  const body = wrap([
    `Hi ${p.patientName},`,
    `Here is the link for your video consultation with ${p.doctorName} on <strong>${when(p.at)}</strong>.`,
    `Join here: ${p.meetingUrl}`,
    "The link opens a few minutes before the appointment.",
  ]);
  await sendEmail({
    to: p.to,
    template: "booking-confirmation",
    relatedId: p.appointmentId,
    subject: `Your video consultation link`,
    ...body,
  }).catch((e) => console.error("meeting link notice failed", e));
}

/**
 * The DOCTOR is told a booking has landed.
 *
 * The other side of the same gap: no appointment event has ever reached the
 * practitioner, so a doctor who does not habitually refresh the portal finds
 * out about tomorrow's list tomorrow.
 */
export async function notifyDoctorOfBooking(p: {
  to: string | null | undefined;
  doctorName: string;
  patientName: string;
  at: Date;
  where: string;
  needsApproval: boolean;
  appointmentId: string;
  /**
   * The booking intake, already formatted. A doctor deciding whether to accept
   * a request needs to know what it is for — "someone booked 3pm" is not a
   * decision they can make.
   */
  intake?: string | null;
  urgent?: boolean;
  /** Short reason for the subject line, e.g. "Acne or breakouts". */
  reasonLine?: string | null;
}) {
  if (!p.to) return;
  const body = wrap([
    `Hi ${p.doctorName},`,
    p.needsApproval
      ? `${p.patientName} has requested <strong>${when(p.at)}</strong>. The slot is held until you accept or decline it.`
      : `${p.patientName} has booked <strong>${when(p.at)}</strong>.`,
    `Where: ${p.where}`,
    ...(p.intake
      ? [`<strong>What it is for</strong><br/>${p.intake.split("\n").join("<br/>")}`]
      : []),
    p.needsApproval
      ? "Open your calendar to confirm it."
      : "It is on your calendar.",
  ]);
  await sendEmail({
    to: p.to,
    template: "booking-confirmation",
    relatedId: p.appointmentId,
    // The subject carries the reason too — a doctor triaging a full inbox
    // should not have to open each one to find the urgent case.
    subject: p.needsApproval
      ? `${p.urgent ? "[Urgent] " : ""}Appointment request from ${p.patientName}${
          p.reasonLine ? `: ${p.reasonLine}` : ""
        }`
      : `${p.urgent ? "[Urgent] " : ""}New booking: ${p.patientName}${
          p.reasonLine ? `: ${p.reasonLine}` : ""
        }`,
    ...body,
  }).catch((e) => console.error("doctor booking notice failed", e));
}

/**
 * A treatment sheet has been issued.
 *
 * -- Why this exists at all -----------------------------------------------
 * Sheets landed in the patient's profile and nowhere else. For aftercare that
 * was defensible — the patient has just been handed a printout and told to
 * look — but it does not work at all for a pre-treatment sheet, whose entire
 * value is arriving two days early. "Stop your retinoid a week before" sitting
 * unread in a portal is not an instruction, it is a record that one was
 * written.
 *
 * -- What it does NOT contain ---------------------------------------------
 * The instructions themselves. Only the procedure, the date and a link. An
 * email is not a private channel — it sits on a phone lock screen, in a
 * shared family inbox, in a mail client somebody else has open — and a list
 * of what a named person must stop taking before a named dermatological
 * procedure is clinical information about them. The link goes behind the
 * login they already have.
 *
 * Best-effort, like everything else here: a mail outage must not roll back a
 * sheet the doctor has already issued and can see in their list.
 */
export async function notifySheetIssued(p: {
  to: string | null | undefined;
  patientName: string;
  doctorName: string;
  kind: "PRE" | "POST";
  procedure: string;
  procedureDate: Date;
  arriveAt?: string | null;
  sheetId: string;
  baseUrl: string;
}) {
  if (!p.to) return;

  const date = p.procedureDate.toISOString().slice(0, 10);
  const link = `${p.baseUrl.replace(/\/$/, "")}/patient/aftercare/${p.sheetId}`;

  const body =
    p.kind === "PRE"
      ? wrap([
          `Hi ${p.patientName},`,
          `${p.doctorName} has sent you instructions to follow BEFORE your ${p.procedure} on ${date}.`,
          p.arriveAt
            ? `Please arrive at ${p.arriveAt}, which may be earlier than your appointment time.`
            : "",
          `Some of them need a few days' notice, so please read them now rather than the night before: ${link}`,
          "If anything on the list is a problem, ring the clinic before you come rather than turning up — it is far easier to move an appointment than to waste one.",
        ].filter(Boolean))
      : wrap([
          `Hi ${p.patientName},`,
          `${p.doctorName} has issued your aftercare instructions for the ${p.procedure} on ${date}.`,
          `How well this heals depends more on the next fortnight than on the procedure itself, so please read them: ${link}`,
          "The sheet includes the signs that mean you should ring the clinic straight away.",
        ]);

  await sendEmail({
    to: p.to,
    template: p.kind === "PRE" ? "pre-treatment-sheet" : "aftercare-sheet",
    subject:
      p.kind === "PRE"
        ? `Before your ${p.procedure} on ${date}`
        : `Your aftercare instructions from ${p.doctorName}`,
    ...body,
  }).catch((e) => console.error("sheet email failed", e));
}
