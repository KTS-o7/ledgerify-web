/**
 * Browser-side helpers for the MCP connect page: JWT expiry, client configs,
 * a minimal JSON-RPC client for the streamable endpoint, and tool grouping.
 */

export const MCP_SSE_PATH = "/api/v1/mcp/sse";
export const MCP_STREAM_PATH = "/api/v1/mcp/stream";

export const mcpSseUrl = () => `${location.origin}${MCP_SSE_PATH}`;
const mcpStreamUrl = () => `${location.origin}${MCP_STREAM_PATH}`;

/** Read the `exp` claim (seconds since epoch) without verifying the token. */
export function jwtExp(token: string | null): number | null {
  if (!token) return null;
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const claims = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof claims.exp === "number" ? claims.exp : null;
  } catch {
    return null;
  }
}

export type Expiry = { label: string; expired: boolean } | null;

/** "expires in 6 days" / "expires in 5 h" / "expired". Null when there is no exp claim. */
export function expiryLabel(token: string | null, now = Date.now()): Expiry {
  const exp = jwtExp(token);
  if (exp === null) return null;
  const ms = exp * 1000 - now;
  if (ms <= 0) return { label: "expired", expired: true };
  const hours = ms / 3_600_000;
  if (hours < 1) return { label: `expires in ${Math.max(1, Math.floor(ms / 60_000))} min`, expired: false };
  if (hours < 48) return { label: `expires in ${Math.floor(hours)} h`, expired: false };
  return { label: `expires in ${Math.floor(hours / 24)} days`, expired: false };
}

export function maskToken(token: string): string {
  return `${token.slice(0, 10)}${"•".repeat(14)}`;
}

export type ClientId = "claude" | "cursor" | "other";

export const CLIENTS: { value: ClientId; label: string; note: string }[] = [
  {
    value: "claude",
    label: "Claude Desktop",
    note: "Settings → Developer → Edit config opens claude_desktop_config.json. Paste this in, then restart Claude. It bridges the remote server through mcp-remote (needs Node.js).",
  },
  {
    value: "cursor",
    label: "Cursor",
    note: "Open Settings → MCP → Add new server, or paste this into ~/.cursor/mcp.json.",
  },
  {
    value: "other",
    label: "Other",
    note: "Any client that supports remote MCP over SSE. Send the token as a Bearer Authorization header.",
  },
];

/** Client config as a JSON string. */
export function buildConfig(client: ClientId, url: string, token: string): string {
  const auth = `Bearer ${token}`;
  const server =
    client === "claude"
      ? { command: "npx", args: ["-y", "mcp-remote", url, "--header", `Authorization:${auth}`] }
      : client === "cursor"
        ? { url, headers: { Authorization: auth } }
        : { type: "sse", url, headers: { Authorization: auth } };
  return JSON.stringify({ mcpServers: { ledgerify: server } }, null, 2);
}

// ---------------------------------------------------------------------------
// JSON-RPC over the streamable HTTP endpoint
// ---------------------------------------------------------------------------

type RpcResult = { status: number; sessionId: string | null; body: Record<string, unknown> | null };

