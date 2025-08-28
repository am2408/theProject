import Providers from "./providers";
import "./globals.css";
import Link from "next/link";

export const metadata = { title: "DevMarket" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-black text-white">
        <Providers>
          <header className="p-4 border-b border-neutral-800">
            <nav className="max-w-4xl mx-auto flex gap-4">
              <Link href="/">Home</Link>
              <Link href="/projects">Projets</Link>
              <Link href="/me">Mon profil</Link>
              <Link href="/api/auth/signin">Login</Link>
              <Link href="/api/auth/signup">Sign up</Link>
            </nav>
          </header>
          <main className="max-w-4xl mx-auto p-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
