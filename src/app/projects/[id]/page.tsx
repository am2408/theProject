import { db } from "@/db/client";
import { offers, projects, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { payments } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { and } from "drizzle-orm";
import { redirect as nextRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

async function submitOffer(formData: FormData) {
  "use server";
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not signed in");

  const [me] = await db.select().from(users).where(eq(users.email, session.user.email));
  if (!me) throw new Error("User not found");
  if (me.role !== "FREELANCER") throw new Error("Tu dois être en rôle FREELANCER pour postuler");
  const projectId = Number(formData.get("projectId"));
  const price = Number(formData.get("price"));
  const message = String(formData.get("message") ?? "");

  const parsed = z.object({
    projectId: z.number().int().positive(),
    price: z.number().int().positive(),
    message: z.string().min(5),
  }).parse({ projectId, price, message });

  await db.insert(offers).values({
    projectId: parsed.projectId,
    freelancerId: me.id,
    price: parsed.price,
    message: parsed.message,
    status: "PENDING",
  });

  revalidatePath(`/projects/${parsed.projectId}`);
}

async function acceptOffer(formData: FormData) {
  "use server";
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not signed in");

  const projectId = Number(formData.get("projectId"));
  const offerId = Number(formData.get("offerId"));
  // charge me + projet
  const [me] = await db.select().from(users).where(eq(users.email, session.user.email));
  const [p] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!me || !p) throw new Error("Not found");
  if (me.id !== p.clientId) throw new Error("Forbidden: not owner");
  if (p.status !== "OPEN") throw new Error("Project not open");

  // set l’offre acceptée + rejeter les autres + projet IN_PROGRESS
  await db.update(offers).set({ status: "REJECTED" }).where(eq(offers.projectId, projectId));
  await db.update(offers).set({ status: "ACCEPTED" }).where(eq(offers.id, offerId));
  await db.update(projects).set({ status: "IN_PROGRESS" }).where(eq(projects.id, projectId));

  revalidatePath(`/projects/${projectId}`);
}

async function rejectOffer(formData: FormData) {
  "use server";
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not signed in");

  const offerId = Number(formData.get("offerId"));
  const projectId = Number(formData.get("projectId"));

  const [me] = await db.select().from(users).where(eq(users.email, session.user.email));
  const [p] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!me || !p) throw new Error("Not found");
  if (me.id !== p.clientId) throw new Error("Forbidden");

  await db.update(offers).set({ status: "REJECTED" }).where(eq(offers.id, offerId));
  revalidatePath(`/projects/${projectId}`);
}

// Annuler un paiement en attente (REQUIRES_PAYMENT) => supprime les lignes et repasse en OPEN + offres PENDING
async function cancelPendingPayment(formData: FormData) {
  "use server";
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not signed in");

  const projectId = Number(formData.get("projectId"));
  const offerId = Number(formData.get("offerId"));

  const [me] = await db.select().from(users).where(eq(users.email, session.user.email));
  const [p] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!me || !p) throw new Error("Not found");
  if (me.id !== p.clientId) throw new Error("Forbidden");

  // sécurité: ne supprime que les paiements non capturés
  await db.delete(payments).where(
    and(eq(payments.offerId, offerId), eq(payments.status, "REQUIRES_PAYMENT"))
  );

  // on “désaccepte” l’offre et on rouvre le projet
  await db.update(offers).set({ status: "PENDING" }).where(eq(offers.id, offerId));
  await db.update(projects).set({ status: "OPEN" }).where(eq(projects.id, projectId));

  revalidatePath(`/projects/${projectId}`);
}

// Annuler l’acceptation AVANT paiement (ne touche pas les paiements s’il y en a un)
async function unacceptOffer(formData: FormData) {
  "use server";
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Not signed in");

  const projectId = Number(formData.get("projectId"));
  const offerId = Number(formData.get("offerId"));

  const [me] = await db.select().from(users).where(eq(users.email, session.user.email));
  const [p] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!me || !p) throw new Error("Not found");
  if (me.id !== p.clientId) throw new Error("Forbidden");

  // si un paiement existe déjà en ESCROWED → on bloque (il faudra rembourser)
  const existing = await db.select().from(payments).where(eq(payments.offerId, offerId));
  if (existing.some(r => r.status === "ESCROWED")) {
    throw new Error("Impossible d’annuler: paiement déjà sécurisé. (Prévoir un flux de remboursement)");
  }

  await db.update(offers).set({ status: "PENDING" }).where(eq(offers.id, offerId));
  await db.update(projects).set({ status: "OPEN" }).where(eq(projects.id, projectId));

  revalidatePath(`/projects/${projectId}`);
}


