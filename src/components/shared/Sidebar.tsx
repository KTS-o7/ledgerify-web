"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  TrendingUp,
  CreditCard,
  Shield,
  Target,
  BarChart2,
  Upload,
  Settings,
  PiggyBank,
  Plus,
  LogOut,
  WalletCards,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutUser } from "@/app/actions/auth";

const navSections = [
  {
    label: "Home",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
      { href: "/accounts", label: "Accounts", icon: WalletCards },
    ],
  },
  {
    label: "Plan",
    items: [
      { href: "/budgets", label: "Budgets", icon: Target },
      { href: "/budgets/goals", label: "Goals", icon: PiggyBank },
    ],
  },
  {
    label: "Wealth",
    items: [
      { href: "/networth", label: "Net Worth", icon: BarChart2 },
      { href: "/investments", label: "Investments", icon: TrendingUp },
    ],
  },
  {
    label: "Obligations",
    items: [
      { href: "/loans", label: "Loans", icon: CreditCard },
      { href: "/insurance", label: "Insurance", icon: Shield },
    ],
  },
  {
    label: "Manage",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart2 },
      { href: "/import", label: "Import", icon: Upload },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/95 text-sidebar-foreground backdrop-blur",
        className,
      )}
    >
      <div className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <PiggyBank className="size-5" />
          </div>
          <div className="min-w-0">
            <span className="block text-base font-bold">
              Ledgerify
            </span>
            <span className="block text-xs text-muted-foreground">
              Quiet Ledger
            </span>
          </div>
        </div>
      </div>

      <div className="px-3 py-3">
        <Link
          href="/transactions"
          className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
        >
          <Plus className="size-4" />
          Add transaction
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <div className="space-y-4">
          {navSections.map((section) => (
            <div key={section.label} className="space-y-1.5">
              <p className="px-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {section.label}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/dashboard" &&
                      pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                      )}
                    >
                      <item.icon
                        className={cn(
                          "size-4 shrink-0",
                          active
                            ? "text-primary"
                            : "text-muted-foreground group-hover:text-sidebar-foreground",
                        )}
                      />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      <div className="space-y-3 border-t border-sidebar-border p-4">
        <div className="rounded-2xl bg-background/70 p-3">
          <p className="text-xs font-medium text-foreground">
            Private money home
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Built for daily clarity, family setup, and trusted use.
          </p>
        </div>
        <form action={logoutUser}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-sidebar-border bg-background/80 px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="size-4" />
            Log out
          </button>
        </form>
      </div>
    </aside>
  );
}
