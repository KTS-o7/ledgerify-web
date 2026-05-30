# Frontend Rewrite (SolidJS + Bun) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Go/HTMX/Pico.css frontend with a SolidJS SPA built with Bun, keeping the existing Go API backend unchanged.

**Architecture:** SolidJS + Vite SPA in `frontend/` directory. Go server embeds built `dist/` and serves it as static files with SPA fallback. API calls use `fetch()` with JWT in Authorization header. TanStack Query for data caching. Pico.css for styling (ported from current Terracotta theme).

**Tech Stack:** Bun, SolidJS 1.9, `@solidjs/router`, `@tanstack/solid-query`, Vite, TypeScript, Pico.css, Chart.js

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `frontend/` | Create | New SolidJS SPA directory |
| `frontend/package.json` | Create | Dependencies and scripts |
| `frontend/vite.config.ts` | Create | Vite config with SolidJS plugin |
| `frontend/tsconfig.json` | Create | TypeScript config |
| `frontend/index.html` | Create | SPA entry HTML |
| `frontend/src/index.tsx` | Create | App entry point |
| `frontend/src/App.tsx` | Create | Router setup |
| `frontend/src/lib/api.ts` | Create | Authenticated fetch wrapper |
| `frontend/src/lib/store.ts` | Create | Auth context/store |
| `frontend/src/components/` | Create | Reusable UI components |
| `frontend/src/pages/` | Create | Route-level page components |
| `frontend/src/styles/custom.css` | Create | Terracotta theme (port from Go) |
| `embedassets.go` | Modify | Embed `frontend/dist/` instead of `web/` |
| `cmd/server/main.go` | Modify | Serve SPA with fallback routing |

---

## Task 1: Scaffold SolidJS Project

**Files:**
- Create: `frontend/` directory tree

- [ ] **Step 1: Create project with Vite**

```bash
cd /Users/kts/Documents/side-projects/ledgerify-web
mkdir -p frontend
cd frontend
bun create vite . --template solid-ts
```

- [ ] **Step 2: Install dependencies**

```bash
cd frontend
bun add @solidjs/router @tanstack/solid-query @picocss/pico chart.js chartjs-adapter-date-fns date-fns
bun install
```

- [ ] **Step 3: Verify dev server starts**

```bash
cd frontend
bun dev
```

Expected: Server starts on `http://localhost:5173` (or 3000).

- [ ] **Step 4: Commit**

```bash
cd /Users/kts/Documents/side-projects/ledgerify-web
git add frontend/
git commit -m "feat: scaffold SolidJS + Bun frontend"
```

---

## Task 2: Configure Vite for SPA + API Proxy

**Files:**
- Modify: `frontend/vite.config.ts`

- [ ] **Step 1: Update vite config**

```ts
// frontend/vite.config.ts
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8080",
    },
  },
  build: {
    target: "esnext",
    outDir: "dist",
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add frontend/vite.config.ts
git commit -m "feat: configure Vite with API proxy for dev"
```

---

## Task 3: Set Up TypeScript Config

**Files:**
- Modify: `frontend/tsconfig.json`

- [ ] **Step 1: Update tsconfig**

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "jsx": "preserve",
    "jsxImportSource": "solid-js",
    "types": ["vite/client"],
    "noEmit": true,
    "isolatedModules": true,
    "paths": {
      "~/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/tsconfig.json
git commit -m "feat: configure TypeScript for SolidJS"
```

---

## Task 4: Create API Client with JWT Auth

**Files:**
- Create: `frontend/src/lib/api.ts`

- [ ] **Step 1: Create API client**

```ts
// frontend/src/lib/api.ts
const API_BASE = "/api";

async function authFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("jwt_token");
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    localStorage.removeItem("jwt_token");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  return res.json();
}

export const api = {
  get: <T>(path: string) => authFetch<T>(path),
  post: <T>(path: string, body: unknown) =>
    authFetch<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    authFetch<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) => authFetch<T>(path, { method: "DELETE" }),
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add authenticated API client"
```

---

## Task 5: Create Auth Store

**Files:**
- Create: `frontend/src/lib/store.ts`

- [ ] **Step 1: Create auth context**

```ts
// frontend/src/lib/store.ts
import { createContext, useContext, createSignal, type JSX } from "solid-js";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: () => User | null;
  isAuthenticated: () => boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>();

