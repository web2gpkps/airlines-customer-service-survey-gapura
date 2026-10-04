export default function Loading() {
  return (
    <main className="mx-auto max-w-xl px-4 py-24" role="status" aria-live="polite">
      <div className="card p-8">
        <p className="eyebrow">Airline CSS Survey</p>
        <h1 className="mt-2 text-xl font-bold">Memuat data survei</h1>
        <p className="mt-3 text-sm text-ink-2">Mengambil respons terbaru dari Google Sheets.</p>
      </div>
    </main>
  );
}
