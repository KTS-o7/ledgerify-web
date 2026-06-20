import { createSignal, For, Show } from "solid-js";
import { Download } from "lucide-solid";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Button } from "../components/ui/button";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

type Preset = "1m" | "3m" | "ytd" | "all";

const FIELDS = [
  { key: "date", label: "Date" },
  { key: "title", label: "Merchant" },
  { key: "amount", label: "Amount" },
  { key: "category", label: "Category" },
  { key: "account", label: "Account" },
  { key: "note", label: "Note" },
  { key: "type", label: "Type" },
  { key: "currency", label: "Currency" },
  { key: "tags", label: "Tags" },
];

const fmt = (d: Date) => d.toISOString().slice(0, 10);

function presetDates(preset: Preset): { from_date: string; to_date: string } {
  const to = new Date();
  const from = new Date();
  if (preset === "1m") from.setMonth(from.getMonth() - 1);
  else if (preset === "3m") from.setMonth(from.getMonth() - 3);
  else if (preset === "ytd") from.setMonth(0, 1);
  else from.setFullYear(from.getFullYear() - 10);
  return { from_date: fmt(from), to_date: fmt(to) };
}

export default function Export() {
  const defaultDates = presetDates("3m");
  const [activePreset, setActivePreset] = createSignal<Preset | null>("3m");
  const [fromDate, setFromDate] = createSignal(defaultDates.from_date);
  const [toDate, setToDate] = createSignal(defaultDates.to_date);
  const [selected, setSelected] = createSignal<Set<string>>(
    new Set(["date", "title", "amount", "category", "account"])
  );
  const [downloading, setDownloading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const applyPreset = (preset: Preset) => {
    const dates = presetDates(preset);
    setFromDate(dates.from_date);
    setToDate(dates.to_date);
    setActivePreset(preset);
  };

  const toggle = (key: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const download = async () => {
    setDownloading(true);
    setError(null);
    try {
      const fields = Array.from(selected()).join(",");
      const blob = await api.download(`/v1/export?from_date=${fromDate()}&to_date=${toDate()}&fields=${encodeURIComponent(fields)}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ledgerify_${fromDate()}_${toDate()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setDownloading(false);
    }
  };

  const PRESETS: { value: Preset; label: string }[] = [
    { value: "1m", label: "1M" },
    { value: "3m", label: "3M" },
    { value: "ytd", label: "YTD" },
    { value: "all", label: "ALL" },
  ];

  return (
    <>
      <PageHeader title="Export" />
      <div class="p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-3">
        <BentoBlock class="col-span-1 md:col-span-7">
          <div class="space-y-4">
            <div>
              <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-2 block">Date range</span>
              {/* Preset chips */}
              <div class="flex gap-2 mb-3">
                <For each={PRESETS}>
                  {(p) => (
                    <button
                      type="button"
                      onClick={() => applyPreset(p.value)}
                      class={cn(
                        "px-3 py-1.5 rounded-pill text-sm font-display font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
                        activePreset() === p.value
                          ? "bg-text text-bg"
                          : "bg-surface text-muted hover:text-text"
                      )}
                    >
                      {p.label}
                    </button>
                  )}
                </For>
              </div>
              {/* Manual date inputs */}
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="text-[12px] text-muted mb-1 block">From</label>
                  <input
                    type="date"
                    value={fromDate()}
                    onInput={(e) => { setFromDate(e.currentTarget.value); setActivePreset(null); }}
                    class="flex h-10 w-full rounded-input border border-border bg-surface px-3 text-sm text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label class="text-[12px] text-muted mb-1 block">To</label>
                  <input
                    type="date"
                    value={toDate()}
                    onInput={(e) => { setToDate(e.currentTarget.value); setActivePreset(null); }}
                    class="flex h-10 w-full rounded-input border border-border bg-surface px-3 text-sm text-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
            <div>
              <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-2 block">Fields</span>
              <ul class="grid grid-cols-2 gap-2">
                <For each={FIELDS}>
                  {(f) => (
                    <li>
                      <label class="flex items-center gap-2 px-3 py-2 rounded-input bg-bg cursor-pointer hover:bg-surface-hover transition-colors">
                        <input
                          type="checkbox"
                          checked={selected().has(f.key)}
                          onChange={() => toggle(f.key)}
                          class="w-4 h-4 accent-primary"
                        />
                        <span class="font-body text-sm text-text">{f.label}</span>
                      </label>
                    </li>
                  )}
                </For>
              </ul>
            </div>
            <Show when={error()}>
              <p class="text-accent text-sm">{error()}</p>
            </Show>
            <Button class="w-full" size="lg" disabled={selected().size === 0 || downloading()} onClick={download}>
              <Download size={18} />
              <span>{downloading() ? "Preparing…" : "Download CSV"}</span>
            </Button>
          </div>
        </BentoBlock>
        <BentoBlock class="col-span-1 md:col-span-5">
          <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-3 block">How it works</span>
          <ul class="flex flex-col gap-3 text-sm text-muted">
            <li class="flex items-start gap-2"><span class="text-primary font-bold">1.</span> Choose a date range and the fields you want included.</li>
            <li class="flex items-start gap-2"><span class="text-primary font-bold">2.</span> Click Download CSV — your browser will save the file immediately.</li>
            <li class="flex items-start gap-2"><span class="text-primary font-bold">3.</span> Open the CSV in Excel, Google Sheets, or any accounting tool.</li>
          </ul>
        </BentoBlock>
      </div>
    </>
  );
}
