/**
 * Social profile links for a practitioner.
 *
 * People type these three different ways — `@drmenon`, `drmenon`, or the full
 * `https://instagram.com/drmenon` — and all three mean the same profile. They
 * are normalised to a full URL on save so that every consumer can render a
 * link without re-deriving the platform, and so a stored value is never a
 * bare handle that some page might paste straight into an href.
 */

export type SocialKey = "instagram" | "facebook" | "linkedin" | "youtube" | "website";

export interface SocialDef {
  key: SocialKey;
  label: string;
  /** Shown in the form so it is obvious what to type. */
  placeholder: string;
  /** Hosts accepted when a full URL is pasted. */
  hosts: string[];
  /** Prefix a bare handle is expanded with. Null = URL required. */
  handleBase: string | null;
}

export const SOCIALS: SocialDef[] = [
  {
    key: "instagram",
    label: "Instagram",
    placeholder: "@yourhandle",
    hosts: ["instagram.com", "www.instagram.com"],
    handleBase: "https://instagram.com/",
  },
  {
    key: "facebook",
    label: "Facebook",
    placeholder: "facebook.com/yourpage",
    hosts: ["facebook.com", "www.facebook.com", "m.facebook.com", "fb.com"],
    handleBase: "https://facebook.com/",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    placeholder: "linkedin.com/in/yourname",
    hosts: ["linkedin.com", "www.linkedin.com", "in.linkedin.com"],
    handleBase: "https://linkedin.com/in/",
  },
  {
    key: "youtube",
    label: "YouTube",
    placeholder: "@yourchannel",
    hosts: ["youtube.com", "www.youtube.com", "youtu.be"],
    handleBase: "https://youtube.com/",
  },
  {
    key: "website",
    label: "Website",
    placeholder: "https://yourclinic.com",
    hosts: [],
    handleBase: null,
  },
];

const BY_KEY = new Map(SOCIALS.map((s) => [s.key, s]));

/** A handle with no slashes, spaces or scheme — safe to append to a base. */
const HANDLE = /^@?[A-Za-z0-9._-]{1,64}$/;

/**
 * Normalises one entry to a full https URL, or null if it cannot be made into
 * one. Never throws — a bad value is dropped rather than saved half-formed.
 */
export function normaliseSocial(key: SocialKey, raw: string | null | undefined): string | null {
  const def = BY_KEY.get(key);
  const value = raw?.trim();
  if (!def || !value) return null;

  // A bare handle, the most common way people enter these.
  if (HANDLE.test(value) && def.handleBase) {
    const handle = value.replace(/^@/, "");
    if (!handle) return null;
    // YouTube channels keep the @, which is part of the modern URL form.
    return def.key === "youtube" ? `${def.handleBase}@${handle}` : `${def.handleBase}${handle}`;
  }

  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  // Only ever store https, and never a credentialed URL.
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  url.protocol = "https:";

  // A named platform must actually point at that platform, or the icon lies
  // about where the link goes.
  if (def.hosts.length && !def.hosts.includes(url.hostname.toLowerCase())) {
    return null;
  }

  return url.toString().replace(/\/$/, "");
}

/** Normalises a whole form's worth in one call. */
export function normaliseSocials(input: Partial<Record<SocialKey, string | null | undefined>>) {
  const out: Partial<Record<SocialKey, string | null>> = {};
  for (const def of SOCIALS) {
    out[def.key] = normaliseSocial(def.key, input[def.key]);
  }
  return out;
}

/** The handle to display for a stored URL, e.g. "@drmenon". */
export function displayHandle(key: SocialKey, url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (key === "website") return u.hostname.replace(/^www\./, "");
    const seg = u.pathname.split("/").filter(Boolean).pop();
    if (!seg) return u.hostname.replace(/^www\./, "");
    return seg.startsWith("@") ? seg : `@${seg}`;
  } catch {
    return null;
  }
}

/** The links a doctor actually has, in display order. */
export function socialLinks(
  doctor: Partial<Record<SocialKey, string | null>>
): { key: SocialKey; label: string; url: string; handle: string }[] {
  return SOCIALS.flatMap((def) => {
    const url = doctor[def.key];
    if (!url) return [];
    return [
      {
        key: def.key,
        label: def.label,
        url,
        handle: displayHandle(def.key, url) ?? def.label,
      },
    ];
  });
}
