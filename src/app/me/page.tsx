import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

async function toggleRole() {
  "use server";
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not signed in");
  const [me] = await db.select().from(users).where(eq(users.email, session.user.email));
  const nextRole = me?.role === "CLIENT" ? "FREELANCER" : "CLIENT";
  await db.update(users).set({ role: nextRole }).where(eq(users.email, session.user.email));
}

export default async function MePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return <p>Tu dois être connecté.</p>;
  }
  const [me] = await db.select().from(users).where(eq(users.email, session.user.email));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Mon profil</h1>
      <p><b>Nom:</b> {me?.name}</p>
      <p><b>Email:</b> {me?.email}</p>
      <p><b>Rôle:</b> {me?.role}</p>
      <form action={toggleRole}>
        <button className="px-3 py-2 rounded bg-neutral-800 border border-neutral-700">
          Passer en rôle {me?.role === "CLIENT" ? "FREELANCER" : "CLIENT"}
        </button>
      </form>
      <p className="text-sm opacity-70">Le rôle détermine ce que tu peux faire (Client poste un projet, Freelancer propose une offre).</p>
    </div>
  );
}