export function AuthProvider(props: { children: JSX.Element }) {
  const [user, setUser] = createSignal<User | null>(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });

  const isAuthenticated = () => !!localStorage.getItem("jwt_token");

  const login = (token: string, userData: User) => {
    localStorage.setItem("jwt_token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("jwt_token");
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout }}>
      {props.children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext)!;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/store.ts
git commit -m "feat: add auth context/store"
```

---

## Task 6: Set Up Router with Auth Guards

**Files:**
- Create: `frontend/src/App.tsx`
- Modify: `frontend/src/index.tsx`

- [ ] **Step 1: Create App with router**

```tsx
// frontend/src/App.tsx
import { Router, Route } from "@solidjs/router";
import { lazy, Suspense } from "solid-js";
import { AuthProvider } from "./lib/store";
import { AuthGuard } from "./components/AuthGuard";
import { MainLayout } from "./layouts/MainLayout";

const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Transactions = lazy(() => import("./pages/Transactions"));
const Accounts = lazy(() => import("./pages/Accounts"));
const Budgets = lazy(() => import("./pages/Budgets"));
const Investments = lazy(() => import("./pages/Investments"));
const Loans = lazy(() => import("./pages/Loans"));
const Insurance = lazy(() => import("./pages/Insurance"));
const NetWorth = lazy(() => import("./pages/NetWorth"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const Import = lazy(() => import("./pages/Import"));
const Export = lazy(() => import("./pages/Export"));

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/" component={AuthGuard}>
          <Route path="/" component={MainLayout}>
            <Route path="/" component={Dashboard} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/transactions" component={Transactions} />
            <Route path="/accounts" component={Accounts} />
            <Route path="/budgets" component={Budgets} />
            <Route path="/investments" component={Investments} />
            <Route path="/loans" component={Loans} />
            <Route path="/insurance" component={Insurance} />
            <Route path="/networth" component={NetWorth} />
            <Route path="/reports" component={Reports} />
            <Route path="/import" component={Import} />
            <Route path="/export" component={Export} />
            <Route path="/settings" component={Settings} />
          </Route>
        </Route>
      </Router>
    </AuthProvider>
  );
}
```

- [ ] **Step 2: Update index.tsx entry point**

```tsx
// frontend/src/index.tsx
import { render } from "solid-js/web";
import App from "./App";
import "./styles/custom.css";

render(() => <App />, document.getElementById("root")!);
```

- [ ] **Step 3: Create AuthGuard component**

```tsx
// frontend/src/components/AuthGuard.tsx
import { Show, type JSX } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useAuth } from "../lib/store";

export function AuthGuard(props: { children: JSX.Element }) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  return (
    <Show
      when={isAuthenticated()}
      fallback={<>{navigate("/login", { replace: true })}</>}
    >
      {props.children}
    </Show>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/index.tsx frontend/src/components/AuthGuard.tsx
git commit -m "feat: set up SolidJS router with auth guards"
```

---

## Task 7: Create Main Layout (Sidebar)

**Files:**
- Create: `frontend/src/layouts/MainLayout.tsx`

- [ ] **Step 1: Create layout component**

```tsx
// frontend/src/layouts/MainLayout.tsx
import { useNavigate, useLocation, A } from "@solidjs/router";
import { useAuth } from "../lib/store";
import { type JSX } from "solid-js";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: "📊" },
  { path: "/transactions", label: "Transactions", icon: "💳" },
  { path: "/accounts", label: "Accounts", icon: "🏦" },
  { path: "/budgets", label: "Budgets", icon: "📋" },
  { path: "/investments", label: "Investments", icon: "📈" },
  { path: "/loans", label: "Loans", icon: "🏠" },
  { path: "/insurance", label: "Insurance", icon: "🛡️" },
  { path: "/networth", label: "Net Worth", icon: "💰" },
  { path: "/reports", label: "Reports", icon: "📊" },
  { path: "/import", label: "Import", icon: "📥" },
  { path: "/export", label: "Export", icon: "📤" },
  { path: "/settings", label: "Settings", icon: "⚙️" },
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
        <div class="sidebar-logo">Ledgerify</div>
        <ul class="sidebar-nav">
          {navItems.map((item) => (
            <li>
              <A
                href={item.path}
                classList={{ active: location.pathname === item.path }}
              >
                <span class="nav-icon">{item.icon}</span>
                <span class="nav-label">{item.label}</span>
              </A>
            </li>
          ))}
        </ul>
        <button class="sidebar-logout" onClick={handleLogout}>
          Logout
        </button>
      </nav>
      <main class="main-content">
        {props.children}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/layouts/MainLayout.tsx
