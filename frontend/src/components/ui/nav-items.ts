import { LayoutDashboard, Wallet, PieChart, Receipt, Target, TrendingUp, Landmark, ShieldCheck, BarChart3, FileText, FileUp, FileDown, Settings, Tag, PiggyBank, Coins } from "lucide-solid";
import type { Component } from "solid-js";

export type NavItem = {
  path: string;
  label: string;
  icon: Component<{ class?: string; size?: number }>;
  section: "primary" | "secondary";
};

export const primaryNavItems: NavItem[] = [
  { path: "/dashboard", label: "Home", icon: LayoutDashboard, section: "primary" },
  { path: "/accounts", label: "Accounts", icon: Wallet, section: "primary" },
  { path: "/analytics", label: "Analytics", icon: PieChart, section: "primary" },
  { path: "/activity", label: "Activity", icon: Receipt, section: "primary" },
];

export const secondaryNavItems: NavItem[] = [
  { path: "/budgets", label: "Budgets", icon: Target, section: "secondary" },
  { path: "/savings", label: "Savings", icon: PiggyBank, section: "secondary" },
  { path: "/categories", label: "Categories", icon: Tag, section: "secondary" },
  { path: "/investments", label: "Investments", icon: TrendingUp, section: "secondary" },
  { path: "/loans", label: "Loans", icon: Landmark, section: "secondary" },
  { path: "/sips", label: "SIPs", icon: Coins, section: "secondary" },
  { path: "/insurance", label: "Insurance", icon: ShieldCheck, section: "secondary" },
  { path: "/networth", label: "Net Worth", icon: BarChart3, section: "secondary" },
  { path: "/reports", label: "Reports", icon: FileText, section: "secondary" },
  { path: "/import", label: "Import", icon: FileUp, section: "secondary" },
  { path: "/export", label: "Export", icon: FileDown, section: "secondary" },
  { path: "/settings", label: "Settings", icon: Settings, section: "secondary" },
];
