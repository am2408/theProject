"use client";
import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";

export default function Home() {
  const { data: session } = useSession();

  return (
    <main>
      <h1 className="text-3xl font-bold">DevMarket (MVP)</h1>
      <p className="mt-2 opacity-70">Marketplace freelance &lt;-&gt; clients</p>

      {session ? (
        <div className="mt-6 space-y-3">
          <p>Connecté en tant que <b>{session.user?.name}</b></p>
          <div className="flex gap-3">
            <Link className="underline" href="/projects">Voir les projets</Link>
            <Link className="underline" href="/me">Mon profil</Link>
          </div>
          <button onClick={() => signOut()} className="bg-red-500 text-white px-4 py-2 rounded">
            Logout
          </button>
        </div>
      ) : (
        <button onClick={() => signIn("github")} className="bg-white text-black px-4 py-2 rounded mt-6">
          Login avec GitHub
        </button>
      )}
    </main>
  );
}
