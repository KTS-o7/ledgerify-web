"use client";
import { Landmark, PiggyBank, TrendingUp, WalletCards } from "lucide-react";
import type { NetworthData } from "@/lib/utils/networth";
import {
  AmountBox,
  FinancialAmount,
  ProgressMeter,
  StatusPill,
  TonalWidget,
  WidgetHeading,
} from "@/components/shared/quiet-ledger";

interface Props extends NetworthData {
  currency: string;
}

export function NetworthCard({
  networth,
  totalCash,
  totalInvestments,
  totalLiabilities,
  currency,
}: Props) {
  const totalAssets = totalCash + totalInvestments;
  const safeAssetTotal = Math.max(totalAssets, 1);
  const cashShare = Math.max(
    0,
    Math.min(100, (totalCash / safeAssetTotal) * 100),
  );
  const investmentShare = Math.max(
    0,
    Math.min(100, (totalInvestments / safeAssetTotal) * 100),
  );
  const liabilityRatio = totalAssets > 0 ? totalLiabilities / totalAssets : 0;
  const networthTone =
    networth > 0 ? "positive" : networth < 0 ? "negative" : "neutral";

  return (
    <TonalWidget tone="primary" className="space-y-6">
      <WidgetHeading
        icon={PiggyBank}
        tone="primary"
        eyebrow="Your money home"
        title="Net worth snapshot"
        description="Assets minus liabilities across cash, investments, and debt."
        action={
          <StatusPill tone={networthTone}>
            {networth > 0
              ? "Positive net worth"
              : networth < 0
                ? "Liabilities ahead"
                : "Getting started"}
          </StatusPill>
        }
      />

      <div className="rounded-[1.75rem] border bg-background/75 p-5 shadow-sm shadow-foreground/5 sm:p-6">
        <p className="text-sm font-medium text-muted-foreground">
          Family balance
        </p>
        <h2 className="financial-display mt-2 text-4xl font-bold text-foreground sm:text-5xl">
          <FinancialAmount amount={networth} currency={currency} />
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
          The calm headline number for the month: what you own, less what you
          owe.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-3">
          <AmountBox
            label="Cash"
            amount={totalCash}
            currency={currency}
            icon={WalletCards}
            tone="cash"
            count="Bank, wallet, cash, and savings balances"
          />
            <ProgressMeter
              value={cashShare}
              tone="cash"
              label="Asset share"
            />
        </div>

        <div className="space-y-3">
          <AmountBox
            label="Investments"
            amount={totalInvestments}
            currency={currency}
            icon={TrendingUp}
            tone="investment"
            count="Long-term assets and market holdings"
          />
            <ProgressMeter
              value={investmentShare}
              tone="investment"
              label="Asset share"
            />
        </div>

        <div className="space-y-3">
          <AmountBox
            label="Liabilities"
            amount={totalLiabilities}
            currency={currency}
            icon={Landmark}
            tone="loan"
            count="Loans, obligations, and debt to watch"
          />
            <ProgressMeter
              value={Math.min(liabilityRatio * 100, 100)}
              tone={liabilityRatio > 0.5 ? "negative" : "warning"}
              label="Liability load"
            />
        </div>
      </div>
    </TonalWidget>
  );
}
