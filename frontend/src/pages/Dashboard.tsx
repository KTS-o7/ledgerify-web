import { createResource, For, Show } from "solid-js";
import { api } from "../lib/api";
import { A } from "@solidjs/router";

interface Summary {
  total_income: number;
  total_expenses: number;
  recent_transactions: any[];
  account_balances: any[];
  budget_status: any[];
  monthly_networth: any[];
}

function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num || 0);
}

export default function Dashboard() {
  const [summary, { refetch }] = createResource(() =>
    api.get<Summary>("/v1/summary")
  );

  return (
    <div>
      <div class="page-header">
        <h1>Dashboard</h1>
      </div>

      <Show when={summary.loading}>
        <p aria-busy="true">Loading…</p>
      </Show>

      <Show when={summary.error}>
        <p class="error">Failed to load summary.</p>
      </Show>

      <Show when={summary()}>
        {(s) => (
          <>
            <div class="kpi-grid">
              <article class="kpi-card">
                <div class="kpi-label">Income</div>
                <div class="kpi-value positive">{formatCurrency(s().total_income)}</div>
              </article>
              <article class="kpi-card">
                <div class="kpi-label">Expenses</div>
                <div class="kpi-value negative">{formatCurrency(s().total_expenses)}</div>
              </article>
              <article class="kpi-card">
                <div class="kpi-label">Balance</div>
                <div class="kpi-value">{formatCurrency(s().total_income - s().total_expenses)}</div>
              </article>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:2rem">
              <article>
                <header><strong>Account Balances</strong></header>
                <For each={s().account_balances}>
                  {(acc) => (
                    <div style="display:flex;justify-content:space-between;padding:0.4rem 0;border-bottom:1px solid var(--line)">
                      <span>{acc.name}</span>
                      <span>{formatCurrency(acc.balance)}</span>
                    </div>
                  )}
                </For>
              </article>

              <article>
                <header><strong>Budget Status</strong></header>
                <For each={s().budget_status}>
                  {(b) => (
                    <div style="margin-bottom:0.75rem">
                      <div style="display:flex;justify-content:space-between">
                        <span>{b.name}</span>
                        <span class="negative">{formatCurrency(b.spent)} / {formatCurrency(b.amount)}</span>
                      </div>
                      <progress value={b.spent} max={b.amount} style="width:100%;height:6px" />
                    </div>
                  )}
                </For>
              </article>
            </div>

            <article>
              <header>
                <strong>Recent Transactions</strong>
                <A href="/transactions" style="float:right;font-size:0.875rem">View all →</A>
              </header>
              <div style="overflow-x:auto">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Title</th>
                      <th>Account</th>
                      <th>Category</th>
                      <th style="text-align:right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={s().recent_transactions}>
                      {(tx) => (
                        <tr>
                          <td>{tx.date}</td>
                          <td>{tx.title}</td>
                          <td>{tx.account_name}</td>
                          <td>{tx.category_name || "—"}</td>
                          <td style="text-align:right" class={tx.type === "income" ? "positive" : "negative"}>
                            {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </article>
          </>
        )}
      </Show>
    </div>
  );
}
