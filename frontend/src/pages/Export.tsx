import { createSignal, For } from "solid-js";
import { Download } from "lucide-solid";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { SegmentedControl } from "../components/ui/segmented-control";
import { Button } from "../components/ui/button";

type Range = "1m" | "3m" | "ytd" | "all";

const FIELDS = [
  { key: "date", label: "Date" },
  { key: "merchant", label: "Merchant" },
  { key: "amount", label: "Amount" },
  { key: "category", label: "Category" },
  { key: "account", label: "Account" },
  { key: "note", label: "Note" },
];

function rangeToParams(range: Range): { from_date: string; to_date: string } {
  const to = new Date();
  const from = new Date();
  if (range === "1m") from.setMonth(from.getMonth() - 1);
  else if (range === "3m") from.setMonth(from.getMonth() - 3);
  else if (range === "ytd") from.setMonth(0, 1);
  else from.setFullYear(from.getFullYear() - 10); // "all" — go back 10 years
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from_date: fmt(from), to_date: fmt(to) };
}

export default function Export() {
  const [range, setRange] = createSignal<Range>("3m");
  const [selected, setSelected] = createSignal<Set<string>>(
    new Set(["date", "merchant", "amount", "category", "account"])
  );
  const [downloading, setDownloading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

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
      const { from_date, to_date } = rangeToParams(range());
      const token = localStorage.getItem("jwt_token");
      const res = await fetch(`/api/export?from_date=${from_date}&to_date=${to_date}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ledgerify_${from_date}_${to_date}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <PageHeader title="Export" />
      <div class="p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-3">
        <BentoBlock class="col-span-1 md:col-span-7">
          <div class="space-y-4">
            <div>
              <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-2 block">Date range</span>
              <SegmentedControl<Range>
                options={[
                  { value: "1m", label: "1M" },
                  { value: "3m", label: "3M" },
                  { value: "ytd", label: "YTD" },
                  { value: "all", label: "ALL" },
                ]}
                value={range()}
                onChange={setRange}
                ariaLabel="Export date range"
              />
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
            {error() && <p class="text-accent text-sm">{error()}</p>}
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
