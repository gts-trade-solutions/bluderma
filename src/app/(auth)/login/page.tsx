import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import LoginForm from "@/components/auth/LoginForm";
import { getCurrentUser } from "@/lib/session";
import { landingPathForRole } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(landingPathForRole(user.role));

  return (
    // useSearchParams() in the form opts this route out of static rendering,
    // so it needs a Suspense boundary.
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-slate-50" />}>
      <LoginForm />
    </Suspense>
  );
}
