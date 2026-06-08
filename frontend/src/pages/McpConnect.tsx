import { createMemo, createSignal, onMount, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { Plug, RefreshCw, CheckCircle2, XCircle } from "lucide-solid";
import { api } from "../lib/api";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Button } from "../components/ui/button";
import { CopyButton } from "../components/ui/copy-button";

const MCP_URL = "https://money.shenthar.me/api/v1/mcp/sse";

function readJwt(token: string | null): { exp?: number } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const padded = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(padded);
    return JSON.parse(decoded) as { exp?: number };
  } catch {
    return null;
  }
}

function tokenExpLabel(token: string | null): string {
  const claims = readJwt(token);
  if (!claims || typeof claims.exp !== "number") return "unknown";
  const days = (claims.exp * 1000 - Date.now()) / 86400000;
  if (days < 0) return "expired";
  if (days < 1) return "less than a day";
  if (days < 2) return "1 day";
  return `${Math.floor(days)} days`;
}

function buildConfig(token: string, url: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        ledgerify: {
          url,
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    },
    null,
    2
  );
}

export default function McpConnect() {
  const navigate = useNavigate();
  const [token, setToken] = createSignal<string | null>(null);
  const [refreshing, setRefreshing] = createSignal(false);
  const [refreshMsg, setRefreshMsg] = createSignal("");
  const [testStatus, setTestStatus] = createSignal<"idle" | "ok" | "fail">("idle");
  const [testMsg, setTestMsg] = createSignal("");

  onMount(() => {
    setToken(localStorage.getItem("jwt_token"));
  });

  const expLabel = createMemo(() => tokenExpLabel(token()));

  const configJson = createMemo(() => {
    const t = token();
    if (!t) return "";
    return buildConfig(t, MCP_URL);
  });

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshMsg("");
    try {
      const resp = await api.post<{ token: string }>("/v1/auth/refresh", undefined);
      localStorage.setItem("jwt_token", resp.token);
      setToken(resp.token);
      setRefreshMsg("Token regenerated.");
    } catch (err) {
      setRefreshMsg(err instanceof Error ? err.message : "Failed to refresh token.");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleTest() {
    const t = token();
    if (!t) {
      setTestStatus("fail");
      setTestMsg("No token available.");
      return;
    }
    setTestStatus("idle");
    setTestMsg("Connecting…");
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(MCP_URL, {
        method: "GET",
        headers: { Authorization: `Bearer ${t}` },
        signal: ctrl.signal,
      });
      clearTimeout(timeout);
      if (res.ok || res.status === 200 || res.status === 206) {
        setTestStatus("ok");
        setTestMsg("Connected. The MCP server accepted the token.");
      } else {
        setTestStatus("fail");
        setTestMsg(`Server returned ${res.status}.`);
      }
    } catch (err) {
      setTestStatus("fail");
      setTestMsg(err instanceof Error ? err.message : "Connection failed.");
    }
  }

  return (
    <>
      <PageHeader
        title="MCP Connect"
        back
      />
      <div class="p-4 md:p-6 flex flex-col gap-3 md:gap-4 max-w-3xl">
        <p class="text-sm text-muted font-body">
          Connect Claude Desktop, Cursor, or any MCP-compatible client to your Ledgerify account.
          The server speaks the Model Context Protocol over Server-Sent Events and authenticates
          with the same JWT you use in the browser.
        </p>

        {/* Server URL */}
        <BentoBlock>
          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-2">
              <Plug size={16} class="text-muted" />
              <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide">
                Server URL
              </span>
            </div>
            <div class="flex items-center gap-2 min-w-0">
              <code class="flex-1 min-w-0 truncate font-mono text-sm text-text bg-bg rounded-input border border-border px-3 py-2.5">
                {MCP_URL}
              </code>
              <CopyButton value={MCP_URL} label="Copy URL" />
            </div>
            <span class="text-[12px] text-muted font-body">The URL never changes.</span>
          </div>
        </BentoBlock>

        {/* Authentication Token */}
        <BentoBlock>
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between gap-2">
              <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide">
                Authentication Token
              </span>
              <Show when={token()}>
                <span class="text-[12px] text-muted font-body">
                  Expires in {expLabel()}
                </span>
              </Show>
            </div>
            <Show
              when={token()}
              fallback={
                <p class="text-sm text-muted font-body py-2">
                  You are not signed in.{" "}
                  <button
                    type="button"
                    onClick={() => navigate("/login")}
                    class="text-primary underline underline-offset-2 hover:no-underline"
                  >
                    Sign in
                  </button>{" "}
                  to view your token.
                </p>
              }
            >
              <div class="flex items-center gap-2 min-w-0">
                <code class="flex-1 min-w-0 truncate font-mono text-xs text-text bg-bg rounded-input border border-border px-3 py-2.5">
                  {token()}
                </code>
                <CopyButton value={token() ?? ""} label="Copy" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRefresh}
                  disabled={refreshing()}
                  class="h-9 px-3"
                >
                  <RefreshCw size={14} class={refreshing() ? "animate-spin" : ""} />
                  <span class="hidden sm:inline">{refreshing() ? "Regenerating…" : "Regenerate"}</span>
                </Button>
              </div>
              <Show when={refreshMsg()}>
                <span class="text-[12px] text-muted font-body">{refreshMsg()}</span>
              </Show>
            </Show>
          </div>
        </BentoBlock>

        {/* Connect to Claude Desktop */}
        <BentoBlock>
          <div class="flex flex-col gap-2">
            <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide">
              Connect to Claude Desktop
            </span>
            <p class="text-sm text-muted font-body">
              Paste this into <code class="font-mono text-[12px]">~/Library/Application Support/Claude/claude_desktop_config.json</code>{" "}
              (macOS) or <code class="font-mono text-[12px]">%APPDATA%\Claude\claude_desktop_config.json</code>{" "}
              (Windows), then restart Claude Desktop.
            </p>
            <div class="relative">
              <pre class="bg-bg rounded-input border border-border p-3 overflow-x-auto font-mono text-[12px] text-text leading-relaxed">
{configJson() || "// sign in to generate the config"}
              </pre>
              <div class="absolute top-2 right-2">
                <CopyButton value={configJson()} label="Copy config" />
              </div>
            </div>
          </div>
        </BentoBlock>

        {/* Test connection */}
        <BentoBlock>
          <div class="flex flex-col gap-3">
            <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide">
              Test connection
            </span>
            <div class="flex items-center gap-3 flex-wrap">
              <Button
                type="button"
                variant="outline"
                onClick={handleTest}
                disabled={!token() || testStatus() === "idle" && testMsg() === "Connecting…"}
              >
                {testMsg() === "Connecting…" ? "Connecting…" : "Test connection"}
              </Button>
              <Show when={testStatus() === "ok"}>
                <span class="inline-flex items-center gap-1.5 text-sm text-primary font-medium">
                  <CheckCircle2 size={16} />
                  {testMsg()}
                </span>
              </Show>
              <Show when={testStatus() === "fail"}>
                <span class="inline-flex items-center gap-1.5 text-sm text-accent font-medium">
                  <XCircle size={16} />
                  {testMsg()}
                </span>
              </Show>
            </div>
          </div>
        </BentoBlock>
      </div>
    </>
  );
}
