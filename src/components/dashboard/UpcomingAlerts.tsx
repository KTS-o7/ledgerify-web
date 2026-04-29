"use client";

import { differenceInDays } from "date-fns";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  ShieldCheck,
} from "lucide-react";

import type { InsurancePolicy, Loan } from "@/lib/db/schema";
import {
  EmptyState,
  FinancialAmount,
  IconBadge,
  SectionHeader,
  StatusPill,
} from "@/components/shared/quiet-ledger";

interface Props {
  loans: Loan[];
  policies: InsurancePolicy[];
}

type AttentionItem = {
  id: string;
  label: string;
  description: string;
  amount: number;
  currency: string;
  daysUntil: number;
  kind: "loan" | "insurance";
};

function getUrgencyTone(daysUntil: number) {
  if (daysUntil <= 7) return "negative";
  if (daysUntil <= 30) return "warning";
  return "info";
}

function getDueLabel(daysUntil: number) {
  if (daysUntil <= 0) return "Due now";
  if (daysUntil === 1) return "Tomorrow";
  return `${daysUntil} days`;
}

export function UpcomingAlerts({ loans, policies }: Props) {
  const today = new Date();

  const loanAlerts: AttentionItem[] = loans
    .filter((loan) => Number(loan.outstandingBalance ?? 0) > 0)
    .map((loan) => ({
      id: `loan-${loan.id}`,
      label: `${loan.name} EMI`,
      description: "Upcoming loan payment",
      amount: Number(loan.emiAmount),
      currency: loan.currency,
      daysUntil: 30,
      kind: "loan",
    }));

  const renewalAlerts: AttentionItem[] = policies
    .filter((policy) => policy.renewalDate)
    .map((policy) => ({
      id: `policy-${policy.id}`,
      label: `${policy.name} renewal`,
      description: policy.provider
        ? `${policy.provider} policy renewal`
        : "Insurance policy renewal",
      amount: Number(policy.premiumAmount),
      currency: policy.currency,
      daysUntil: differenceInDays(new Date(policy.renewalDate!), today),
      kind: "insurance" as const,
    }))
    .filter((alert) => alert.daysUntil <= 60 && alert.daysUntil >= 0);

  const alerts = [...renewalAlerts, ...loanAlerts]
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 5);

  if (alerts.length === 0) {
    return (
      <section className="space-y-3">
        <SectionHeader
          title="Attention queue"
          description="Renewals, EMIs, and money items that may need action."
        />
        <EmptyState
          icon={CheckCircle2}
          title="Nothing needs attention"
          description="No upcoming EMIs or insurance renewals are due soon. Ledgerify will surface them here when they matter."
          className="py-8"
        />
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <SectionHeader
        title="Attention queue"
        description="The next few money items worth keeping an eye on."
      />

      <div className="overflow-hidden rounded-[2rem] border bg-card/85 shadow-sm shadow-foreground/5 backdrop-blur">
        {alerts.map((alert, index) => {
          const tone = getUrgencyTone(alert.daysUntil);
          const Icon = alert.kind === "loan" ? CreditCard : ShieldCheck;

          return (
            <div
              key={alert.id}
              className={`flex items-center justify-between gap-3 p-4 ${
                index > 0 ? "border-t" : ""
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <IconBadge icon={Icon} tone={tone} className="size-11" />

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {alert.label}
                    </p>
                    <StatusPill tone={tone}>
                      {getDueLabel(alert.daysUntil)}
                    </StatusPill>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {alert.description}
                  </p>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-sm font-bold tabular-nums">
                  <FinancialAmount
                    amount={alert.amount}
                    currency={alert.currency}
                  />
                </p>
                <div className="mt-1 flex items-center justify-end gap-1 text-xs text-muted-foreground">
                  <CalendarClock className="size-3" />
                  <span>{alert.kind === "loan" ? "EMI" : "Renewal"}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {alerts.some((alert) => alert.daysUntil <= 7) && (
        <div className="flex items-start gap-2 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            Some items are due soon. Review them when you have a moment so
            payments and renewals do not surprise you.
          </p>
        </div>
      )}
    </section>
  );
}
