import { createResource, For, Show } from "solid-js";
import { api } from "../lib/api";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";

interface Policy { id: string; name: string; policy_type: string; premium_amount: number; premium_frequency: string; coverage_amount: number; }
function fmt(n: number) { return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(n||0); }

export default function Insurance() {
  const [policies] = createResource(() => api.get<Policy[]>("/v1/insurance"));
  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between"><h1 class="text-2xl font-semibold text-gray-900">Insurance</h1><Button>+ Add Policy</Button></div>
      <Show when={policies.loading}><p class="text-gray-500">Loading…</p></Show>
      <Show when={policies()}>
        <div class="space-y-3">
          <For each={policies()}>
            {(p) => (
              <Card><CardContent class="p-4">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-gray-900">{p.name}</span>
                    <Badge>{p.policy_type}</Badge>
                  </div>
                  <div class="text-right">
                    <div class="text-sm font-medium text-gray-900">{fmt(p.premium_amount)}/{p.premium_frequency}</div>
                    <div class="text-xs text-gray-500">Cover: {fmt(p.coverage_amount)}</div>
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
