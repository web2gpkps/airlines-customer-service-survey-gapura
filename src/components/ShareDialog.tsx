"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Mail, MessageCircle, Share2 } from "lucide-react";
import { applyFilters, scopeToSearch, type ReportScope } from "@/lib/filters";
import type { DashboardData } from "@/lib/sheets";
import { Modal, ScopePicker, useScopeState } from "./ScopePicker";

export function ShareDialog({
  open,
  onClose,
  data,
  initialScope,
}: {
  open: boolean;
  onClose: () => void;
  data: DashboardData;
  initialScope: () => ReportScope;
}) {
  const [scope, setScope] = useScopeState(open, initialScope);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    setCanNativeShare(typeof navigator.share === "function");
  }, []);

  const url = `${origin}/presentasi?${scopeToSearch(scope)}`;
  const title = "Airline CSS Survey";
  const message = `${title}: index kepuasan pelanggan terbaru.\n${url}`;
  const empty = scope.segments.every((s) => applyFilters(data.segments[s].responses, scope.filters[s]).length === 0);

  const copy = async () => {
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
              aria-label="Link laporan"
              onFocus={(e) => e.currentTarget.select()}
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-line-strong bg-card px-3 font-mono text-xs text-ink-2"
            />
            <button
              onClick={copy}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-white hover:bg-ink-2"
            >
              {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
              {copied ? "Tersalin" : "Salin"}
            </button>
          </div>
          {empty && <p className="text-xs font-semibold text-crit">Pilihan ini tidak punya respons sama sekali.</p>}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className={actionClass}>
              <MessageCircle aria-hidden className="size-4" /> WhatsApp
            </a>
            <a href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(message)}`} className={actionClass}>
              <Mail aria-hidden className="size-4" /> Email
            </a>
            {canNativeShare && (
              <button onClick={() => navigator.share({ title, url }).catch(() => {})} className={actionClass}>
                <Share2 aria-hidden className="size-4" /> Aplikasi lain
              </button>
            )}
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-semibold text-brand hover:bg-brand-wash sm:ml-auto"
            >
              Buka laporan <ExternalLink aria-hidden className="size-4" />
            </a>
          </div>
        </div>
      }
    >
      <ScopePicker data={data} value={scope} onChange={setScope} />
    </Modal>
  );
}
