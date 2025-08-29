export const dynamic = "force-dynamic";

import { db } from "@/db/client";
import { offers, messages } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Suspense } from "react";
import ChatStream from "./stream";
import { getBaseUrl } from "@/lib/base-url";

export default async function OfferRoom({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { id } = await params;
  const { session_id } = await searchParams;
  const offerId = Number(id);

  if (session_id) {
    const base = getBaseUrl(); // <= https://… ou http://localhost:3000
    try {
      await fetch(
        `${base}/api/checkout/verify?session_id=${encodeURIComponent(session_id)}`,
        { cache: "no-store" }
      );
    } catch {
      // no-op (on ne bloque pas l'UI)
    }
  }

  // puis on charge sereinement
  const [off] = await db.select().from(offers).where(eq(offers.id, offerId));
  if (!off) return <p>Offre introuvable.</p>;

  const initial = await db.select().from(messages)
    .where(eq(messages.offerId, offerId))
    .orderBy(desc(messages.createdAt))
    .limit(50);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Espace de travail — Offre #{offerId}</h1>
      <Suspense fallback={<div>Chargement…</div>}>
        <ChatStream offerId={offerId} initial={initial} />
      </Suspense>
    </div>
  );
}
