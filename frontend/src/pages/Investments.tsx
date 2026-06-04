import { createResource, For, Show } from "solid-js";
import { api } from "../lib/api";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";

interface Inv { id: string; name: string; asset_type: string; quantity: number; buy_price: number; current_price: number; gain_loss: number; }
function fmt(n: number) { return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(n||0); }

export default function Investments() {
  const [investments] = createResource(() => api.get<Inv[]>("/v1/investments"));
  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between"><h1 class="text-2xl font-semibold text-gray-900">Investments</h1><Button>+ Add Investment</Button></div>
      <Show when={investments.loading}><p class="text-gray-500">Loading…</p></Show>
      <Show when={investments()}>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr class="border-b border-gray-100">
              <th class="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Name</th>
              <th class="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Type</th>
              <th class="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase">Qty</th>
              <th class="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase">Buy</th>
              <th class="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase">Current</th>
              <th class="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase">Gain/Loss</th>
            </tr></thead>
            <tbody class="divide-y divide-gray-50">
              <For each={investments()}>
                {(i) => (
                  <tr class="hover:bg-gray-50">
                    <td class="py-2 px-3 font-medium text-gray-900">{i.name}</td>
                    <td class="py-2 px-3"><Badge>{i.asset_type}</Badge></td>
                    <td class="py-2 px-3 text-right">{i.quantity}</td>
                    <td class="py-2 px-3 text-right">{fmt(i.buy_price)}</td>
                    <td class="py-2 px-3 text-right">{fmt(i.current_price)}</td>
                    <td class={`py-2 px-3 text-right font-medium ${i.gain_loss >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(i.gain_loss)}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </div>
  );
}
