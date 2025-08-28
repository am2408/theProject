import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/db/client";
import { offers, payments, projects, users } from "@/db/schema";
import { eq } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const { offerId } = await req.json();
  const [off] = await db.select().from(offers).where(eq(offers.id, offerId));
  if (!off || off.status !== "ACCEPTED") return NextResponse.json({ error: "Offer not payable" }, { status: 400 });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    // pour un vrai escrow avec "Stripe Connect", on utiliserait `transfer_group` + connected accounts ;
    // ici MVP: paiement standard vers la plateforme
    line_items: [
      { price_data: { currency: "eur", product_data: { name: `Offre #${offerId}` }, unit_amount: off.price * 100 }, quantity: 1 },
    ],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/offers/${offerId}?paid=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/offers/${offerId}?canceled=1`,
    metadata: { offerId: String(offerId) },
  });

  // enregistre un paiement "pending/escrow" en DB
  await db.insert(payments).values({
    offerId,
    amount: off.price,
    status: "REQUIRES_PAYMENT",
    stripeId: session.id,
  });

  return NextResponse.json({ url: session.url });
}
