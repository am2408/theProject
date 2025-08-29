export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db/client";
import { payments, projects, users, offers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json();
  const { offerId, reason } = body as { offerId: number; reason?: string };

  // charge user + projet + paiement
  const [me] = await db.select().from(users).where(eq(users.email, session.user.email));
  const [off] = await db.select().from(offers).where(eq(offers.id, offerId));
  if (!me || !off) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [proj] = await db.select().from(projects).where(eq(projects.id, off.projectId));
  if (!proj || proj.clientId !== me.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [pay] = await db.select().from(payments).where(and(eq(payments.offerId, offerId), eq(payments.status, "ESCROWED")));
  if (!pay || !pay.paymentIntentId) return NextResponse.json({ error: "No escrow to refund" }, { status: 400 });

  // Stripe refund
  const refund = await stripe.refunds.create({
    payment_intent: pay.paymentIntentId,
    reason: "requested_by_customer",
  });

  await db.update(payments).set({
    refundRequested: true,
    refundId: refund.id,
    refundReason: reason ?? null,
    status: "REFUND_REQUESTED", // webhook confirmera REFUNDED
  }).where(eq(payments.id, pay.id));

  return NextResponse.json({ ok: true });
}
