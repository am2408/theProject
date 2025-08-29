export function getBaseUrl() {
  // Priorité: URL publique que tu as déjà
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  // Vercel (prod/preview) expose VERCEL_URL (sans protocole)
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  // Fallback local dev
  const port = process.env.PORT ?? "3000";
  return `http://localhost:${port}`;
}
