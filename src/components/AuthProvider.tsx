"use client";

import { SessionProvider } from "next-auth/react";

/**
 * next-auth's SessionProvider is a client component, so it needs this wrapper
 * to be mounted from the (server) root layout.
 */
export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SessionProvider>{children}</SessionProvider>;
}
