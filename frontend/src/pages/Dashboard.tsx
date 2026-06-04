import { createResource, For, Show } from "solid-js";
import { api } from "../lib/api";
import { A } from "@solidjs/router";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";

interface Summary {
  total_income: number;
  total_expenses: number;
  recent_transactions: any[];
  account_balances: any[];
  budget_status: any[];
}

function fmt(n: number | string): string {
  const v = typeof n === "string" ? parseFloat(n) : n;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v || 0);
}

export default function Dashboard() {
  const [summary] = createResource(() => api.get<Summary>("/v1/summary"));

  return (
    <div class="space-y-6">
      <h1 class="text-2xl font-semibold text-gray-900">Dashboard</h1>

      <Show when={summary.loading}><p class="text-gray-500">Loading...</p></Show>
      <Show when={summary.error}><p class="text-red-600 text-sm">Failed to load summary.</p></Show>

      <Show when={summary()}>
        {(s) => (
          <>
            <div class="grid grid-cols-3 gap-4">
              <Card>
                <CardContent class="p-4">
                  <div class="text-xs font-medium text-gray-500 uppercase tracking-wide">Income</div>
                  <div class="text-lg font-semibold text-emerald-600 mt-1">{fmt(s().total_income)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent class="p-4">
                  <div class="text-xs font-medium text-gray-500 uppercase tracking-wide">Expenses</div>
                  <div class="text-lg font-semibold text-red-600 mt-1">{fmt(s().total_expenses)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent class="p-4">
                  <div class="text-xs font-medium text-gray-500 uppercase tracking-wide">Balance</div>
                  <div class="text-lg font-semibold text-gray-900 mt-1">{fmt(s().total_income - s().total_expenses)}</div>
                </CardContent>
              </Card>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader class="pb-2"><CardTitle>Account Balances</CardTitle></CardHeader>
                <CardContent>
                  <div class="divide-y divide-gray-100">
                    <For each={s().account_balances}>
                      {(a) => (
                        <div class="flex justify-between py-2 text-sm">
                          <span class="text-gray-700">{a.name}</span>
                          <span class="font-medium text-gray-900">{fmt(a.balance)}</span>
                        </div>
                      )}
                    </For>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader class="pb-2"><CardTitle>Budget Status</CardTitle></CardHeader>
                <CardContent>
                  <div class="space-y-3">
                    <For each={s().budget_status}>
                      {(b) => (
                        <div>
                          <div class="flex justify-between text-sm mb-1">
                            <span class="text-gray-700">{b.name}</span>
                            <span class="text-gray-500">{fmt(b.spent)} / {fmt(b.amount)}</span>
                          </div>
                          <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div class="h-full bg-[#c25a3e] rounded-full" style={{ width: `${Math.min((b.spent / b.amount) * 100, 100)}%` }} />
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader class="pb-2">
                <div class="flex items-center justify-between">
                  <CardTitle>Recent Transactions</CardTitle>
                  <A href="/transactions" class="text-sm text-[#c25a3e] hover:underline">View all</A>
                </div>
              </CardHeader>
              <CardContent>
                <div class="overflow-x-auto">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="border-b border-gray-100">
                        <th class="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th class="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Title</th>
                        <th class="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Account</th>
                        <th class="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Category</th>
                        <th class="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase">Amount</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-50">
                      <For each={s().recent_transactions}>
                        {(tx) => (
                          <tr class="hover:bg-gray-50">
                            <td class="py-2 px-3 text-gray-500">{tx.date}</td>
                            <td class="py-2 px-3 font-medium text-gray-900">{tx.title}</td>
                            <td class="py-2 px-3 text-gray-600">{tx.account_name}</td>
                            <td class="py-2 px-3 text-gray-600">{tx.category_name || "—"}</td>
                            <td class={`py-2 px-3 text-right font-medium ${tx.type === "income" ? "text-emerald-600" : "text-red-600"}`}>
                              {tx.type === "income" ? "+" : "−"}{fmt(tx.amount)}
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </Show>
    </div>
  );
}
