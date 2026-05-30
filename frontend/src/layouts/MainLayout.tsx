import { useNavigate, useLocation, A } from "@solidjs/router";
import { useAuth } from "../lib/store";
import { type JSX, For } from "solid-js";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: "◈" },
  { path: "/transactions", label: "Transactions", icon: "⇄" },
  { path: "/accounts", label: "Accounts", icon: "⬡" },
  { path: "/budgets", label: "Budgets", icon: "▤" },
  { path: "/investments", label: "Investments", icon: "↗" },
  { path: "/loans", label: "Loans", icon: "⌂" },
  { path: "/insurance", label: "Insurance", icon: "◎" },
  { path: "/networth", label: "Net Worth", icon: "◉" },
  { path: "/reports", label: "Reports", icon: "▦" },
  { path: "/import", label: "Import", icon: "↓" },
  { path: "/export", label: "Export", icon: "↑" },
  { path: "/settings", label: "Settings", icon: "⚙" },
];

export function MainLayout(props: { children: JSX.Element }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div class="app-layout">
      <nav class="sidebar">
        <div class="sidebar-brand">L</div>
        <ul class="sidebar-nav">
          <For each={navItems}>
            {(item) => (
              <li>
                <A
                  href={item.path}
                  classList={{ active: location.pathname === item.path }}
                  title={item.label}
                >
                  <span class="nav-icon" aria-hidden="true">{item.icon}</span>
                  <span class="nav-label">{item.label}</span>
                </A>
              </li>
            )}
          </For>
        </ul>
        <button class="sidebar-logout" onClick={handleLogout} title="Logout">
          ⏻
        </button>
      </nav>
      <main class="main-content">
        {props.children}
      </main>
    </div>
  );
}
