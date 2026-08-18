import type { Metadata } from "next";
import Script from "next/script";
import { Figtree, Sora } from "next/font/google";
import AuthProvider from "@/components/AuthProvider";
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
  title: {
    default: "BluDerma — Dermatology & Aesthetic Reference",
    template: "%s | BluDerma",
  },
  description:
    "BluDerma is a dermatology and aesthetic treatment reference platform for medical professionals and clients — explore treatments, indications, solutions and product enquiries.",
  keywords: [
    "dermatology",
    "aesthetics",
    "skin treatments",
    "BluDerma",
    "Korean skin clinic",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${displayFont.variable}`}>
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
