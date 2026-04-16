import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "./db";
import { users, accounts } from "./schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
  }),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  events: {
    // Send a welcome email on first sign-up (not on subsequent sign-ins).
    // Fire-and-forget — never block the auth flow on email delivery.
    async createUser({ user }) {
      if (user.email) {
        // Welcome email — fire-and-forget
        import("@/lib/email/templates").then(({ welcomeEmail }) => {
          const { subject, html } = welcomeEmail(user.name ?? null);
          import("@/lib/email/send").then(({ sendEmail }) => {
            sendEmail({ to: user.email!, subject, html }).catch(() => {});
          });
        });

        // Anti-abuse: if this email was used by a recently-deleted account,
        // carry forward their monthly usage so re-creation doesn't reset quota.
        if (user.id) {
          import("@/lib/usage").then(({ carryForwardUsage }) => {
            carryForwardUsage(user.email!, user.id!).catch(() => {});
          });
        }
      }
    },
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
