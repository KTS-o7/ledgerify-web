import { createResource, createSignal, For, Show } from "solid-js";
import { Coins } from "lucide-solid";
import { api } from "../lib/api";
import { numericToFloat, pgDateToString } from "../lib/format";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { SkeletonBlock } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";
import { Sheet } from "../components/ui/sheet";
import { Eyebrow } from "../components/ui/eyebrow";
import { Money } from "../components/ui/money";
import { SipForm } from "../components/forms/sip-form";
import { AddButton, Figure, RowActions, shortDate } from "../components/wealth/common";
import { nextDebit } from "../components/wealth/sip";

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

  const totals = () => {
    const list = sips() ?? [];
    return {
      monthly: list.reduce((n, s) => n + numericToFloat(s.monthly_amount), 0),
      corpus: list.reduce((n, s) => n + numericToFloat(s.corpus_value), 0),
    };
  };

  return (
    <>
      <PageHeader title="SIPs" actions={<AddButton label="Add SIP" onClick={() => setSheetOpen(true)} />} />
      <div class="px-5 md:px-7 py-5 md:py-6 flex flex-col gap-4">
        <Show when={(sips() ?? []).length > 0}>
          <div class="grid grid-cols-2 gap-4">
            <BentoBlock class="flex flex-col gap-2">
              <Eyebrow>Monthly</Eyebrow>
              <span class="font-mono tabular text-[24px] md:text-[30px] leading-none tracking-[-0.04em]">
                <Money value={totals().monthly} mutedSymbol /><span class="text-[13px] text-muted">/mo</span>
              </span>
            </BentoBlock>
            <BentoBlock class="flex flex-col gap-2">
              <Eyebrow>Corpus</Eyebrow>
              <Money value={totals().corpus} mutedSymbol class="text-[24px] md:text-[30px] leading-none tracking-[-0.04em]" />
            </BentoBlock>
          </div>
        </Show>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Show when={sips.loading}>
            <SkeletonBlock class="min-h-[150px]" />
            <SkeletonBlock class="min-h-[150px]" />
          </Show>
          <Show when={sips.error}>
            <p class="md:col-span-2 lg:col-span-3 text-neg text-[14px] py-6 text-center">Failed to load SIPs.</p>
          </Show>
          <Show when={!sips.loading && !sips.error && (sips() ?? []).length === 0}>
            <div class="md:col-span-2 lg:col-span-3">
              <EmptyState
                icon={Coins}
                title="No SIPs tracked"
                body="Track systematic investment plans and watch the corpus grow."
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
              const next = nextDebit(s.start_date);
              return (
                <BentoBlock class="group flex flex-col gap-4">
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                      <div class="text-[15px] font-medium text-text truncate">{s.name}</div>
                      <div class="font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted mt-1">{s.sip_type}</div>
                    </div>
                    <RowActions name={s.name} onEdit={() => { setEditSip(s); setEditSheetOpen(true); }} onDelete={() => handleDelete(s.id, s.name)} class="-mr-2 -mt-1" />
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <Figure label="Per month"><Money value={monthly} currency={s.currency} /></Figure>
                    <Figure label="Corpus" sub={s.sip_type !== "equity" && expectedReturn > 0 ? `@ ${expectedReturn.toFixed(2)}% p.a.` : undefined}>
                      <Money value={corpus} currency={s.currency} />
                    </Figure>
                  </div>
                  <div class="flex items-center justify-between pt-3 border-t border-border font-mono tabular text-[12px] text-muted">
                    <span>{startStr ? `since ${shortDate(startStr)}` : ""}</span>
                    <Show when={next}><span>next <span class="text-text">{shortDate(next!)}</span></span></Show>
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
