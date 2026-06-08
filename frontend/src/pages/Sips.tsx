import { createResource, createSignal, For, Show } from "solid-js";
import { Plus, Coins, Pencil, Trash2 } from "lucide-solid";
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
  const [editSip, setEditSip] = createSignal<Sip | null>(null);
  const [editSheetOpen, setEditSheetOpen] = createSignal(false);

  function handleSuccess() {
    setSheetOpen(false);
    refetch();
  }
  function closeEdit() {
    setEditSheetOpen(false);
    setEditSip(null);
  }
  function handleEditSuccess() {
    closeEdit();
    refetch();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await api.delete(`/v1/sips/${id}`);
      refetch();
    } catch {
      alert("Failed to delete SIP.");
    }
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
                <div class="group relative">
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
                  <div class="absolute top-3 right-3 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setEditSip(s); setEditSheetOpen(true); }}
                      aria-label={`Edit ${s.name}`}
                      class="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-hover text-muted hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDelete(s.id, s.name); }}
                      aria-label={`Delete ${s.name}`}
                      class="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-hover text-muted hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </div>

      <Sheet open={sheetOpen()} onClose={() => setSheetOpen(false)} title="Add SIP">
        <SipForm onSuccess={handleSuccess} onClose={() => setSheetOpen(false)} />
      </Sheet>

      <Sheet open={editSheetOpen()} onClose={closeEdit} title="Edit SIP">
        <Show when={editSip()}>
          {(s) => (
            <SipForm
              existing={{
                id: s().id,
                name: s().name,
                sip_type: s().sip_type,
                currency: s().currency,
                monthly_amount: s().monthly_amount,
                start_date: s().start_date,
                expected_return_rate: s().expected_return_rate,
                current_nav: s().current_nav,
                units_accumulated: s().units_accumulated,
              }}
              onSuccess={handleEditSuccess}
              onClose={closeEdit}
            />
          )}
        </Show>
      </Sheet>
    </>
  );
}
