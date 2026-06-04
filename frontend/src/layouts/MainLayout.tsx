import { A, useLocation, useNavigate, type RouteSectionProps } from "@solidjs/router";
import { For } from "solid-js";
import { useAuth } from "../lib/store";
import { cn } from "../lib/utils";
import {
  LayoutDashboard, ArrowLeftRight, Wallet, PieChart, TrendingUp,
  Landmark, ShieldCheck, BarChart3, FileDown, FileUp, Settings, LogOut,
} from "lucide-solid";

const navItems = [
  { path: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { path: "/transactions", label: "Transactions", Icon: ArrowLeftRight },
  { path: "/accounts", label: "Accounts", Icon: Wallet },
  { path: "/budgets", label: "Budgets", Icon: PieChart },
  { path: "/investments", label: "Investments", Icon: TrendingUp },
  { path: "/loans", label: "Loans", Icon: Landmark },
  { path: "/insurance", label: "Insurance", Icon: ShieldCheck },
  { path: "/networth", label: "Net Worth", Icon: BarChart3 },
  { path: "/reports", label: "Reports", Icon: BarChart3 },
  { path: "/import", label: "Import", Icon: FileDown },
  { path: "/export", label: "Export", Icon: FileUp },
  { path: "/settings", label: "Settings", Icon: Settings },
];

export function MainLayout(props: RouteSectionProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div class="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <nav class="fixed top-0 left-0 h-screen w-14 flex flex-col items-center bg-[#1a1816] z-50 py-3 gap-1">
        {/* Brand */}
        <div class="w-9 h-9 rounded-lg bg-[#c25a3e] flex items-center justify-center text-white font-bold text-base mb-2 flex-shrink-0">
          L
        </div>

        {/* Nav links */}
        <For each={navItems}>
          {(item) => {
            const active = () =>
              location.pathname === item.path ||
              location.pathname.startsWith(item.path + "/");
            return (
              <A
                href={item.path}
                title={item.label}
                class={cn(
                  "group relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors",
                  active()
                    ? "bg-[#c25a3e]/20 text-[#c25a3e]"
                    : "text-gray-500 hover:text-gray-200 hover:bg-white/10"
                )}
              >
                <item.Icon size={18} />
                {/* Active indicator */}
                {active() && (
                  <span class="absolute -left-3 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-[#c25a3e] rounded-r" />
                )}
                {/* Tooltip */}
                <span class="absolute left-full ml-2 px-2 py-1 rounded bg-[#1a1816] text-white text-xs whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity shadow-lg border border-white/10 z-50">
                  {item.label}
                </span>
              </A>
            );
          }}
        </For>

        {/* Logout */}
        <button
          title="Logout"
          onClick={() => { logout(); navigate("/login"); }}
          class="mt-auto flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-white/10 transition-colors"
        >
          <LogOut size={18} />
        </button>
      </nav>

      {/* Main content */}
      <main class="ml-14 flex-1 min-w-0 p-6">
        {props.children}
      </main>
    </div>
  );
}
