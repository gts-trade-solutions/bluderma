import { Suspense } from "react";

import Assistant from "@/components/assistant/Assistant";
import Toast from "@/components/Toast";
import type { Metadata } from "next";
import Script from "next/script";
import { THEME_BOOTSTRAP } from "@/lib/theme";
import PayLaterOffer from "@/components/PayLaterOffer";
import ThemeFab from "@/components/ThemeFab";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import AuthProvider from "@/components/AuthProvider";
import { baseOpenGraph, siteUrl } from "@/lib/seo";
import "./globals.css";

/**
 * The type pairing: a crafted display grotesque over a precise UI sans.
 *
 * Bricolage Grotesque carries every heading and every headline figure. It is
 * the one face tried here that could not be mistaken for a default — the
 * letterforms are drawn rather than derived, which is the whole of the brief:
 * the client's note was that the site "feels boring", and a neutral geometric
 * sans is exactly what neutral looks like. It holds the confidence of the
 * Curology reference (heavy, tight, set large) without borrowing its face.
 *
 * Plus Jakarta Sans carries body copy and the portal's small print. A display
 * grotesque at 10–12px, which is most of the doctor dashboard, closes up and
 * stops being readable; this stays open and even down there.
 *
 * Two earlier attempts are recorded because both were reasonable and both
 * were wrong: an editorial serif (Fraunces) read expensive but quiet, against
 * a brief that asked for catchy; and Figtree, which matched the reference's
 * letterforms most closely, was the font the site already had — putting it
 * back would have read as no change at all.
 *
 * ── latin-ext is not optional here ──────────────────────────────────────
 * Google's `latin` subset stops at U+20AC (€). The rupee sign, U+20B9, lives
 * in `latin-ext` (U+20AD–20C0). With `latin` alone every ₹ on the site — the
 * prices, the whole doctor dashboard — fell through to a system font, so the
 * most prominent character on the money screen rendered in Arial next to the
 * brand face. Verified with CSS.getPlatformFontsForNode, which reported the
 * ₹ as one Arial glyph beside eight of ours.
 */
const sans = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-sans",
});

const displayFont = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  // Absolute URLs are built from this. Without it Next warns at build time and
  // every Open Graph image resolves relative, which is a share card that works
  // locally and shows nothing once deployed.
  metadataBase: new URL(siteUrl()),
  title: {
    default: "BluDerma: skin care that starts with your skin",
    template: "%s | BluDerma",
  },
  // The previous description was written for the product this used to be, a
  // "reference platform for medical professionals". The site sells
  // consultations to clients now, and this is the sentence a searcher reads
  // before deciding whether to click.
  // No city list here. Naming six Indian cities is a strong local-search
  // signal and it is also the site announcing where it thinks it belongs,
  // which is the opposite of the brand's read. Local intent is better served
  // on a clinic or doctor page, where the city is a fact about THAT page
  // rather than a label on the whole product.
  description:
    "Scan your skin free, browse every skin, hair and aesthetic treatment we cover, and book the dermatologist who matches what you actually need.",
  keywords: [
    "dermatologist",
    "skin specialist",
    "skin treatment",
    "acne treatment",
    "pigmentation treatment",
    "hair loss treatment",
    "AI skin analysis",
    "BluDerma",
  ],
  applicationName: "BluDerma",
  alternates: { canonical: "/" },
  openGraph: {
    ...baseOpenGraph(),
    title: "BluDerma: skin care that starts with your skin",
    description:
      "One selfie, twelve-plus signals, about thirty seconds. Then the doctors who match what your skin actually needs.",
  },
  twitter: {
    card: "summary_large_image",
    title: "BluDerma",
    description:
      "Scan your skin free, then book the dermatologist who matches what you need.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en-IN"
      className={`${sans.variable} ${displayFont.variable}`}
      // The doctor portal writes `data-rail` here from a blocking inline
      // script, before React hydrates, so the collapsed rail is already
      // correct at first paint. React then finds an attribute the server
      // never sent and warns about it on every portal page load. Scoped to
      // this one element, which is the only place anything does that.
      suppressHydrationWarning
    >
      <head>
        {/*
          The theme, before anything paints.

          It has to be inline, blocking, and in <head>: reading the preference
          from an effect is one frame too late, and a light-theme reader would
          get a full-screen flash of navy on every single navigation. Same
          reasoning as the portal rail's collapsed state, one element up.

          It writes both `data-theme` and, for light, the `theme-light` class —
          which is what makes the ~60 existing light-scope rules apply globally
          without one of them being duplicated. See src/lib/theme.ts.
        */}
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }}
        />
      </head>
      <body>
        <AuthProvider>
          {children}
          {/* Inside AuthProvider so it can greet by name, and in Suspense
              because it reads search params, which opts a route into
              client-side rendering otherwise. */}
          <Suspense fallback={null}>
            <Toast />
          </Suspense>
          {/* One mount covers every audience: the panel asks the server who
              is signed in, so a doctor gets practice answers and a client
              gets their own bookings without this layout knowing which. It
              hides itself on admin and auth routes. */}
          <ThemeFab />
          <Assistant />
          {/*
            The pay-later offer. Mounted once, but it shows itself only on the
            pages that arm it and only after somebody has read most of one —
            see PayLaterOffer. A modal over a page nobody has read yet is an
            advert; this waits for a signal that a cost is being weighed.
          */}
          <PayLaterOffer />
        </AuthProvider>
        {/* Razorpay checkout. lazyOnload keeps it off the critical path —
            it is only needed once someone reaches the payment step. */}
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
