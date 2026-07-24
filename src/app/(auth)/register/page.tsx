import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import RegisterForm from "@/components/auth/RegisterForm";
import { getCurrentUser } from "@/lib/session";
import { landingPathForRole } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false, follow: false },
};

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(landingPathForRole(user.role));

  const googleEnabled =
    !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-slate-50" />}>
      <RegisterForm googleEnabled={googleEnabled} />
    </Suspense>
  );
}
