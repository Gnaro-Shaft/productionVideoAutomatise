import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'PVA — Production Video Automatisée',
  description: 'AI video production pipeline',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <div className="mx-auto max-w-6xl px-6 py-8">
          <header className="mb-8 flex items-center justify-between border-b border-zinc-800 pb-4">
            <Link href="/" className="text-2xl font-bold tracking-tight">
              PVA <span className="text-zinc-500">Studio</span>
            </Link>
            <Link
              href="/projects/new"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              + New project
            </Link>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
