"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";

export default function SignInClient({ created }: { created?: boolean }) {
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) setError("Identifiants invalides.");
    else window.location.href = "/";
  }

  return (
    <div className="max-w-sm mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Se connecter</h1>
      {created && <p className="text-green-500 text-sm">Compte créé, vous pouvez vous connecter.</p>}
      {error && <p className="text-red-500 text-sm">{error}</p>}

      <form onSubmit={onSubmit} className="grid gap-3">
        <input name="email" type="email" placeholder="Email" className="px-3 py-2 rounded bg-neutral-900 border border-neutral-800" required />
        <input name="password" type="password" placeholder="Mot de passe" className="px-3 py-2 rounded bg-neutral-900 border border-neutral-800" required />
        <button className="px-3 py-2 rounded bg-white text-black">Connexion</button>
      </form>

      <div className="h-px bg-neutral-800" />

      <button
        onClick={() => signIn("github")}
        className="px-3 py-2 rounded bg-black border border-neutral-700"
      >
        Se connecter avec GitHub
      </button>

      <p className="text-sm opacity-70">
        Pas de compte ? <Link className="underline" href="/auth/signup">Créer un compte</Link>
      </p>
    </div>
  );
}
