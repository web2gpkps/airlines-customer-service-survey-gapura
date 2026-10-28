"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Link2, Mail, MessageCircle, Share2, Unlink } from "lucide-react";
import { createShareLink, listShareLinks, revokeShareLink } from "@/app/actions";
import { applyFilters, scopeToSearch, type ReportScope } from "@/lib/filters";
import type { DashboardData } from "@/lib/sheets";
import type { ShareLink } from "@/lib/share-store";
import { Modal, ScopePicker, useScopeState } from "./ScopePicker";
import { formatDateTime } from "./ui";

export function ShareDialog({
  open,
  onClose,
  data,
  initialScope,
  origin: configuredOrigin,
}: {
  origin?: string;
  open: boolean;
  onClose: () => void;
  data: DashboardData;
  initialScope: () => ReportScope;
}) {
  const [scope, setScope] = useScopeState(open, initialScope);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [created, setCreated] = useState<{ key: string; code: string } | null>(null);
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setOrigin(configuredOrigin ?? window.location.origin);
    setCanNativeShare(typeof navigator.share === "function");
  }, [configuredOrigin]);

  const scopeKey = scopeToSearch(scope);
  // Link hanya berlaku untuk pilihan yang dipakai saat dibuat; mengubah pilihan berarti harus membuat link baru.
  const code = created?.key === scopeKey ? created.code : "";
  const url = code ? `${origin}/p/${code}` : "";
  const title = "Airline CSS Survey";
  const message = `${title}: index kepuasan pelanggan terbaru.\n${url}`;
  const empty = scope.segments.every((s) => applyFilters(data.segments[s].responses, scope.filters[s]).length === 0);

  useEffect(() => {
    if (open) listShareLinks().then(setLinks).catch(() => {});
  }, [open]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      setLinks(await listShareLinks());
    } catch {
      setError("Gagal memproses link. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };
  const create = () => run(async () => setCreated({ key: scopeKey, code: (await createShareLink(scopeKey)).code }));
  const revoke = (c: string) => run(async () => void (await revokeShareLink(c)));

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      (document.getElementById("share-url") as HTMLInputElement | null)?.select();
      document.execCommand("copy");
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const actionClass =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line-strong bg-card px-3.5 text-sm font-semibold hover:border-ink-2";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bagikan laporan"
      description="Pilih data yang mau dibagikan. Penerima membuka halaman laporan yang hanya bisa dibaca, dan angkanya ikut berubah saat Google Sheets diperbarui."
      footer={
        <div className="grid gap-3">
          <div className="flex gap-2">
            <input
              id="share-url"
              readOnly
              value={url}
              placeholder="Klik Buat link untuk membuat link pendek"
              aria-label="Link laporan"
              onFocus={(e) => e.currentTarget.select()}
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-line-strong bg-card px-3 font-mono text-xs text-ink-2"
            />
            <button
              onClick={url ? copy : create}
              disabled={busy || (!url && empty)}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-white hover:bg-ink-2 disabled:opacity-60"
            >
              {url ? (copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />) : <Link2 aria-hidden className="size-4" />}
              {url ? (copied ? "Tersalin" : "Salin") : busy ? "Membuat…" : "Buat link"}
            </button>
          </div>
          {error && <p className="text-xs font-semibold text-crit">{error}</p>}
          {empty && <p className="text-xs font-semibold text-crit">Pilihan ini tidak punya respons sama sekali.</p>}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <a href={url ? `https://wa.me/?text=${encodeURIComponent(message)}` : undefined} aria-disabled={!url} target="_blank" rel="noopener noreferrer" className={`${actionClass} ${url ? "" : "pointer-events-none opacity-50"}`}>
              <MessageCircle aria-hidden className="size-4" /> WhatsApp
            </a>
            <a href={url ? `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(message)}` : undefined} aria-disabled={!url} className={`${actionClass} ${url ? "" : "pointer-events-none opacity-50"}`}>
              <Mail aria-hidden className="size-4" /> Email
            </a>
            {canNativeShare && (
              <button disabled={!url} onClick={() => navigator.share({ title, url }).catch(() => {})} className={`${actionClass} disabled:opacity-50`}>
                <Share2 aria-hidden className="size-4" /> Aplikasi lain
              </button>
            )}
            <a
              href={url || undefined}
              aria-disabled={!url}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-semibold text-brand hover:bg-brand-wash sm:ml-auto ${url ? "" : "pointer-events-none opacity-50"}`}
            >
              Buka laporan <ExternalLink aria-hidden className="size-4" />
            </a>
          </div>
        </div>
      }
    >
      <ScopePicker data={data} value={scope} onChange={setScope} />
      <section className="mt-5 grid gap-2">
        <p className="eyebrow">Link yang pernah dibuat</p>
        {links.length === 0 && <p className="text-sm text-muted">Belum ada link.</p>}
        <ul className="grid gap-2">
          {links.map((l) => (
            <li key={l.code} className="flex items-center gap-3 rounded-lg border border-line bg-card px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className={`truncate font-mono text-xs ${l.revokedAt ? "text-muted line-through" : "text-ink"}`}>/p/{l.code}</p>
                <p className="text-xs text-muted">
                  {formatDateTime(l.createdAt)}
                  {l.revokedAt ? " · diputus" : ""}
                </p>
              </div>
              {!l.revokedAt && (
                <button
                  onClick={() => revoke(l.code)}
                  disabled={busy}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line-strong px-2.5 text-xs font-semibold text-crit hover:border-crit disabled:opacity-60"
                >
                  <Unlink aria-hidden className="size-3.5" /> Putus
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </Modal>
  );
}
