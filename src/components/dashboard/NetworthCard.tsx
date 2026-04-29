"use client";
import { Landmark, PiggyBank, TrendingUp, WalletCards } from "lucide-react";
import type { NetworthData } from "@/lib/utils/networth";
import {
  FinancialAmount,
  IconBadge,
  ProgressMeter,
  StatusPill,
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
    <section className="relative overflow-hidden rounded-[2rem] border bg-card/90 p-5 shadow-sm shadow-foreground/5 backdrop-blur sm:p-7">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/12 via-transparent to-sky-500/10" />
      <div className="absolute -right-20 -top-24 size-56 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-28 left-10 size-56 rounded-full bg-emerald-400/10 blur-3xl" />

      <div className="relative space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <StatusPill tone={networthTone}>
              {networth > 0
                ? "Positive net worth"
                : networth < 0
                  ? "Liabilities ahead"
                  : "Getting started"}
            </StatusPill>

            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Your money home
              </p>
              <h2 className="mt-2 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                <FinancialAmount amount={networth} currency={currency} />
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                Assets minus liabilities across cash, investments, and debt.
                This is the number to keep calm, clear, and moving in the right
                direction.
              </p>
            </div>
          </div>

          <IconBadge icon={PiggyBank} tone="primary" className="size-14" />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-3xl border bg-background/70 p-4">
            <div className="flex items-center gap-3">
              <IconBadge icon={WalletCards} tone="info" className="size-10" />
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Cash
                </p>
                <p className="mt-1 font-semibold tabular-nums">
                  <FinancialAmount amount={totalCash} currency={currency} />
                </p>
              </div>
            </div>
            <ProgressMeter
              value={cashShare}
              tone="info"
              className="mt-4"
              label="Asset share"
            />
          </div>

          <div className="rounded-3xl border bg-background/70 p-4">
            <div className="flex items-center gap-3">
              <IconBadge
                icon={TrendingUp}
                tone="positive"
                className="size-10"
              />
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Investments
                </p>
                <p className="mt-1 font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                  <FinancialAmount
                    amount={totalInvestments}
                    currency={currency}
                  />
                </p>
              </div>
            </div>
            <ProgressMeter
              value={investmentShare}
              tone="positive"
              className="mt-4"
              label="Asset share"
            />
          </div>

          <div className="rounded-3xl border bg-background/70 p-4">
            <div className="flex items-center gap-3">
              <IconBadge icon={Landmark} tone="negative" className="size-10" />
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Liabilities
                </p>
                <p className="mt-1 font-semibold tabular-nums text-rose-700 dark:text-rose-300">
                  <FinancialAmount
                    amount={totalLiabilities}
                    currency={currency}
                  />
                </p>
              </div>
            </div>
            <ProgressMeter
              value={Math.min(liabilityRatio * 100, 100)}
              tone={liabilityRatio > 0.5 ? "negative" : "warning"}
              className="mt-4"
              label="Liability load"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
