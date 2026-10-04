import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import type { Category, StatusTone } from "@/lib/scoring";

const TONE: Record<StatusTone, { text: string; wash: string; mark: string; Icon: typeof CircleCheck }> = {
  good: { text: "text-good", wash: "bg-good-wash", mark: "bg-good-mark", Icon: CircleCheck },
  warning: { text: "text-warn", wash: "bg-warn-wash", mark: "bg-warn-mark", Icon: TriangleAlert },
  critical: { text: "text-crit", wash: "bg-crit-wash", mark: "bg-crit-mark", Icon: CircleAlert },
};

export const toneMark = (tone: StatusTone) => TONE[tone].mark;
export const toneText = (tone: StatusTone) => TONE[tone].text;

export function StatusBadge({ category, size = "sm" }: { category: Category | null; size?: "sm" | "lg" }) {
  if (!category) return <span className="text-sm text-muted">Belum ada data</span>;
  const t = TONE[category.tone];
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-lg font-semibold ${t.wash} ${t.text} ${
        size === "lg" ? "px-3.5 py-1.5 text-sm" : "px-2.5 py-1 text-xs"
      }`}
    >
      <t.Icon aria-hidden className={size === "lg" ? "size-4 shrink-0" : "size-3.5 shrink-0"} strokeWidth={2.4} />
      {category.status}
    </span>
  );
}

export function CardHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-line px-5 py-4 sm:px-6">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="mt-0.5 text-[1.0625rem] font-bold tracking-tight text-ink">{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap rounded-lg border border-line bg-sunken p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-11 rounded-md px-3 text-xs font-semibold transition-colors ${
            value === o.value ? "bg-card text-ink shadow-sm ring-1 ring-line" : "text-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export { formatDate, formatDateTime, formatMonth } from "@/lib/format";
