import type { NextAuthOptions } from "next-auth";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    // Login email+password
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(creds) {
        if (!creds?.email || !creds?.password) return null;
        const [u] = await db.select().from(users).where(eq(users.email, creds.email));
        if (!u || !u.passwordHash) return null;
        const ok = await bcrypt.compare(creds.password, u.passwordHash);
        if (!ok) return null;
        return { id: String(u.id), name: u.name, email: u.email, role: u.role };
      },
    }),
    // OAuth GitHub (optionnel)
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
  callbacks: {
    // Crée l’utilisateur automatiquement à la première connexion GitHub
    async signIn({ user, account }) {
      if (account?.provider === "github") {
        if (!user.email) return false;
        const existing = await db.select().from(users).where(eq(users.email, user.email));
        if (existing.length === 0) {
          await db.insert(users).values({
            name: user.name ?? "Unnamed",
            email: user.email,
            role: "CLIENT", // par défaut
            bio: "",
            skills: "[]",
            rating: 0,
          });
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      // injecte id/role la 1ère fois
      if (user?.email) {
        const [u] = await db.select().from(users).where(eq(users.email, user.email));
        if (u) {
          token.id = u.id;
          token.role = u.role;
          token.name = u.name;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/api/auth/signin",
  },
};
