export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/db/client";
import { payments } from "@/db/schema";
import { eq } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature") as string;
  const raw = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const s = event.data.object as Stripe.Checkout.Session;
    const pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id;
    await db.update(payments)
      .set({ status: "ESCROWED", paymentIntentId: pi ?? null, sessionStatus: s.status ?? "complete" })
      .where(eq(payments.stripeId, s.id));
  }

  if (event.type === "checkout.session.expired") {
    const s = event.data.object as Stripe.Checkout.Session;
    await db.update(payments)
      .set({ status: "EXPIRED", sessionStatus: s.status ?? "expired" })
      .where(eq(payments.stripeId, s.id));
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
    await db.update(payments).set({ status: "REFUNDED" }).where(eq(payments.paymentIntentId, pi ?? ""));
  }

  return NextResponse.json({ received: true });
}