export default async function ProjectDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;          // <-- attendre params
  const projectId = Number(id);

  const [p] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!p) return <p>Projet introuvable.</p>;

  const offrs = await db.query.offers.findMany({
    where: eq(offers.projectId, projectId),
    orderBy: [desc(offers.createdAt)],
  });

  const offerIds = offrs.map(o => o.id);
  const paymentRows = offerIds.length
    ? await db.select().from(payments).where(inArray(payments.offerId, offerIds))
    : [];

  // petit index par offerId -> statut (le plus récent d’abord si plusieurs)
  const payByOffer = new Map<number, string>();
  for (const row of paymentRows) {
    // simple: on garde le dernier statut vu (suffit pour MVP)
    payByOffer.set(row.offerId, row.status);
  }

  const session = await getServerSession(authOptions);
  let meRole: string | null = null;
  if (session?.user?.email) {
    const [me] = await db.select().from(users).where(eq(users.email, session.user.email));
    meRole = me?.role ?? null;
  }

  return (
    <div className="space-y-6">
      <div className="border border-neutral-800 rounded p-4">
        <h1 className="text-2xl font-bold">{p.title}</h1>
        <p className="opacity-80 whitespace-pre-wrap">{p.description}</p>
        <p className="text-sm mt-2">Budget: {p.budget ?? "—"} | Deadline: {p.deadline ? new Date(p.deadline).toDateString() : "—"} | Statut: {p.status}</p>
      </div>

      {meRole === "FREELANCER" && p.status === "OPEN" && (
        <form action={submitOffer} className="grid gap-3 max-w-xl border border-neutral-800 rounded p-4">
          <input type="hidden" name="projectId" value={projectId} />
          <input name="price" type="number" placeholder="Votre prix (EUR)" className="px-3 py-2 rounded bg-neutral-900 border border-neutral-800" required />
          <textarea name="message" placeholder="Message de candidature" className="px-3 py-2 rounded bg-neutral-900 border border-neutral-800 h-28" required />
          <button className="px-3 py-2 rounded bg-white text-black w-fit">Envoyer l’offre</button>
          <p className="text-sm opacity-70">Tu es en rôle FREELANCER, parfait.</p>
        </form>
      )}

      <section>
        <h2 className="text-xl font-semibold mb-2">Offres reçues</h2>
        <ul className="space-y-3">
          {offrs.map(o => (
            <li key={o.id} className="border border-neutral-800 rounded p-4">
              <p><b>Prix:</b> {o.price} EUR</p>
              <p className="opacity-80 whitespace-pre-wrap">{o.message}</p>
              <p className="text-sm mt-1">Statut: {o.status}</p>

              {meRole === "CLIENT" && p.status === "OPEN" && (
                <div className="flex gap-2 mt-3">
                  <form action={acceptOffer}>
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="offerId" value={o.id} />
                    <button className="px-3 py-1 rounded bg-green-500 text-black">Accepter</button>
                  </form>
                  <form action={rejectOffer}>
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="offerId" value={o.id} />
                    <button className="px-3 py-1 rounded bg-red-500 text-white">Refuser</button>
                  </form>
                </div>
              )}

              {/* Lien vers chat si acceptée */}
              {o.status === "ACCEPTED" && (
                <a className="underline mt-2 inline-block" href={`/offers/${o.id}`}>Ouvrir l’espace de travail (chat)</a>
              )}

              {(() => {
                const status = payByOffer.get(o.id); // "REQUIRES_PAYMENT" | "ESCROWED" | "REFUND_REQUESTED" | "REFUNDED" | undefined
                const isEscrowed = status === "ESCROWED";
                const isPendingPay = status === "REQUIRES_PAYMENT";
                const isRefunding = status === "REFUND_REQUESTED";
                const isRefunded = status === "REFUNDED";

                return (
                  <>

                    {o.status === "ACCEPTED" && (
                      <>
                        {isEscrowed && (
                          <p className="mt-2 text-sm opacity-80">Paiement sécurisé reçu (escrow). ✅</p>
                        )}
                        {isRefunding && (
                          <p className="mt-2 text-sm opacity-80">Remboursement demandé… ⏳</p>
                        )}
                        {isRefunded && (
                          <p className="mt-2 text-sm opacity-80">Remboursé. 💸</p>
                        )}

                        {meRole === "CLIENT" && !isEscrowed && !isRefunding && !isRefunded && (
                          <div className="flex gap-2 mt-2">
                            {/* créer ou reprendre un checkout */}
                            <form
                              action={async () => {
                                "use server";
                                const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/checkout`, {
                                  method: "POST",
                                  body: JSON.stringify({ offerId: o.id }),
                                  headers: { "Content-Type": "application/json" },
                                  cache: "no-store",
                                });
                                if (!res.ok) {
                                  let msg = "Checkout failed";
                                  try { const d = await res.json(); msg = d?.error ?? msg; } catch { }
                                  throw new Error(msg);
                                }
                                const data = await res.json();
                                const { redirect } = await import("next/navigation");
                                redirect(data.url as string);
                              }}
                            >
                              <button className="px-3 py-1 rounded bg-yellow-400 text-black">
                                {isPendingPay ? "Reprendre le paiement" : "Payer (escrow)"}
                              </button>
                            </form>

                            {/* annuler l'acceptation / paiement en attente */}
                            {isPendingPay ? (
                              <form action={cancelPendingPayment}>
                                <input type="hidden" name="offerId" value={o.id} />
                                <input type="hidden" name="projectId" value={p.id} />
                                <button className="px-3 py-1 rounded bg-neutral-800 border border-neutral-700">
                                  Annuler le paiement
                                </button>
                              </form>
                            ) : (
                              <form action={unacceptOffer}>
                                <input type="hidden" name="offerId" value={o.id} />
                                <input type="hidden" name="projectId" value={p.id} />
                                <button className="px-3 py-1 rounded bg-neutral-800 border border-neutral-700">
                                  Annuler l’acceptation
                                </button>
                              </form>
                            )}
                          </div>
                        )}

                        {/* Quand c'est ESCROWED, on propose un remboursement (pas de pay/cancel) */}
                        {meRole === "CLIENT" && isEscrowed && (
                          <form
                            action={async (formData) => {
                              "use server";
                              const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/refund`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ offerId: o.id, reason: "Client request" }),
                              });
                              // on pourrait revalidate ici :
                              const { revalidatePath } = await import("next/cache");
                              revalidatePath(`/projects/${p.id}`);
                            }}
                            className="mt-2"
                          >
                            <button className="px-3 py-1 rounded bg-orange-500 text-black">
                              Demander un remboursement
                            </button>
                          </form>
                        )}
                      </>
                    )}
                  </>
                );
              })()}
            </li>
          ))}
          {offrs.length === 0 && <p>Aucune offre pour l’instant.</p>}
        </ul>
      </section>
    </div>
  );
}
