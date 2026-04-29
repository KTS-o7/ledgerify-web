"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  BarChart2,
  CreditCard,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  PiggyBank,
  Plus,
  Shield,
  Target,
  TrendingUp,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const primaryTabs = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/transactions", label: "Activity", icon: ArrowLeftRight },
  { href: "/budgets", label: "Budgets", icon: Target },
];

const quickActions = [
  {
    href: "/transactions",
    label: "Add expense",
    description: "Record daily spending",
    icon: ArrowDownLeft,
    tone: "text-rose-600 bg-rose-50 border-rose-200",
  },
  {
    href: "/transactions",
    label: "Add income",
    description: "Salary, refunds, or cash in",
    icon: ArrowUpRight,
    tone: "text-emerald-600 bg-emerald-50 border-emerald-200",
  },
  {
    href: "/transactions",
    label: "Transfer",
    description: "Move money between accounts",
    icon: ArrowLeftRight,
    tone: "text-sky-600 bg-sky-50 border-sky-200",
  },
  {
    href: "/budgets/goals",
    label: "Goal contribution",
    description: "Update savings progress",
    icon: PiggyBank,
    tone: "text-teal-600 bg-teal-50 border-teal-200",
  },
];

const moreItems = [
  { href: "/investments", label: "Investments", icon: TrendingUp },
  { href: "/networth", label: "Net Worth", icon: BarChart2 },
  { href: "/loans", label: "Loans", icon: CreditCard },
  { href: "/insurance", label: "Insurance", icon: Shield },
  { href: "/reports", label: "Reports", icon: BarChart2 },
  { href: "/import", label: "Import", icon: Upload },
];

export function BottomNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/35 backdrop-blur-sm"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute bottom-20 left-3 right-3 rounded-3xl border bg-card/95 p-4 shadow-2xl shadow-foreground/15"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">More</p>
                <p className="text-xs text-muted-foreground">
                  Wealth, obligations, and reports
                </p>
              </div>
              <button
                onClick={() => setMoreOpen(false)}
                className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close more menu"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {moreItems.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border p-3 text-sm font-medium transition",
                      active
                        ? "border-primary/20 bg-primary/10 text-primary"
                        : "border-border bg-background/70 text-foreground hover:bg-muted",
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav
        className={cn(
          "fixed bottom-0 left-0 right-0 z-30 border-t bg-card/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-2xl shadow-foreground/10 backdrop-blur",
          className,
        )}
      >
        <div className="mx-auto grid max-w-md grid-cols-5 items-end gap-1">
          {primaryTabs.slice(0, 2).map((tab) => {
            const active =
              pathname === tab.href || pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[0.68rem] font-medium transition",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <tab.icon className="h-5 w-5" />
                {tab.label}
              </Link>
            );
          })}

          <Sheet>
            <SheetTrigger
              className="mx-auto -mt-7 flex size-14 items-center justify-center rounded-full border-4 border-card bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90"
              aria-label="Open quick actions"
            >
              <Plus className="h-6 w-6" />
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="rounded-t-3xl border-t bg-card pb-6"
            >
              <SheetHeader className="px-5 pt-5">
                <SheetTitle>Quick add</SheetTitle>
                <SheetDescription>
                  Capture the common money updates without hunting through the
                  app.
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-3 px-5">
                {quickActions.map((action) => (
                  <Link
                    key={action.label}
                    href={action.href}
                    className="flex items-center gap-3 rounded-3xl border bg-background/70 p-3 transition hover:bg-muted"
                  >
                    <span
                      className={cn(
                        "flex size-11 items-center justify-center rounded-2xl border",
                        action.tone,
                      )}
                    >
                      <action.icon className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">
                        {action.label}
                      </span>
                      <span className="block text-xs leading-5 text-muted-foreground">
                        {action.description}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </SheetContent>
          </Sheet>

          {primaryTabs.slice(2).map((tab) => {
            const active =
              pathname === tab.href || pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[0.68rem] font-medium transition",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <tab.icon className="h-5 w-5" />
                {tab.label}
              </Link>
            );
          })}

          <button
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[0.68rem] font-medium transition",
              moreOpen
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Menu className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>
    </>
  );
}
