import type { Metadata } from "next";
import Script from "next/script";
import { Figtree, Sora } from "next/font/google";
import AuthProvider from "@/components/AuthProvider";
import { baseOpenGraph, siteUrl } from "@/lib/seo";
import "./globals.css";

// The pairing the clinical-startup sites run (Curology, Hims, Ro): a warm
// geometric grotesque for reading, a firmer geometric for headlines. Figtree
// carries the body — open apertures, friendly but precise; Sora carries the
// display type, where its engineered caps give headings the clinical-premium
// voice the single-family setup never had.
const sans = Figtree({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const displayFont = Sora({
  subsets: ["latin"],
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
    <html lang="en-IN" className={`${sans.variable} ${displayFont.variable}`}>
      <body>
        <AuthProvider>{children}</AuthProvider>
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
