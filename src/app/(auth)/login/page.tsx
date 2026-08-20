import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import LoginForm from "@/components/auth/LoginForm";
import { getCurrentUser } from "@/lib/session";
import { postLoginPath } from "@/lib/roles";
import { googleConfigured } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
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
    // useSearchParams() in the form opts this route out of static rendering,
    // so it needs a Suspense boundary.
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white/[0.04]" />}>
      <LoginForm googleEnabled={googleConfigured} />
    </Suspense>
  );
}
