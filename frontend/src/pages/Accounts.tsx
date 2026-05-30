import { createResource, For, Show } from "solid-js";
import { api } from "../lib/api";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";

interface Account { id: string; name: string; type: string; currency: string; balance: number; }
function fmt(n: number) { return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(n||0); }
const typeColors: Record<string, string> = { bank: "default", wallet: "outline", cash: "warning", savings: "success", credit_card: "destructive", investment: "success" };

export default function Accounts() {
  const [accounts] = createResource(() => api.get<Account[]>("/v1/accounts"));
  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between"><h1 class="text-2xl font-semibold text-gray-900">Accounts</h1><Button>+ Add Account</Button></div>
      <Show when={accounts.loading}><p class="text-gray-500">Loading…</p></Show>
      <Show when={accounts()}>
        <div class="grid grid-cols-2 gap-4">
          <For each={accounts()}>
            {(a) => (
              <Card>
                <CardContent class="p-4">
                  <div class="flex items-center justify-between mb-2">
                    <span class="font-medium text-gray-900">{a.name}</span>
                    <Badge variant={typeColors[a.type] as any}>{a.type}</Badge>
                  </div>
                  <div class="text-2xl font-semibold text-gray-900">{fmt(a.balance)}</div>
                  <div class="text-xs text-gray-500 mt-1">{a.currency}</div>
                </CardContent>
              </Card>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
