import { createResource, For, Show } from "solid-js";
import { api } from "../lib/api";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";

interface Loan { id: string; name: string; loan_type: string; outstanding_balance: number; emi_amount: number; principal: number; }
function fmt(n: number) { return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(n||0); }

export default function Loans() {
  const [loans] = createResource(() => api.get<Loan[]>("/v1/loans"));
  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between"><h1 class="text-2xl font-semibold text-gray-900">Loans</h1><Button>+ Add Loan</Button></div>
      <Show when={loans.loading}><p class="text-gray-500">Loading…</p></Show>
      <Show when={loans()}>
        <div class="space-y-3">
          <For each={loans()}>
            {(l) => (
              <Card><CardContent class="p-4">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-gray-900">{l.name}</span>
                    <Badge>{l.loan_type}</Badge>
                  </div>
                  <div class="text-right">
                    <div class="text-sm font-medium text-gray-900">{fmt(l.outstanding_balance)} outstanding</div>
                    <div class="text-xs text-gray-500">EMI: {fmt(l.emi_amount)}/mo</div>
                  </div>
                </div>
              </CardContent></Card>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
