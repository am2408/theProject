export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/db/client";
import { payments } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");
  if (!sessionId) return NextResponse.json({ error: "missing session_id" }, { status: 400 });

  // 1) Session Stripe
  const s = await stripe.checkout.sessions.retrieve(sessionId);

  // 2) Ligne DB correspondante
  const [row] = await db.select().from(payments).where(eq(payments.stripeId, sessionId));
  if (!row) return NextResponse.json({ error: "payment row not found" }, { status: 404 });

  const intentId =
    typeof s.payment_intent === "string"
      ? s.payment_intent
      : s.payment_intent?.id ?? null;

  // 3) Maj statut
  if (s.status === "complete" && s.payment_status === "paid") {
    await db
      .update(payments)
      .set({ status: "ESCROWED", sessionStatus: "complete", paymentIntentId: intentId })
      .where(eq(payments.id, row.id));

    // Nettoyage des autres "pending" de la même offre
    await db
      .update(payments)
      .set({ status: "EXPIRED", sessionStatus: "expired" })
      .where(and(eq(payments.offerId, row.offerId), eq(payments.status, "REQUIRES_PAYMENT")));
  } else if (s.status === "expired") {
    await db
      .update(payments)
      .set({ status: "EXPIRED", sessionStatus: "expired" })
      .where(eq(payments.id, row.id));
  } else if (s.status === "open") {
    await db.update(payments).set({ sessionStatus: "open" }).where(eq(payments.id, row.id));
  }

  return NextResponse.json({ ok: true, stripeStatus: s.status, paymentStatus: s.payment_status });
}
