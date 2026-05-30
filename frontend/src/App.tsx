import { Router, Route } from "@solidjs/router";
import { lazy } from "solid-js";
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