git commit -m "feat: add main layout with sidebar navigation"
```

---

## Task 8: Port Terracotta CSS Theme

**Files:**
- Create: `frontend/src/styles/custom.css`

- [ ] **Step 1: Copy and adapt current CSS**

Read `web/static/css/custom.css` from the Go project. Port the CSS variables, sidebar styles, KPI styles, table styles, form styles, and dark/light theme support. Replace Pico.css CDN import with npm import:

```css
@import "@picocss/pico/css/pico.min.css";

:root {
  --primary: #c25a3e;
  --primary-hover: #a84830;
  --bg: #faf8f5;
  --bg-sidebar: #2d2a26;
  --text: #1a1a1a;
  /* ... rest of Terracotta theme variables */
}
```

- [ ] **Step 2: Add layout styles**

```css
.app-layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 52px;
  background: var(--bg-sidebar);
  color: white;
  display: flex;
  flex-direction: column;
  padding: 1rem 0;
}

.sidebar-nav {
  list-style: none;
  padding: 0;
}

.sidebar-nav a {
  display: flex;
  align-items: center;
  padding: 0.75rem;
  color: rgba(255,255,255,0.7);
  text-decoration: none;
}

.sidebar-nav a.active {
  color: white;
  background: rgba(255,255,255,0.1);
}

