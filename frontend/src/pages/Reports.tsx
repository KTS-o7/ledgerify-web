import { For } from "solid-js";
import { A } from "@solidjs/router";
import { ChartLine, ChartPie, Target, Gem, ChevronRight } from "lucide-solid";
import { PageHeader } from "../components/ui/page-header";
import { Eyebrow } from "../components/ui/eyebrow";

const REPORTS = [
  { path: "/reports/cashflow", title: "Cash flow", description: "Income against expenses, month by month", icon: ChartLine },
  { path: "/reports/category-breakdown", title: "Category breakdown", description: "Where your money goes by category", icon: ChartPie },
  { path: "/reports/budget-vs-actual", title: "Budget vs actual", description: "Planned against actual spending", icon: Target },
  { path: "/reports/networth", title: "Net worth", description: "Assets, liabilities and the monthly trend", icon: Gem },
];

export default function Reports() {
  return (
    <>
      <PageHeader title="Reports" />
      <div class="px-5 md:px-7 py-5 md:py-6 flex flex-col gap-3">
        <Eyebrow as="h2">All reports</Eyebrow>
        <ul class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <For each={REPORTS}>
            {(r) => {
              const Icon = r.icon;
              return (
                <li>
                  <A
                    href={r.path}
                    class="group flex items-center gap-3.5 h-full p-[18px] rounded-card bg-surface border border-border text-text hover:text-text hover:bg-raised active:scale-[0.97] transition-[background-color,transform] duration-[160ms] active:duration-[90ms] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
                  >
                    <span class="w-[38px] h-[38px] rounded-[10px] bg-raised group-hover:bg-surface flex items-center justify-center text-muted shrink-0 transition-colors duration-[160ms]">
                      <Icon size={18} />
                    </span>
                    <span class="flex-1 min-w-0">
                      <span class="block text-[15px] font-medium">{r.title}</span>
                      <span class="block text-[13px] text-muted mt-0.5">{r.description}</span>
                    </span>
                    <ChevronRight size={18} class="text-faint shrink-0" />
                  </A>
                </li>
              );
            }}
          </For>
        </ul>
      </div>
    </>
  );
}
