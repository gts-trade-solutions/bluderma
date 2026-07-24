import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { Role } from "@prisma/client";

import { prisma } from "./prisma";
import { loginSchema } from "./validation";
import { dummyHash, verifyPassword } from "./password";
import { rateLimit } from "./rateLimit";

/** Best-effort client IP from the NextAuth request headers. */
function ipFromReq(req: unknown): string {
  const headers = (req as { headers?: Record<string, string | undefined> })
    ?.headers;
  const fwd = headers?.["x-forwarded-for"];
  if (fwd) return fwd.split(",")[0].trim();
  return headers?.["x-real-ip"] ?? "unknown";
}

/**
 * Google is optional so the app still boots before OAuth credentials are
 * issued — NextAuth throws at startup on a provider with an empty clientId.
 */
const googleConfigured =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

/**
 * How long a JWT may keep a cached role before it is re-read from the
 * database. Without this an admin who demotes or deactivates a user would
 * wait up to `session.maxAge` for it to take effect.
 */
const ROLE_TTL_MS = 5 * 60 * 1000;

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  // Credentials sign-in requires JWT sessions; the adapter still handles
  // OAuth account linking and user creation.
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  secret: process.env.NEXTAUTH_SECRET,

  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        // Throttle credential-stuffing. Two keys: per-email protects one
        // account from targeted guessing; per-IP blunts spraying across many
        // emails from one source. Tripping either fails closed (returns null,
        // indistinguishable from a wrong password). Note: in-memory, so
        // per-process — a multi-instance deploy needs a shared store (see
        // rateLimit.ts). Constant-time compare already blocks timing oracles;
        // this blocks volume.
        const ip = ipFromReq(req);
        const byEmail = rateLimit(`login:email:${email}`, 6, 15 * 60 * 1000);
        const byIp = rateLimit(`login:ip:${ip}`, 20, 15 * 60 * 1000);
        if (!byEmail.ok || !byIp.ok) return null;

        const user = await prisma.user.findUnique({ where: { email } });

        // Always compare against *something* so timing is constant whether or
        // not the account exists.
        const ok = await verifyPassword(
          password,
          user?.passwordHash ?? dummyHash()
        );

        if (!user || !user.passwordHash || !ok || !user.isActive) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),

    ...(googleConfigured
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            allowDangerousEmailAccountLinking: false,
          }),
        ]
      : []),
  ],

  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const existing = await prisma.user.findUnique({
        where: { email: user.email },
        select: { isActive: true },
      });
      // No row yet = first Google sign-in; the adapter is about to create it.
      return existing ? existing.isActive : true;
    },

    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: Role }).role ?? Role.PATIENT;
        token.checkedAt = Date.now();
        return token;
      }

      const expired =
        !token.checkedAt || Date.now() - token.checkedAt > ROLE_TTL_MS;

      if (token.id && (trigger === "update" || expired)) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id },
          select: { role: true, isActive: true, name: true, image: true },
        });

        // Deleted or deactivated mid-session: strip the token so every guard
        // (middleware included) sees an unauthenticated request.
        if (!fresh || !fresh.isActive) return {};

        token.role = fresh.role;
        token.name = fresh.name;
        token.picture = fresh.image;
        token.checkedAt = Date.now();
      }

      return token;
    },

    async session({ session, token }) {
      if (token.id && token.role) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },

  events: {
    async signIn({ user }) {
      if (!user.id) return;
      await prisma.user
        .update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })
        // A failed timestamp write must never block a valid sign-in.
        .catch(() => undefined);
    },
  },
};
