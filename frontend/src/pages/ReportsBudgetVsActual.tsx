import { For } from "solid-js";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { CategoryBar } from "../components/ui/category-bar";
import { formatCurrency } from "../lib/format";

const BUDGETS = [
  { name: "Groceries", spent: 4200, amount: 6000 },
  { name: "Dining Out", spent: 2800, amount: 3000 },
  { name: "Transport", spent: 1900, amount: 2000 },
];

export default function ReportsBudgetVsActual() {
  return (
    <>
      <PageHeader title="Budget vs Actual" back />
      <div class="p-4 md:p-6 space-y-3 max-w-3xl">
        <For each={BUDGETS}>
          {(b) => {
            const pct = (b.spent / b.amount) * 100;
            const over = b.spent > b.amount;
            return (
              <BentoBlock size="sm">
                <div class="flex items-center justify-between mb-2">
                  <span class="font-display text-lg font-bold text-text">{b.name}</span>
                  <span class="text-sm text-muted">{formatCurrency(b.spent)} / {formatCurrency(b.amount)}</span>
                </div>
                <CategoryBar value={pct / 100} color={over ? "var(--color-accent)" : "var(--color-primary)"} trackColor="bg-bg" />
              </BentoBlock>
            );
          }}
        </For>
      </div>
    </>
  );
}
