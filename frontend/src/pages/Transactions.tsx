import { createResource, createSignal, For, Show } from "solid-js";
import { api } from "../lib/api";

interface Transaction {
  id: string;
  title: string;
  amount: string;
  type: string;
  date: string;
  category_name: string;
  account_name: string;
  note: string;
}

interface Account { id: string; name: string; currency: string; }
interface Category { id: string; name: string; type: string; }

function formatCurrency(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(num || 0);
}

export default function Transactions() {
  const [typeFilter, setTypeFilter] = createSignal("");
  const [showForm, setShowForm] = createSignal(false);
  const [formError, setFormError] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);

  const [transactions, { refetch }] = createResource(
    () => typeFilter(),
    async (type) => {
      const params = type ? `?type=${type}` : "";
      return api.get<Transaction[]>(`/v1/transactions${params}`);
    }
  );
  const [accounts] = createResource(() => api.get<Account[]>("/v1/accounts"));
  const [categories] = createResource(() => api.get<Category[]>("/v1/categories"));

  // Form state
  const [form, setForm] = createSignal({
    account_id: "", type: "expense", amount: "", currency: "INR",
    title: "", date: new Date().toISOString().slice(0, 10),
    category_id: "", note: "",
  });

  const updateForm = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      const f = form();
      await api.post("/v1/transactions", {
        ...f,
        amount: parseFloat(f.amount),
      });
      setShowForm(false);
      setForm({ account_id: "", type: "expense", amount: "", currency: "INR",
        title: "", date: new Date().toISOString().slice(0, 10), category_id: "", note: "" });
      refetch();
    } catch (err: any) {
      setFormError(err.message || "Failed to create transaction");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this transaction?")) return;
    try {
      await api.delete(`/v1/transactions/${id}`);
      refetch();
    } catch {}
  };

  return (
    <div>
      <div class="page-header">
        <h1>Transactions</h1>
        <button onClick={() => setShowForm((v) => !v)}>
          {showForm() ? "Cancel" : "+ Add Transaction"}
        </button>
      </div>

      <Show when={showForm()}>
        <article style="margin-bottom:1.5rem">
          <header><strong>New Transaction</strong></header>
          {formError() && <div class="error">{formError()}</div>}
          <form onSubmit={handleCreate}>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
              <label>
                Title
                <input type="text" value={form().title}
                  onInput={(e) => updateForm("title", e.currentTarget.value)} required />
              </label>
              <label>
                Amount
                <input type="number" step="0.01" min="0.01" value={form().amount}
                  onInput={(e) => updateForm("amount", e.currentTarget.value)} required />
              </label>
              <label>
                Type
                <select value={form().type} onChange={(e) => updateForm("type", e.currentTarget.value)}>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                  <option value="transfer">Transfer</option>
                </select>
              </label>
              <label>
                Date
                <input type="date" value={form().date}
                  onInput={(e) => updateForm("date", e.currentTarget.value)} required />
              </label>
              <label>
                Account
                <select value={form().account_id} onChange={(e) => updateForm("account_id", e.currentTarget.value)} required>
                  <option value="">Select account…</option>
                  <For each={accounts()}>
                    {(a) => <option value={a.id}>{a.name}</option>}
                  </For>
                </select>
              </label>
              <label>
                Category
                <select value={form().category_id} onChange={(e) => updateForm("category_id", e.currentTarget.value)}>
                  <option value="">No category</option>
                  <For each={categories()}>
                    {(c) => <option value={c.id}>{c.name}</option>}
                  </For>
                </select>
              </label>
              <label style="grid-column:1/-1">
                Note
                <input type="text" value={form().note}
                  onInput={(e) => updateForm("note", e.currentTarget.value)} />
              </label>
            </div>
            <button type="submit" disabled={submitting()} aria-busy={submitting()}>
              {submitting() ? "Saving…" : "Save Transaction"}
            </button>
          </form>
        </article>
      </Show>

      <div class="filters">
        <select onChange={(e) => setTypeFilter(e.currentTarget.value)}>
          <option value="">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
          <option value="transfer">Transfer</option>
          <option value="credit_payment">Credit Payment</option>
        </select>
      </div>

      <Show when={transactions.loading}><p aria-busy="true">Loading…</p></Show>
      <Show when={transactions.error}><p class="error">Failed to load transactions.</p></Show>
      <Show when={transactions()}>
        <div style="overflow-x:auto">
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Title</th><th>Account</th>
                <th>Category</th><th style="text-align:right">Amount</th><th></th>
              </tr>
            </thead>
            <tbody>
              <For each={transactions()}>
                {(tx) => (
                  <tr>
                    <td>{tx.date}</td>
                    <td>{tx.title}</td>
                    <td>{tx.account_name}</td>
                    <td>{tx.category_name || <span style="color:var(--text-muted)">—</span>}</td>
                    <td style="text-align:right" class={tx.type === "income" ? "positive" : "negative"}>
                      {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                    </td>
                    <td>
                      <button class="outline secondary" style="padding:0.25rem 0.5rem;font-size:0.75rem"
                        onClick={() => handleDelete(tx.id)}>
                        Delete
                      </button>
                    </td>
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
