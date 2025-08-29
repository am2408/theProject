import Link from "next/link";
import { db } from "@/db/client";
import { projects, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

async function getData() {
  const rows = await db.query.projects.findMany({
    orderBy: [desc(projects.createdAt)],
  });
  // Optionnel: joindre client
  return rows;
}

export default async function ProjectsPage() {
  const items = await getData();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projets</h1>
        <Link className="px-3 py-2 rounded bg-white text-black" href="/projects/new">
          + Nouveau projet
        </Link>
      </div>
      <ul className="space-y-3">
        {items.map(p => (
          <li key={p.id} className="border border-neutral-800 rounded p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{p.title}</h3>
                <p className="text-sm opacity-70 line-clamp-2">{p.description}</p>
                <p className="text-sm mt-1">Budget: {p.budget ?? "—"} | Statut: {p.status}</p>
              </div>
              <Link href={`/projects/${p.id}`} className="underline">Ouvrir</Link>
            </div>
          </li>
        ))}
      </ul>
      {items.length === 0 && <p>Aucun projet pour l’instant.</p>}
    </div>
  );
}
