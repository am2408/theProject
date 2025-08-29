export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/db/client";
import { offers, payments } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const { offerId } = await req.json();
  const [off] = await db.select().from(offers).where(eq(offers.id, offerId));
  if (!off || off.status !== "ACCEPTED") {
    return NextResponse.json({ error: "Offer not payable" }, { status: 400 });
  }

  // réutilisation éventuelle de la dernière session “open” (idempotence)
  const [last] = await db.select().from(payments)
    .where(eq(payments.offerId, offerId))
    .orderBy(desc(payments.createdAt))
    .limit(1);

  if (last?.status === "ESCROWED") {
    return NextResponse.json({ error: "Already paid" }, { status: 400 });
  }

  if (last?.status === "REQUIRES_PAYMENT" && last.stripeId) {
    try {
      const s = await stripe.checkout.sessions.retrieve(last.stripeId);
      if (s.status === "open" && s.url) {
        return NextResponse.json({ url: s.url });
      }
    } catch {}
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      price_data: {
        currency: "eur",
        product_data: { name: `Offre #${offerId}` },
        unit_amount: off.price * 100,
      },
      quantity: 1,
    }],
    // IMPORTANT: on remettra le statut en DB après vérif via session_id
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/offers/${offerId}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/offers/${offerId}?session_id={CHECKOUT_SESSION_ID}`,
    metadata: { offerId: String(offerId) },
  });

  // une seule ligne “pending”
  await db.insert(payments).values({
    offerId,
    amount: off.price,
    status: "REQUIRES_PAYMENT",
    stripeId: session.id,
    sessionStatus: session.status ?? "open",
  });

  return NextResponse.json({ url: session.url });
}
