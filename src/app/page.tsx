import Image from "next/image";

export default function Home() {
  return (
    <main className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold">DevMarket (MVP)</h1>
      <p className="mt-2 text-gray-600">
        Marketplace freelance &lt;-&gt; clients — Next.js + Drizzle + Vercel Postgres
      </p>
      <a
        className="inline-block mt-6 underline"
        href="/api/health"
        target="_blank"
        rel="noreferrer"
      >
        Tester la DB (/api/health)
      </a>
    </main>
  );
}
