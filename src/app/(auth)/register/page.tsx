import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import RegisterForm from "@/components/auth/RegisterForm";
import { getCurrentUser } from "@/lib/session";
import { postLoginPath } from "@/lib/roles";
import { googleConfigured } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false, follow: false },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams?: { callbackUrl?: string };
}) {
  const user = await getCurrentUser();
  if (user) {
    // Honour the callbackUrl here too. LoginForm routes through
    // postLoginPath, but this guard used to ignore the param entirely — so an
    // already-signed-in client following /login?callbackUrl=/patient/membership
    // was dumped on the analyzer instead of where they asked to go.
    redirect(postLoginPath(searchParams?.callbackUrl ?? "/", user.role));
  }

  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white/[0.04]" />}>
      <RegisterForm googleEnabled={googleConfigured} />
    </Suspense>
  );
}
