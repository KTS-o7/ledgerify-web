import { For } from "solid-js";
import { A } from "@solidjs/router";
import { LineChart, BarChart3, Wallet, TrendingUp, ChevronRight } from "lucide-solid";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";

const REPORTS = [
  { path: "/reports/cashflow", title: "Cash Flow", description: "Income vs expenses over time", icon: LineChart },
  { path: "/reports/category-breakdown", title: "Category Breakdown", description: "Where your money goes by category", icon: BarChart3 },
  { path: "/reports/budget-vs-actual", title: "Budget vs Actual", description: "Compare planned vs actual spending", icon: Wallet },
  { path: "/reports/networth", title: "Net Worth", description: "Track assets and liabilities over time", icon: TrendingUp },
];

export default function Reports() {
  return (
    <>
      <PageHeader title="Reports" />
      <div class="p-4 md:p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-4xl">
          <For each={REPORTS}>
            {(r) => {
              const Icon = r.icon;
              return (
                <A href={r.path} class="block">
                  <BentoBlock variant="pressable" size="md" class="h-full">
                    <div class="flex items-center gap-3">
                      <div class="w-12 h-12 rounded-input bg-bg flex items-center justify-center text-muted flex-shrink-0">
                        <Icon size={24} />
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="font-display text-lg font-bold text-text mb-0.5">{r.title}</div>
                        <div class="text-sm text-muted">{r.description}</div>
                      </div>
                      <ChevronRight size={20} class="text-muted flex-shrink-0" />
                    </div>
                  </BentoBlock>
                </A>
              );
            }}
          </For>
        </div>
      </div>
    </>
  );
}
