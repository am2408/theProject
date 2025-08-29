import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/db/client";
import { payments } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature") as string;
  const raw = await req.text();
  let event: Stripe.Event;

  try {
    event = new Stripe(process.env.STRIPE_SECRET_KEY!).webhooks.constructEvent(
      raw,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const offerId = Number(session.metadata?.offerId);
    if (session.payment_status === "paid" && offerId) {
      await db.update(payments).set({ status: "ESCROWED" }).where(eq(payments.stripeId, session.id));
    }
  }

  return NextResponse.json({ received: true });
}
