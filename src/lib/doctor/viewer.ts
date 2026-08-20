/**
 * Who is looking at the practitioner marketing page, and what to offer them.
 *
 * The same five-way ternary was written out in three components and a fourth
 * time as `buildDoctorMenu`'s `hasPortal` condition. They drifted: a doctor
 * mid-application was sent to `/doctor/join` from one and had no portal link
 * at all from another.
 *
 * They now agree, and the answer changed with the flow: a doctor at ANY status
 * has a portal, because the portal is where the application itself lives.
 */

export type DoctorViewer =
  | "guest"
  | "client"
  | "doctor-pending"
  | "doctor-live"
  | "admin";

export interface DoctorCta {
  href: string;
  label: string;
}

export function doctorCta(viewer: DoctorViewer): DoctorCta {
  switch (viewer) {
    case "doctor-live":
    case "admin":
      return { href: "/doctor/portal", label: "Open your portal" };
    case "doctor-pending":
      // Was "Finish your listing" → /doctor/join. The listing is finished in
      // the portal now, so there is one destination for a signed-in doctor
      // whatever state they are in.
      return { href: "/doctor/portal", label: "Continue setting up" };
    default:
      return { href: "/doctor/join", label: "List your practice" };
  }
}

/** Does this viewer have a portal to link to? Any doctor account does. */
export function doctorHasPortal(viewer: DoctorViewer): boolean {
  return (
    viewer === "doctor-live" ||
    viewer === "doctor-pending" ||
    viewer === "admin"
  );
}

/** True for a signed-in practitioner, whatever their approval status. */
export function isDoctorViewer(viewer: DoctorViewer): boolean {
  return viewer === "doctor-live" || viewer === "doctor-pending";
}
