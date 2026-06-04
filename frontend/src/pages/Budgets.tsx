import { createResource, For, Show } from "solid-js";
import { api } from "../lib/api";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";

interface Budget { id: string; name: string; amount: number; period_type: string; category_name: string; }
function fmt(n: number) { return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(n||0); }

export default function Budgets() {
  const [budgets] = createResource(() => api.get<Budget[]>("/v1/budgets"));
  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between"><h1 class="text-2xl font-semibold text-gray-900">Budgets</h1><Button>+ Add Budget</Button></div>
      <Show when={budgets.loading}><p class="text-gray-500">Loading…</p></Show>
      <Show when={budgets()}>
        <div class="space-y-3">
          <For each={budgets()}>
            {(b) => (
              <Card><CardContent class="p-4">
                <div class="flex justify-between items-center">
                  <div><span class="font-medium text-gray-900">{b.name}</span><span class="text-sm text-gray-500 ml-2">({b.period_type})</span></div>
                  <span class="text-sm font-medium text-gray-900">{fmt(b.amount)}</span>
                </div>
              </CardContent></Card>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