async function rpc(token: string, payload: Record<string, unknown>, sessionId: string | null, signal: AbortSignal): Promise<RpcResult> {
  const res = await fetch(mcpStreamUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${token}`,
      ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", ...payload }),
    signal,
  });
  const sid = res.headers.get("Mcp-Session-Id") ?? sessionId;
  const text = await res.text();
  let body: Record<string, unknown> | null = null;
  if ((res.headers.get("content-type") ?? "").includes("text/event-stream")) {
    // Take the last `data:` line that parses as a JSON-RPC message.
    for (const line of text.split("\n")) {
      if (!line.startsWith("data:")) continue;
      try { body = JSON.parse(line.slice(5).trim()); } catch { /* keep looking */ }
    }
  } else if (text) {
    try { body = JSON.parse(text); } catch { body = null; }
  }
  return { status: res.status, sessionId: sid, body };
}

export type TestResult =
  | { ok: true; ms: number; tools: string[] | null }
  | { ok: false; message: string };

/** initialize → notifications/initialized → tools/list. `ms` is the initialize round trip. */
export async function testConnection(token: string, timeoutMs = 8000): Promise<TestResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const t0 = performance.now();
    const init = await rpc(token, {
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "ledgerify-web", version: "1.0.0" } },
    }, null, ctrl.signal);
    const ms = Math.round(performance.now() - t0);
    if (init.status === 401 || init.status === 403) return { ok: false, message: `Token rejected (${init.status}). Regenerate it and try again.` };
    if (init.status >= 400) return { ok: false, message: `Server returned ${init.status}.` };
    if (!init.body || "error" in init.body) return { ok: false, message: "Server answered, but not with an MCP handshake." };

    let tools: string[] | null = null;
    try {
      await rpc(token, { method: "notifications/initialized" }, init.sessionId, ctrl.signal);
      const list = await rpc(token, { id: 2, method: "tools/list" }, init.sessionId, ctrl.signal);
      const result = list.body?.result as { tools?: { name: string }[] } | undefined;
      if (result?.tools) tools = result.tools.map((t) => t.name);
    } catch { /* the handshake worked; the live tool list is a bonus */ }
    return { ok: true, ms, tools };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return { ok: false, message: "Timed out after 8 s." };
    return { ok: false, message: err instanceof Error ? err.message : "Connection failed." };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

/** Tool names registered in internal/mcp (used until a live tools/list arrives). */
export const KNOWN_TOOLS = [
  "add_keyword", "categorise_transactions", "create_account", "create_budget", "create_category", "create_insurance",
  "create_insurance_payment", "create_investment", "create_investment_transaction", "create_loan", "create_loan_payment",
  "create_recurring", "create_savings_goal", "create_sip", "create_transaction", "delete_account", "delete_budget",
  "delete_category", "delete_insurance", "delete_investment", "delete_investment_transaction", "delete_keyword",
  "delete_loan", "delete_networth_snapshot", "delete_recurring", "delete_savings_goal", "delete_sip", "delete_transaction",
  "export_transactions", "get_auth_status", "get_exchange_rates", "get_loan", "get_networth", "get_networth_trend",
  "get_savings_goal", "get_sip", "get_summary", "get_transaction", "import_transactions", "list_accounts", "list_budgets",
  "list_categories", "list_insurance", "list_investment_transactions", "list_investments", "list_keywords", "list_loans",
  "list_networth_snapshots", "list_recurring", "list_savings_goals", "list_sips", "list_transactions",
  "mark_insurance_premium_paid", "mark_loan_payment_paid", "refresh_token", "run_recurring", "set_exchange_rate",
  "snapshot_networth", "update_account", "update_budget", "update_category", "update_insurance", "update_investment",
  "update_loan", "update_loan_payment", "update_recurring", "update_savings_goal", "update_sip", "update_transaction",
  "update_user_profile",
];

export type DomainId =
  | "transactions" | "accounts" | "categories" | "budgets" | "recurring" | "savings" | "investments"
  | "sips" | "loans" | "insurance" | "networth" | "transfer" | "currency" | "profile";

export const DOMAIN_LABELS: Record<DomainId, string> = {
  transactions: "Transactions", accounts: "Accounts", categories: "Categories & rules", budgets: "Budgets",
  recurring: "Recurring", savings: "Savings goals", investments: "Investments", sips: "SIPs", loans: "Loans",
  insurance: "Insurance", networth: "Net worth", transfer: "Import / Export", currency: "Exchange rates",
  profile: "Profile & token",
};

/** Map a tool name to its domain. Order matters: the most specific match wins. */
export function toolDomain(name: string): DomainId {
  if (/^(import|export)_/.test(name)) return "transfer";
  if (name.includes("investment")) return "investments";
  if (name.includes("loan")) return "loans";
  if (name.includes("insurance")) return "insurance";
  if (/(^|_)sips?($|_)/.test(name)) return "sips";
  if (name.includes("savings_goal")) return "savings";
  if (name.includes("recurring")) return "recurring";
  if (name.includes("networth")) return "networth";
  if (name.includes("budget")) return "budgets";
  if (name.includes("keyword") || name.includes("categor")) return "categories";
  if (name.includes("account")) return "accounts";
  if (name.includes("transaction") || name === "get_summary") return "transactions";
  if (name.includes("exchange_rate")) return "currency";
  return "profile";
}

/** Domains in display order with their tool counts. */
export function groupTools(names: string[]): { id: DomainId; count: number }[] {
  const counts = new Map<DomainId, number>();
  for (const n of names) counts.set(toolDomain(n), (counts.get(toolDomain(n)) ?? 0) + 1);
  return (Object.keys(DOMAIN_LABELS) as DomainId[])
    .filter((id) => counts.has(id))
    .map((id) => ({ id, count: counts.get(id)! }));
}