.main-content {
  flex: 1;
  padding: 2rem;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/styles/custom.css
git commit -m "feat: port Terracotta CSS theme to SolidJS frontend"
```

---

## Task 9: Create Login and Register Pages

**Files:**
- Create: `frontend/src/pages/Login.tsx`
- Create: `frontend/src/pages/Register.tsx`

- [ ] **Step 1: Create Login page**

```tsx
// frontend/src/pages/Login.tsx
import { createSignal } from "solid-js";
import { useNavigate, A } from "@solidjs/router";
import { useAuth } from "../lib/store";
import { api } from "../lib/api";

export default function Login() {
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");
    try {
      const res = await api.post<{ token: string; user: any }>("/v1/auth/login", {
        email: email(),
        password: password(),
      });
      login(res.token, res.user);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
  };

  return (
    <div class="auth-page">
      <form onSubmit={handleSubmit}>
        <h1>Login</h1>
        {error() && <div class="error">{error()}</div>}
        <input
          type="email"
          placeholder="Email"
          value={email()}
          onInput={(e) => setEmail(e.currentTarget.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password()}
          onInput={(e) => setPassword(e.currentTarget.value)}
        />
        <button type="submit">Login</button>
        <p>Don't have an account? <A href="/register">Register</A></p>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Create Register page (similar pattern)**

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Login.tsx frontend/src/pages/Register.tsx
git commit -m "feat: add login and register pages"
```

---

## Task 10: Create Dashboard Page

**Files:**
- Create: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Create Dashboard with KPIs**

```tsx
// frontend/src/pages/Dashboard.tsx
import { createResource, For, Show } from "solid-js";
import { api } from "../lib/api";

interface Summary {
  total_income: number;
  total_expenses: number;
  recent_transactions: any[];
  account_balances: any[];
}

export default function Dashboard() {
  const [summary] = createResource(() => api.get<Summary>("/v1/summary"));

  return (
    <div>
      <h1>Dashboard</h1>
      <Show when={summary()} fallback={<div>Loading...</div>}>
        <div class="kpi-grid">
          <div class="kpi-card">
            <span class="kpi-label">Income</span>
            <span class="kpi-value">{summary()!.total_income}</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Expenses</span>
            <span class="kpi-value">{summary()!.total_expenses}</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Balance</span>
            <span class="kpi-value">
              {summary()!.total_income - summary()!.total_expenses}
            </span>
          </div>
        </div>

        <h2>Recent Transactions</h2>
        <table>
          <thead>
            <tr><th>Date</th><th>Title</th><th>Amount</th><th>Category</th></tr>
          </thead>
          <tbody>
            <For each={summary()!.recent_transactions}>
              {(tx) => (
                <tr>
                  <td>{tx.date}</td>
                  <td>{tx.title}</td>
                  <td>{tx.amount}</td>
                  <td>{tx.category_name}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Dashboard.tsx
git commit -m "feat: add dashboard page with KPIs"
```

---

## Task 11: Create Transactions Page

**Files:**
- Create: `frontend/src/pages/Transactions.tsx`

- [ ] **Step 1: Create transactions list with filters and create form**

```tsx
// frontend/src/pages/Transactions.tsx
import { createResource, createSignal, For, Show } from "solid-js";
import { api } from "../lib/api";

export default function Transactions() {
  const [typeFilter, setTypeFilter] = createSignal("");
  const [showForm, setShowForm] = createSignal(false);

  const [transactions] = createResource(
    () => typeFilter(),
    async (type) => {
      const params = type ? `?type=${type}` : "";
      return api.get<any[]>(`/v1/transactions${params}`);
    }
  );

  const [categories] = createResource(() => api.get<any[]>("/v1/categories"));
  const [accounts] = createResource(() => api.get<any[]>("/v1/accounts"));

  return (
    <div>
      <div class="page-header">
        <h1>Transactions</h1>
        <button onClick={() => setShowForm(!showForm())}>
          {showForm() ? "Cancel" : "Add Transaction"}
        </button>
      </div>

      <Show when={showForm()}>
        <TransactionForm
          categories={categories() || []}
          accounts={accounts() || []}
          onCreated={() => setShowForm(false)}
        />
      </Show>

      <div class="filters">
        <select onChange={(e) => setTypeFilter(e.currentTarget.value)}>
          <option value="">All Types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
          <option value="transfer">Transfer</option>
        </select>
      </div>

      <Show when={transactions()} fallback={<div>Loading...</div>}>
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Title</th><th>Amount</th>
              <th>Category</th><th>Account</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <For each={transactions()}>
              {(tx) => (
                <tr>
                  <td>{tx.date}</td>
                  <td>{tx.title}</td>
                  <td class={tx.type === "income" ? "positive" : "negative"}>
                    {tx.amount}
                  </td>
                  <td>{tx.category_name || "—"}</td>
                  <td>{tx.account_name}</td>
                  <td>
                    <button onClick={() => deleteTx(tx.id)}>Delete</button>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>
    </div>
  );
}

function TransactionForm(props: { categories: any[]; accounts: any[]; onCreated: () => void }) {
  // Form implementation with createSignal/createStore
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Transactions.tsx
git commit -m "feat: add transactions page with list and create form"
```

---

## Task 12: Create Remaining Pages (Stub Implementations)

Create stub pages for all remaining routes. Each fetches data from the API and renders a basic table/list.

**Files:**
- Create: `frontend/src/pages/Accounts.tsx`
- Create: `frontend/src/pages/Budgets.tsx`
- Create: `frontend/src/pages/Investments.tsx`
- Create: `frontend/src/pages/Loans.tsx`
- Create: `frontend/src/pages/Insurance.tsx`
- Create: `frontend/src/pages/NetWorth.tsx`
- Create: `frontend/src/pages/Reports.tsx`
- Create: `frontend/src/pages/Settings.tsx`
- Create: `frontend/src/pages/Import.tsx`
- Create: `frontend/src/pages/Export.tsx`

- [ ] **Step 1: Create each page**

Each page follows the same pattern as Dashboard/Transactions: fetch data from API, render table/list.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/
git commit -m "feat: add stub pages for all routes"
```

---

## Task 13: Update Go Backend to Serve SPA

**Files:**
- Modify: `embedassets.go`
- Modify: `cmd/server/main.go`

- [ ] **Step 1: Update embedassets.go**

Replace `web/` embed with `frontend/dist/`:

```go
package ledgerify

import "embed"

//go:embed all:frontend/dist
var staticFiles embed.FS

func StaticFS() embed.FS {
	return staticFiles
}
```

- [ ] **Step 2: Add SPA fallback handler in main.go**

```go
func spaHandler(fs embed.FS, root string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if path == "/" {
			path = "index.html"
		} else {
			path = strings.TrimPrefix(path, "/")
		}

		fullPath := root + "/" + path
		if _, err := fs.Stat(fullPath); os.IsNotExist(err) {
			r.URL.Path = "/"
			fullPath = root + "/index.html"
		}

		data, err := fs.ReadFile(fullPath)
		if err != nil {
			http.NotFound(w, r)
			return
		}

		if strings.HasSuffix(path, ".js") {
			w.Header().Set("Content-Type", "application/javascript")
		} else if strings.HasSuffix(path, ".css") {
			w.Header().Set("Content-Type", "text/css")
		} else {
			w.Header().Set("Content-Type", "text/html")
		}
		w.Write(data)
	})
}
```

Mount it:

```go
r.Handle("/*", spaHandler(embedassets.StaticFS(), "frontend/dist"))
```

- [ ] **Step 3: Build frontend**

```bash
cd frontend && bun run build
```

- [ ] **Step 4: Build Go server**

```bash
go build -o /tmp/ledgerify-server ./cmd/server
```

- [ ] **Step 5: Commit**

```bash
git add embedassets.go cmd/server/main.go
git commit -m "feat: serve SolidJS SPA from Go backend"
```

---

## Task 14: Remove Old Go Templates

**Files:**
- Delete: `web/templates/` (all files)
- Delete: `web/static/` (all files)
- Delete: `internal/templates/` (all files)
- Modify: `cmd/server/main.go` (remove page route handlers)

- [ ] **Step 1: Remove template files**

```bash
rm -rf web/templates web/static
rm -rf internal/templates
```

- [ ] **Step 2: Remove page route handlers from main.go**

Remove the entire page routes group (lines 96-145 in main.go). Keep only API routes, static file serving, and health check.

- [ ] **Step 3: Remove template imports from main.go**

Remove `"github.com/KTS-o7/ledgerify-web/internal/templates"` and all `ph.*` references.

- [ ] **Step 4: Build and verify**

```bash
go build -o /tmp/ledgerify-server ./cmd/server
```

Expected: Build succeeds. Server starts and serves the SPA.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: remove old Go template frontend"
```

---

## Task 15: Final Build and Test

- [ ] **Step 1: Build frontend**

```bash
cd frontend && bun run build && cd ..
```

- [ ] **Step 2: Build Go server**

```bash
go build -o /tmp/ledgerify-server ./cmd/server
```

- [ ] **Step 3: Run all Go tests**

```bash
go test ./...
```

- [ ] **Step 4: Run vet**

```bash
go vet ./...
```

- [ ] **Step 5: Manual test**

Start server, open `http://localhost:8080`, verify:
- Login page renders
- Login works (JWT stored)
- Dashboard loads with data
- Navigation works
- Transactions CRUD works
- All pages load

- [ ] **Step 6: Commit any fixes**

```bash
git add -A && git commit -m "fix: final frontend integration fixes"
```

---

## Verification Checklist

- [ ] `cd frontend && bun run build` succeeds
- [ ] `go build ./cmd/server` succeeds
- [ ] `go test ./...` passes
- [ ] `go vet ./...` clean
- [ ] SPA serves at `http://localhost:8080`
- [ ] Login/Register pages work
- [ ] Dashboard loads with real data
- [ ] Transactions page with CRUD
- [ ] All navigation links work
- [ ] Dark/light theme toggle works
- [ ] Mobile responsive
- [ ] API proxy works in dev mode
