export const dynamic = "force-dynamic";

import { Suspense } from "react";
import SignInClient from "./signin-client";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const { created } = await searchParams; // lu côté serveur, pas de hook client ici
  return (
    <Suspense fallback={<div className="max-w-sm mx-auto">Chargement…</div>}>
      <SignInClient created={created === "1"} />
    </Suspense>
  );
}
