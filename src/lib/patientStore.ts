// -----------------------------------------------------------------------------
// Patient-side persistence (frontend only — localStorage).
// Stores booked appointments, the patient profile and the latest skin analysis.
// All reads are SSR-safe (guarded by typeof window).
// -----------------------------------------------------------------------------

export interface Appointment {
  id: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  image: string;
  clinic: string;
  location: string;
  dateLabel: string; // "Today", "Tomorrow", weekday
  dateSub: string; // "16 Jun"
  daySeed: string; // YYYY-MM-DD
  time: string; // "10:30"
  mode: "clinic" | "video";
  fee: number;
  patientName: string;
  patientPhone: string;
  createdAt: number;
}

export interface PatientProfile {
  name: string;
  email: string;
  phone: string;
  age: string;
  gender: string;
  city: string;
}

export interface SavedAnalysis {
  overall: number;
  skinType: string;
  estimatedAge: number;
  topConcerns: string[];
  at: number;
}

const APPTS_KEY = "bluderma-appointments";
const PROFILE_KEY = "bluderma-profile";
const ANALYSIS_KEY = "bluderma-last-analysis";

const APPTS_EVENT = "bluderma:appointments";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

/* ------------------------------ Appointments ------------------------------ */

export function getAppointments(): Appointment[] {
  return read<Appointment[]>(APPTS_KEY, []).sort(
    (a, b) => b.createdAt - a.createdAt
  );
}

export function addAppointment(appt: Appointment) {
  const list = read<Appointment[]>(APPTS_KEY, []);
  list.push(appt);
  write(APPTS_KEY, list);
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(APPTS_EVENT));
}

export function cancelAppointment(id: string) {
  const list = read<Appointment[]>(APPTS_KEY, []).filter((a) => a.id !== id);
  write(APPTS_KEY, list);
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(APPTS_EVENT));
}

export function onAppointmentsChange(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(APPTS_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(APPTS_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/* -------------------------------- Profile -------------------------------- */

const EMPTY_PROFILE: PatientProfile = {
  name: "",
  email: "",
  phone: "",
  age: "",
  gender: "",
  city: "",
};

export function getProfile(): PatientProfile {
  return { ...EMPTY_PROFILE, ...read<Partial<PatientProfile>>(PROFILE_KEY, {}) };
}

export function saveProfile(p: PatientProfile) {
  write(PROFILE_KEY, p);
}

/* ------------------------------- Analysis -------------------------------- */

export function saveAnalysis(a: SavedAnalysis) {
  write(ANALYSIS_KEY, a);
}

export function getAnalysis(): SavedAnalysis | null {
  return read<SavedAnalysis | null>(ANALYSIS_KEY, null);
}

/** Simple id generator (client-side). */
export function newId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}
