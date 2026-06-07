import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Stat } from "../components/ui/stat";
import { Sparkline } from "../components/ui/sparkline";
import { formatCurrency } from "../lib/format";

const HISTORY = [2200000, 2230000, 2280000, 2300000, 2350000, 2400000, 2420000, 2450000];
const CURRENT = HISTORY[HISTORY.length - 1];

export default function ReportsNetworth() {
  return (
    <>
      <PageHeader title="Net Worth Report" back />
      <div class="p-4 md:p-6 space-y-3 max-w-4xl">
        <BentoBlock size="lg">
          <Stat label="Net Worth" value={formatCurrency(CURRENT)} size="xl" tone="primary" />
        </BentoBlock>
        <BentoBlock size="md">
          <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-3 block">Trend</span>
          <Sparkline values={HISTORY} width={undefined} height={120} tone="primary" class="w-full" />
        </BentoBlock>
      </div>
    </>
  );
}
