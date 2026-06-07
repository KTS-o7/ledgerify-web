import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { DonutChart } from "../components/ui/donut-chart";
import { formatCurrency } from "../lib/format";

const SEGMENTS = [
  { label: "Groceries", value: 4200 },
  { label: "Dining", value: 2800 },
  { label: "Transport", value: 1900 },
  { label: "Entertainment", value: 1100 },
  { label: "Other", value: 800 },
];

export default function ReportsCategoryBreakdown() {
  const total = SEGMENTS.reduce((s, x) => s + x.value, 0);
  return (
    <>
      <PageHeader title="Category Breakdown" back />
      <div class="p-4 md:p-6 max-w-3xl">
        <BentoBlock size="lg" class="flex items-center justify-center min-h-[340px]">
          <DonutChart segments={SEGMENTS} centerLabel="Total Spent" centerValue={formatCurrency(total)} size={280} thickness={32} />
        </BentoBlock>
      </div>
    </>
  );
}
