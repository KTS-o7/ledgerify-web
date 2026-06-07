import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Stat } from "../components/ui/stat";
import { formatCurrency } from "../lib/format";

export default function ReportsCashflow() {
  return (
    <>
      <PageHeader title="Cash Flow" back />
      <div class="p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-3">
        <BentoBlock size="md" class="col-span-1 md:col-span-6">
          <div class="grid grid-cols-2 gap-4">
            <Stat label="Income" value={formatCurrency(84000)} tone="primary" size="lg" />
            <Stat label="Expenses" value={formatCurrency(56000)} size="lg" />
          </div>
        </BentoBlock>
        <BentoBlock size="md" class="col-span-1 md:col-span-6">
          <Stat label="Net Cash Flow" value={formatCurrency(28000)} tone="primary" size="xl" trend={{ dir: "up", value: "+12% vs last month" }} />
        </BentoBlock>
      </div>
    </>
  );
}
