import { createSignal, For, Show } from "solid-js";
import { Download, FileText } from "lucide-solid";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { SegmentedControl } from "../components/ui/segmented-control";
import { Button } from "../components/ui/button";

type Range = "1m" | "3m" | "ytd" | "all" | "custom";

const FIELDS = [
  { key: "date", label: "Date" },
  { key: "merchant", label: "Merchant" },
  { key: "amount", label: "Amount" },
  { key: "category", label: "Category" },
  { key: "account", label: "Account" },
  { key: "note", label: "Note" },
];

const RECENT = [
  { id: "1", name: "transactions-2026-06.csv", date: "2026-06-15" },
  { id: "2", name: "transactions-2026-05.csv", date: "2026-05-12" },
];

export default function Export() {
  const [range, setRange] = createSignal<Range>("3m");
  const [selected, setSelected] = createSignal<Set<string>>(new Set(["date", "merchant", "amount", "category", "account"]));

  const toggle = (key: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <>
      <PageHeader title="Export" />
      <div class="p-4 md:p-6 space-y-3 max-w-3xl">
        <BentoBlock size="md">
          <div class="space-y-4">
            <div>
              <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-2 block">Date range</span>
              <SegmentedControl<Range>
                options={[
                  { value: "1m", label: "1M" },
                  { value: "3m", label: "3M" },
                  { value: "ytd", label: "YTD" },
                  { value: "all", label: "ALL" },
                  { value: "custom", label: "Custom" },
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
            <Button class="w-full" size="lg" disabled={selected().size === 0}>
              <Download size={18} />
              <span>Download CSV</span>
            </Button>
          </div>
        </BentoBlock>

        <BentoBlock size="md">
          <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-3 block">Recent exports</span>
          <Show when={RECENT.length > 0} fallback={<p class="text-sm text-muted py-2">No exports yet.</p>}>
            <ul class="flex flex-col">
              <For each={RECENT}>
                {(e) => (
                  <li class="flex items-center gap-3 py-3 border-b border-border last:border-0">
                    <FileText size={20} class="text-muted" />
                    <div class="flex-1 min-w-0">
                      <div class="font-body text-base text-text truncate">{e.name}</div>
                      <div class="text-[13px] text-muted">{e.date}</div>
                    </div>
                    <button type="button" aria-label={`Download ${e.name}`} class="w-10 h-10 flex items-center justify-center rounded-full text-muted hover:text-text hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg">
                      <Download size={18} />
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </BentoBlock>
      </div>
    </>
  );
}
