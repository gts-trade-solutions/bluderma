/**
 * Navigation for both experiences, built on the server and handed to the
 * (client) Navbar as a prop.
 *
 * Both menus are static and short, and that is a decision rather than an
 * omission. The doctor menu used to be a database-backed mega-menu of every
 * published treatment; it was removed with the clinical reference it belonged
 * to, because a practitioner arriving at /doctor is deciding whether to list
 * with us, not browsing protocols. The catalogue lives on the client side,
 * where the people reading it are.
 *
 * Nothing here touches the database any more, so nothing needs cache().
 */

export interface NavLeaf {
  label: string;
  href: string;
}

export interface NavNode {
  label: string;
  href?: string;
  /** One line saying what the section is for. Shown on hover and in the drawer. */
  tagline?: string;
  children?: NavLeaf[];
}

/* ── Patient experience — static, five entries ────────────────────────── */

/**
 * Five destinations, one per stage of the journey: understand the platform,
 * browse, find a clinician, read your own skin, then track it.
 *
 * Rx Skin, Before & After and Know Yourself are deliberately not here. They
 * are sections a client arrives at from the hub, not top-level destinations,
 * and a nine-item bar made none of the five look important. Both pages are
 * still linked from the hub and the footer.
 */
export function buildPatientMenu(): NavNode[] {
  return [
    {
      label: "Home",
      href: "/",
      tagline: "Your personalised skin and aesthetic journey",
    },
    {
      label: "Treatments",
      href: "/patient/explore",
      tagline: "Explore treatments designed for your skin",
    },
    {
      label: "Doctors",
      href: "/patient/doctors",
      tagline: "Connect with trusted aesthetic experts",
    },
    {
      label: "DIY Diagnosis",
      href: "/patient/skin-analyzer",
      tagline: "Understand your skin from home",
    },
    // "My Profile" used to sit here as well. It is already in the account
    // menu behind the avatar, which is where people look for their own
    // records — listing it twice made the bar longer without making anything
    // easier to find.
    // "For doctors" used to sit here. It was carrying two different jobs at
    // once — an advert aimed at practitioners who have never heard of us, and
    // the only way back for a practitioner who was already signed in — and it
    // did the second badly: a doctor reading the client site pressed it and
    // landed on a page selling them something they had already bought.
    //
    // A signed-in practitioner now navigates from the avatar, which lists the
    // portal's real sections. The pitch keeps its own entry points: the
    // first-visit dialog, and the footer link on every page.
  ];
}

/**
 * The practitioner menu.
 *
 * Static and short on purpose. It used to be a database-backed mega-menu of
 * every published treatment — a clinical reference bolted onto the front door
 * of the doctor side. That answered a question practitioners were not asking
 * here: somebody arriving at /doctor is deciding whether to list with us, not
 * looking up a protocol. The catalogue lives on the client side, where the
 * people browsing it actually are.
 */
export function buildDoctorMenu(
  /**
   * True when a listed practitioner is reading. It changes one entry from an
   * anchor into a real link — "Your portal" used to scroll to a MARKETING
   * SECTION about the portal, which is a reasonable thing to show a stranger
   * and an absurd thing to show somebody who has one.
   */
  opts: { hasPortal?: boolean } = {}
): NavNode[] {
  return [
    { label: "For doctors", href: "/doctor", tagline: "List your practice on BluDerma" },
    { label: "How it works", href: "/doctor#how-it-works", tagline: "Four steps, about ten minutes" },
    opts.hasPortal
      ? {
          label: "Your portal",
          href: "/doctor/portal",
          tagline: "Your calendar, requests and practice",
        }
      : {
          label: "The portal",
          href: "/doctor#portal",
          tagline: "One calendar across every clinic you run",
        },
    { label: "Questions", href: "/doctor#faq", tagline: "Fees, verification, and what we do not do" },
  ];
}
