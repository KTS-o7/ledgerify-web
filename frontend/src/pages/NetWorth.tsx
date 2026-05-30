import { createResource, Show } from "solid-js";
import { api } from "../lib/api";
import { Card, CardContent } from "../components/ui/card";

interface NW { total_assets: number; total_liabilities: number; networth: number; }
function fmt(n: number) { return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(n||0); }

export default function NetWorth() {
  const [nw] = createResource(() => api.get<NW>("/v1/networth"));
  return (
    <div class="space-y-6">
      <h1 class="text-2xl font-semibold text-gray-900">Net Worth</h1>
      <Show when={nw.loading}><p class="text-gray-500">Loading…</p></Show>
      <Show when={nw()}>
        {(v) => (
          <>
            <Card><CardContent class="p-6 text-center">
              <div class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Net Worth</div>
              <div class="text-4xl font-bold text-gray-900">{fmt(v().networth)}</div>
            </CardContent></Card>
            <div class="grid grid-cols-2 gap-4">
              <Card><CardContent class="p-4">
                <div class="text-xs font-medium text-gray-500 uppercase tracking-wide">Assets</div>
                <div class="text-xl font-semibold text-emerald-600 mt-1">{fmt(v().total_assets)}</div>
              </CardContent></Card>
              <Card><CardContent class="p-4">
                <div class="text-xs font-medium text-gray-500 uppercase tracking-wide">Liabilities</div>
                <div class="text-xl font-semibold text-red-600 mt-1">{fmt(v().total_liabilities)}</div>
              </CardContent></Card>
            </div>
          </>
        )}
      </Show>
    </div>
  );
}
