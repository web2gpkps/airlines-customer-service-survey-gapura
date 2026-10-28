import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Masuk · Airline CSS Survey",
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = (await searchParams).next;
  const next = typeof raw === "string" ? raw.slice(0, 200) : "/";
  return (
    <main className="mx-auto max-w-md px-4 py-24">
      <div className="card p-8">
        <p className="eyebrow">Airline CSS Survey</p>
        <h1 className="mt-2 text-xl font-bold">Masuk ke dashboard</h1>
        <p className="mt-2 text-sm text-ink-2">Dashboard lengkap hanya untuk tim Gapura. Penerima link laporan tidak perlu masuk.</p>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
