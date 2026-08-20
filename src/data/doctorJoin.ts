/**
 * The onboarding wizard's screens, as content.
 *
 * Index 0 is the account step, which is why the progress rail counts from 1 —
 * "step 1 of 6" reads better than "step 0", and creating a login is not really
 * one of the questions we are asking.
 *
 * Same principle as src/data/intake.ts: the copy lives here so it can be
 * reworded without opening a component.
 */

export interface JoinStep {
  id: string;
  title: string;
  sub: string;
}

export const JOIN_STEPS: JoinStep[] = [
  {
    id: "account",
    title: "List your practice",
    sub: "Start with a login. Everything after this saves as you go, so you can finish it later on any device.",
  },
  {
    id: "about",
    title: "About you",
    sub: "What a client sees first: your name, what you do, and why they should trust you with their skin.",
  },
  {
    id: "credentials",
    title: "Your registration",
    sub: "We check every practitioner's council registration before they go live. Nothing here is shown publicly. It is what earns the verified mark.",
  },
  {
    id: "clinics",
    title: "Where you practise",
    sub: "Add every location you consult at. Clients search by area, so the address matters as much as the name.",
  },
  {
    id: "hours",
    title: "Your hours",
    sub: "When you see clients, at each location. A morning session at one clinic and an evening at another is normal, add both.",
  },
  {
    id: "consult",
    title: "How you consult",
    sub: "What you offer, who you treat, and how much control you want over your own diary.",
  },
  {
    id: "review",
    title: "Send it to us",
    sub: "A quick check that nothing is missing, then it goes to our team.",
  },
];

/** JS getDay() order, because that is what DoctorAvailability stores. */
export const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

export const WEEKDAY_LABEL: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

/**
 * The councils an Indian practitioner is most likely to be registered with.
 * A free-text fallback is offered too — this is a convenience, not a whitelist.
 */
export const MEDICAL_COUNCILS = [
  "National Medical Commission (NMC)",
  "Tamil Nadu Medical Council",
  "Karnataka Medical Council",
  "Maharashtra Medical Council",
  "Delhi Medical Council",
  "Telangana State Medical Council",
  "Kerala State Medical Council",
  "Andhra Pradesh Medical Council",
  "West Bengal Medical Council",
  "Gujarat Medical Council",
];

export const COMMON_FACILITIES = [
  "Parking",
  "Lift access",
  "Wheelchair access",
  "In-house pharmacy",
  "Lab collection",
  "Card payment",
  "Valet parking",
];
