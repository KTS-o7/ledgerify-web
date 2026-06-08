import { createResource, createSignal, For, Show } from "solid-js";
import { Plus, Coins } from "lucide-solid";
import { api } from "../lib/api";
import { formatCurrency, numericToFloat, pgDateToString } from "../lib/format";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Badge } from "../components/ui/badge";
import { SkeletonBlock } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";
import { Sheet } from "../components/ui/sheet";
import { SipForm } from "../components/forms/sip-form";

interface Sip {
  id: string;
  name: string;
  sip_type: string;
  currency: string;
  monthly_amount: unknown;
  start_date: unknown;
  expected_return_rate: unknown;
  current_nav: unknown;
  units_accumulated: unknown;
  corpus_value: unknown;
  corpus_updated_at: unknown;
}

export default function Sips() {
  const [sips, { refetch }] = createResource(() => api.get<Sip[]>("/v1/sips"));
  const [sheetOpen, setSheetOpen] = createSignal(false);

  function handleSuccess() {
    setSheetOpen(false);
    refetch();
  }

  return (
    <>
      <PageHeader
        title="SIPs"
        actions={
          <button
            type="button"
            aria-label="Add SIP"
            onClick={() => setSheetOpen(true)}
            class="w-10 h-10 flex items-center justify-center rounded-full bg-surface text-text active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <Plus size={20} />
          </button>
        }
      />
      <div class="p-4 md:p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Show when={sips.loading}>
            <SkeletonBlock class="min-h-[120px]" />
            <SkeletonBlock class="min-h-[120px]" />
          </Show>
          <Show when={sips.error}>
            <div class="col-span-1 md:col-span-2 lg:col-span-3">
              <p class="text-accent text-sm py-6 text-center">Failed to load SIPs.</p>
            </div>
          </Show>
          <Show when={!sips.loading && !sips.error && (sips() ?? []).length === 0}>
            <div class="col-span-1 md:col-span-2 lg:col-span-3">
              <EmptyState
                icon={Coins}
                title="No SIPs tracked"
                body="Track systematic investment plans and watch your corpus grow."
                action={{ label: "Add SIP", onClick: () => setSheetOpen(true) }}
              />
            </div>
          </Show>
          <For each={sips() ?? []}>
            {(s) => {
              const monthly = numericToFloat(s.monthly_amount);
              const corpus = numericToFloat(s.corpus_value);
              const expectedReturn = numericToFloat(s.expected_return_rate);
              const startStr = pgDateToString(s.start_date);
              return (
                <BentoBlock variant="pressable">
                  <div class="flex items-start gap-3">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center justify-between gap-2">
                        <span class="font-display text-lg font-bold text-text truncate">{s.name}</span>
                        <Badge variant="outline" class="shrink-0 capitalize">{s.sip_type}</Badge>
                      </div>
                      <div class="font-mono text-sm text-muted mt-0.5">
                        {formatCurrency(monthly, s.currency)}/mo
                      </div>
                      <div class="flex items-center justify-between mt-2">
                        <div>
                          <div class="text-[12px] text-muted uppercase tracking-wide">Corpus</div>
                          <div class="font-display text-lg font-bold text-text">{formatCurrency(corpus, s.currency)}</div>
                        </div>
                        <Show when={s.sip_type !== "equity" && expectedReturn > 0}>
                          <span class="font-mono text-xs text-muted">@ {expectedReturn.toFixed(2)}% p.a.</span>
                        </Show>
                      </div>
                      <Show when={startStr}>
                        <div class="text-[12px] text-muted font-body mt-1">Started {startStr}</div>
                      </Show>
                    </div>
                  </div>
                </BentoBlock>
              );
            }}
          </For>
        </div>
      </div>

      <Sheet open={sheetOpen()} onClose={() => setSheetOpen(false)} title="Add SIP">
        <SipForm onSuccess={handleSuccess} onClose={() => setSheetOpen(false)} />
      </Sheet>
    </>
  );
}
