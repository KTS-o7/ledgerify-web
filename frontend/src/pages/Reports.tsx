import { A } from "@solidjs/router";
import { Card, CardContent } from "../components/ui/card";

const reports = [
  { path: "/reports/cashflow", title: "Cash Flow", desc: "Income vs expenses over time" },
  { path: "/reports/category-breakdown", title: "Category Breakdown", desc: "Spending by category" },
  { path: "/reports/budget-vs-actual", title: "Budget vs Actual", desc: "Budget adherence" },
  { path: "/reports/networth", title: "Net Worth", desc: "Net worth over time" },
];

export default function Reports() {
  return (
    <div class="space-y-4">
      <h1 class="text-2xl font-semibold text-gray-900">Reports</h1>
      <div class="grid grid-cols-2 gap-4">
        {reports.map((r) => (
          <A href={r.path} class="block">
            <Card class="hover:border-gray-300 transition-colors cursor-pointer">
              <CardContent class="p-4">
                <h3 class="font-medium text-gray-900">{r.title}</h3>
                <p class="text-sm text-gray-500 mt-1">{r.desc}</p>
              </CardContent>
            </Card>
          </A>
        ))}
      </div>
    </div>
  );
}
