import { db } from "@/db/client";
import { offers, messages, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import ChatStream from "./stream";

export const dynamic = "force-dynamic";

async function sendMessage(formData: FormData) {
  "use server";
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not signed in");
  const offerId = Number(formData.get("offerId"));
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return;

  const [me] = await db.select().from(users).where(eq(users.email, session.user.email));
  if (!me) throw new Error("User not found");

  // facultatif: vérifier que l'offre est ACCEPTED et que l'utilisateur est client ou freelancer lié à l'offre
  const [off] = await db.select().from(offers).where(eq(offers.id, offerId));
  if (!off) throw new Error("Offer not found");

  await db.insert(messages).values({ offerId, senderId: me.id, text });
}

export default async function OfferRoom({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const [off] = await db.select().from(offers).where(eq(offers.id, id));
  if (!off) return notFound();

  // messages init (SSR)
  const initial = await db.select().from(messages)
    .where(eq(messages.offerId, id))
    .orderBy(desc(messages.createdAt))
    .limit(50);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Espace de travail — Offre #{id}</h1>
      <ChatStream offerId={id} initial={initial} />
      <form action={sendMessage} className="flex gap-2">
        <input type="hidden" name="offerId" value={id} />
        <input name="text" placeholder="Écrire un message…" className="flex-1 px-3 py-2 rounded bg-neutral-900 border border-neutral-800" />
        <button className="px-3 py-2 rounded bg-white text-black">Envoyer</button>
      </form>
      <p className="text-sm opacity-70">Le flux est actualisé toutes les 3s (MVP). Next: realtime KV.</p>
    </div>
  );
}
