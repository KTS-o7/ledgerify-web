import { createResource, createSignal, For, Show } from "solid-js";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";

interface Tx { id: string; title: string; amount: string; type: string; date: string; category_name: string; account_name: string; }
interface Account { id: string; name: string; }
interface Category { id: string; name: string; }

function fmt(n: string | number): string {
  const v = typeof n === "string" ? parseFloat(n) : n;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v || 0);
}

export default function Transactions() {
  const [typeFilter, setTypeFilter] = createSignal("");
  const [showForm, setShowForm] = createSignal(false);
  const [formError, setFormError] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);

  const [txns, { refetch }] = createResource(
    () => typeFilter(),
    async (type) => api.get<Tx[]>(`/v1/transactions${type ? `?type=${type}` : ""}`)
  );
  const [accounts] = createResource(() => api.get<Account[]>("/v1/accounts"));
  const [categories] = createResource(() => api.get<Category[]>("/v1/categories"));

  const [form, setForm] = createSignal({
    account_id: "", type: "expense", amount: "", currency: "INR",
    title: "", date: new Date().toISOString().slice(0, 10), category_id: "", note: "",
  });
  const uf = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const create = async (e: Event) => {
    e.preventDefault(); setFormError(""); setSubmitting(true);
    try {
      const f = form();
      await api.post("/v1/transactions", { ...f, amount: parseFloat(f.amount) });
      setShowForm(false);
      setForm({ account_id: "", type: "expense", amount: "", currency: "INR", title: "", date: new Date().toISOString().slice(0, 10), category_id: "", note: "" });
      refetch();
    } catch (err: any) { setFormError(err.message || "Failed"); }
    finally { setSubmitting(false); }
  };

  const del = async (id: string) => { if (confirm("Delete?")) { await api.delete(`/v1/transactions/${id}`); refetch(); } };

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-semibold text-gray-900">Transactions</h1>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm() ? "Cancel" : "+ Add Transaction"}</Button>
      </div>

      <Show when={showForm()}>
        <Card>
          <CardHeader><CardTitle>New Transaction</CardTitle></CardHeader>
          <CardContent>
            {formError() && <div class="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{formError()}</div>}
            <form onSubmit={create} class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Title</label>
                <Input value={form().title} onInput={(e) => uf("title", e.currentTarget.value)} required />
              </div>
              <div>
                <label class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Amount</label>
                <Input type="number" step="0.01" min="0.01" value={form().amount} onInput={(e) => uf("amount", e.currentTarget.value)} required />
              </div>
              <div>
                <label class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Type</label>
                <Select value={form().type} onChange={(e) => uf("type", e.currentTarget.value)}>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                  <option value="transfer">Transfer</option>
                </Select>
              </div>
              <div>
                <label class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Date</label>
                <Input type="date" value={form().date} onInput={(e) => uf("date", e.currentTarget.value)} required />
              </div>
              <div>
                <label class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Account</label>
                <Select value={form().account_id} onChange={(e) => uf("account_id", e.currentTarget.value)} required>
                  <option value="">Select...</option>
                  <For each={accounts()}>{(a) => <option value={a.id}>{a.name}</option>}</For>
                </Select>
              </div>
              <div>
                <label class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Category</label>
                <Select value={form().category_id} onChange={(e) => uf("category_id", e.currentTarget.value)}>
                  <option value="">None</option>
                  <For each={categories()}>{(c) => <option value={c.id}>{c.name}</option>}</For>
                </Select>
              </div>
              <div class="col-span-2">
                <label class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Note</label>
                <Input value={form().note} onInput={(e) => uf("note", e.currentTarget.value)} />
              </div>
              <div class="col-span-2">
                <Button type="submit" disabled={submitting()} class="w-full">{submitting() ? "Saving..." : "Save Transaction"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </Show>

      <Select class="w-48" onChange={(e) => setTypeFilter(e.currentTarget.value)}>
        <option value="">All types</option>
        <option value="income">Income</option>
        <option value="expense">Expense</option>
        <option value="transfer">Transfer</option>
      </Select>

      <Show when={txns.loading}><p class="text-gray-500">Loading...</p></Show>
      <Show when={txns.error}><p class="text-red-600 text-sm">Failed to load.</p></Show>
      <Show when={txns()}>
        <Card>
          <CardContent class="p-0">
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-gray-100">
                    <th class="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th class="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Title</th>
                    <th class="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Account</th>
                    <th class="text-left py-2 px-3 text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th class="text-right py-2 px-3 text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th class="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-50">
                  <For each={txns()}>
                    {(tx) => (
                      <tr class="hover:bg-gray-50">
                        <td class="py-2 px-3 text-gray-500 whitespace-nowrap">{tx.date}</td>
                        <td class="py-2 px-3 font-medium text-gray-900">{tx.title}</td>
                        <td class="py-2 px-3 text-gray-600">{tx.account_name}</td>
                        <td class="py-2 px-3 text-gray-600">{tx.category_name || <span class="text-gray-400">—</span>}</td>
                        <td class={`py-2 px-3 text-right font-medium whitespace-nowrap ${tx.type === "income" ? "text-emerald-600" : "text-red-600"}`}>
                          {tx.type === "income" ? "+" : "−"}{fmt(tx.amount)}
                        </td>
                        <td class="py-2 px-3">
                          <Button variant="ghost" size="sm" onClick={() => del(tx.id)}>Delete</Button>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </Show>
    </div>
  );
}
