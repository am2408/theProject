import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { messages } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const offerId = Number(searchParams.get("offerId"));
  if (!offerId) return NextResponse.json({ items: [] });
  const items = await db.select().from(messages).where(eq(messages.offerId, offerId)).orderBy(desc(messages.createdAt)).limit(50);
  return NextResponse.json({ items });
}
