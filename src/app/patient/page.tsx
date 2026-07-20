import { redirect } from "next/navigation";

// The patient experience begins at the Skin Analyzer. The former treatment
// hub was clinical/doctor-facing content and is intentionally not shown to
// patients, so this route now sends patients to their starting point.
export default function PatientIndex() {
  redirect("/patient/skin-analyzer");
}
