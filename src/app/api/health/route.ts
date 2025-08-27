import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  // read
  const list = await db.select().from(users).limit(5);

  // write (idempotent-ish): upsert simple par email
  const email = "demo@devmarket.local";
  const existing = await db.select().from(users).where(eq(users.email, email));
  if (existing.length === 0) {
    await db.insert(users).values({
      name: "Demo User",
      email,
      role: "CLIENT",
      bio: "Client démo",
      skills: '["nextjs","typescript"]',
      rating: 5,
    });
  }

  return NextResponse.json({
    ok: true,
    usersPreview: list,
    note: "DB OK, utilisateur démo inséré si absent",
  });
}
