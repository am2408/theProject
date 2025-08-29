import { db } from "@/db/client";
import { users } from "@/db/schema";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { eq } from "drizzle-orm";
import Link from "next/link";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["CLIENT", "FREELANCER"]),
  companyName: z.string().optional(),
});

async function signup(formData: FormData) {
  "use server";
  const parsed = schema.parse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
    companyName: formData.get("companyName") || undefined,
  });

  // refuse si l'email existe déjà
  const existing = await db.select().from(users).where(eq(users.email, parsed.email));
  if (existing.length > 0) {
    throw new Error("Cet email est déjà utilisé.");
  }

  const hash = await bcrypt.hash(parsed.password, 10);
  await db.insert(users).values({
    name: parsed.name,
    email: parsed.email,
    passwordHash: hash,
    role: parsed.role,
    companyName: parsed.role === "CLIENT" ? (parsed.companyName ?? null) : null,
    bio: "",
    skills: "[]",
    rating: 0,
  });

  redirect("/auth/signin?created=1");
}

export default async function SignUpPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/");

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Créer un compte</h1>
      <form action={signup} className="grid gap-3">
        <input name="name" placeholder="Nom" className="px-3 py-2 rounded bg-neutral-900 border border-neutral-800" required />
        <input name="email" type="email" placeholder="Email" className="px-3 py-2 rounded bg-neutral-900 border border-neutral-800" required />
        <input name="password" type="password" placeholder="Mot de passe (min 6)" className="px-3 py-2 rounded bg-neutral-900 border border-neutral-800" required />

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input type="radio" name="role" value="CLIENT" defaultChecked /> Client/Boîte
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="role" value="FREELANCER" /> Freelance
          </label>
        </div>

        <input name="companyName" placeholder="Nom de la société (si Client)" className="px-3 py-2 rounded bg-neutral-900 border border-neutral-800" />

        <button className="px-3 py-2 rounded bg-white text-black">Créer le compte</button>
      </form>
      <p className="text-sm opacity-70">
        Déjà un compte ? <Link className="underline" href="/auth/signin">Se connecter</Link>
      </p>
    </div>
  );
}
