export type Role = "doctor" | "patient";

export const ROLE_STORAGE_KEY = "bluderma-role";

interface RoleMeta {
  label: string;
  /** Landing page after the role is chosen (and for the logo link). */
  path: string;
  /** Where the marketing/content sections live (menu anchors resolve here). */
  hubPath: string;
  badge: string;
}

export const roleMeta: Record<Role, RoleMeta> = {
  doctor: {
    label: "Medical Professional",
    path: "/doctor",
    hubPath: "/doctor",
    badge: "Clinical view",
  },
  patient: {
    label: "Patient",
    path: "/patient/skin-analyzer",
    hubPath: "/patient",
    badge: "Patient view",
  },
};
