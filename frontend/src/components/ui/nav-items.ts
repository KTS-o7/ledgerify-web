import {
  LayoutDashboard, Receipt, Wallet, ChartPie, Target, Repeat, PiggyBank, Tags, TrendingUp,
  Coins, Landmark, ShieldCheck, FileText, ArrowDownUp, Plug, House, ChartNoAxesColumn, Gem, Settings, FileDown,
} from "lucide-solid";
import type { Component } from "solid-js";

type Icon = Component<{ class?: string; size?: number }>;

export type NavItem = {
  path: string;
  label: string;
  icon: Icon;
  /** Second key after G, e.g. "A" for G A. */
  go?: string;
  /** Extra words the command palette matches on. */
  keywords?: string;
};

export type NavGroup = { label: string; items: NavItem[] };

/** Desktop sidebar: every section, grouped. Nothing hides behind "More". */
export const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { path: "/dashboard", label: "Overview", icon: LayoutDashboard, go: "O", keywords: "home dashboard" },
      { path: "/activity", label: "Activity", icon: Receipt, go: "A", keywords: "transactions" },
      { path: "/accounts", label: "Accounts", icon: Wallet, go: "C", keywords: "bank cards wallets" },
      { path: "/analytics", label: "Analytics", icon: ChartPie, go: "Y", keywords: "insights spending" },
    ],
  },
  {
    label: "Plan",
    items: [
      { path: "/budgets", label: "Budgets", icon: Target, go: "B" },
      { path: "/recurring", label: "Recurring", icon: Repeat, go: "R", keywords: "subscriptions rules" },
      { path: "/savings", label: "Savings goals", icon: PiggyBank, keywords: "goals" },
      { path: "/categories", label: "Categories & tags", icon: Tags, keywords: "keywords rules tags" },
    ],
  },
  {
    label: "Wealth",
    items: [
      { path: "/networth", label: "Net worth", icon: Gem, go: "N" },
      { path: "/investments", label: "Investments", icon: TrendingUp, go: "I", keywords: "holdings stocks funds" },
      { path: "/sips", label: "SIPs", icon: Coins, keywords: "mutual fund" },
      { path: "/loans", label: "Loans", icon: Landmark, keywords: "emi debt" },
      { path: "/insurance", label: "Insurance", icon: ShieldCheck, keywords: "policy premium" },
    ],
  },
  {
    label: "Tools",
    items: [
      { path: "/reports", label: "Reports", icon: FileText },
      { path: "/import", label: "Import / Export", icon: ArrowDownUp, keywords: "csv statement upload download" },
      { path: "/mcp", label: "MCP connect", icon: Plug, keywords: "claude cursor assistant ai" },
    ],
  },
];

/** Pages that are reachable but not in the sidebar groups. */
export const extraNavItems: NavItem[] = [
  { path: "/tags", label: "Tags", icon: Tags },
  { path: "/export", label: "Export", icon: FileDown, keywords: "csv json download" },
  { path: "/settings", label: "Settings", icon: Settings, keywords: "profile theme password" },
];

export const allNavItems: NavItem[] = [...navGroups.flatMap((g) => g.items), ...extraNavItems];

/** Mobile tab bar. The centre slot is the quick-add button, not a route. */
export type MobileTab = { path: string; label: string; icon: Icon; /** Routes that light this tab. */ match: string[] };
export const mobileTabs: MobileTab[] = [
  { path: "/dashboard", label: "Home", icon: House, match: ["/dashboard", "/", "/accounts"] },
  { path: "/activity", label: "Activity", icon: Receipt, match: ["/activity", "/transactions"] },
  { path: "/analytics", label: "Insights", icon: ChartNoAxesColumn, match: ["/analytics", "/budgets", "/reports"] },
  { path: "/networth", label: "Wealth", icon: Gem, match: ["/networth", "/investments", "/sips", "/loans", "/insurance", "/savings"] },
];
