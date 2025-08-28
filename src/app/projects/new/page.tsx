import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db/client";
import { projects, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

const schema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  budget: z.coerce.number().int().positive().optional(),
  deadline: z.string().optional(),
});

async function createProject(formData: FormData) {
  "use server";
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not signed in");

  const [me] = await db.select().from(users).where(eq(users.email, session.user.email));
  if (!me) throw new Error("User not found");
  if (me.role !== "CLIENT") throw new Error("Tu dois être en rôle CLIENT pour créer un projet");

  const parsed = schema.parse({
    title: formData.get("title"),
    description: formData.get("description"),
    budget: formData.get("budget"),
    deadline: formData.get("deadline"),
  });

  const inserted = await db.insert(projects).values({
    clientId: me.id,
    title: parsed.title,
    description: parsed.description,
    budget: parsed.budget ?? null,
    deadline: parsed.deadline ? new Date(parsed.deadline) : null,
    status: "OPEN",
  }).returning({ id: projects.id });

  redirect(`/projects/${inserted[0].id}`);
}

export default async function NewProjectPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Nouveau projet</h1>
      <form action={createProject} className="grid gap-3 max-w-xl">
        <input name="title" placeholder="Titre" className="px-3 py-2 rounded bg-neutral-900 border border-neutral-800" required />
        <textarea name="description" placeholder="Description" className="px-3 py-2 rounded bg-neutral-900 border border-neutral-800 h-32" required />
        <input name="budget" type="number" placeholder="Budget (EUR)" className="px-3 py-2 rounded bg-neutral-900 border border-neutral-800" />
        <input name="deadline" type="date" className="px-3 py-2 rounded bg-neutral-900 border border-neutral-800" />
        <button className="px-3 py-2 rounded bg-white text-black w-fit">Créer</button>
      </form>
      <p className="text-sm opacity-70">Astuce: bascule ton rôle sur <code>/me</code> si tu es Freelancer.</p>
    </div>
  );
}
