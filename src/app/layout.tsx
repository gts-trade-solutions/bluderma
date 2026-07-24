import type { Metadata } from "next";
import AuthProvider from "@/components/AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "BluDerma — Dermatology & Aesthetic Reference",
    template: "%s | BluDerma",
  },
  description:
    "BluDerma is a dermatology and aesthetic treatment reference platform for medical professionals and patients — explore treatments, indications, solutions and product enquiries.",
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
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
