import { createMemo, createSignal, For, Match, onCleanup, onMount, Show, Switch, type Component, type JSX } from "solid-js";
import { A } from "@solidjs/router";
import { Dynamic } from "solid-js/web";
import {
  Eye, EyeOff, RefreshCw, Plug, Loader2, CheckCircle2, XCircle, Monitor, MessageSquareQuote, Share2,
  ReceiptText, Wallet, Tags, Target, Repeat, PiggyBank, TrendingUp, Coins, Landmark, ShieldCheck, Gem,
  ArrowDownUp, ArrowLeftRight, UserRound,
} from "lucide-solid";
import { api } from "../lib/api";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Button } from "../components/ui/button";
import { CopyButton } from "../components/ui/copy-button";
import { SegmentedControl } from "../components/ui/segmented-control";
import { Eyebrow } from "../components/ui/eyebrow";
import { cn } from "../lib/utils";
import { ConfigJson } from "../components/mcp/ConfigJson";
import {
  CLIENTS, DOMAIN_LABELS, KNOWN_TOOLS, buildConfig, expiryLabel, groupTools, maskToken, mcpSseUrl, testConnection,
  type ClientId, type DomainId,
} from "../components/mcp/client";

type Icon = Component<{ size?: number; class?: string }>;

const DOMAIN_ICONS: Record<DomainId, Icon> = {
  transactions: ReceiptText, accounts: Wallet, categories: Tags, budgets: Target, recurring: Repeat,
  savings: PiggyBank, investments: TrendingUp, sips: Coins, loans: Landmark, insurance: ShieldCheck,
  networth: Gem, transfer: ArrowDownUp, currency: ArrowLeftRight, profile: UserRound,
};

const PROMPTS = [
  "“How much did I spend on dining in October compared to September?”",
  "“Add ₹420 at Blue Tokai to HDFC, category Dining.”",
  "“Which budgets will I overshoot at this pace?”",
  "“When does my health insurance renew, and what’s the premium?”",
];

type ServerState = "checking" | "online" | "offline";
type TestState =
  | { kind: "idle" }
  | { kind: "run" }
  | { kind: "ok"; ms: number }
  | { kind: "fail"; message: string };

/** Numbered card header: signal-soft step dot, title, right-side note. */
const StepCard: Component<{ step: number; title: string; aside?: JSX.Element; class?: string; children: JSX.Element }> = (props) => (
  <BentoBlock class={cn("flex flex-col gap-3 px-5 py-[18px]", props.class)}>
    <div class="flex items-center gap-2.5 flex-wrap">
      <span class="w-[22px] h-[22px] rounded-full bg-signal-soft text-signal flex items-center justify-center font-mono font-semibold text-[11px]" aria-hidden="true">
        {props.step}
      </span>
      <h2 class="text-[14.5px] font-semibold text-text flex-1">{props.title}</h2>
      {props.aside}
    </div>
    {props.children}
  </BentoBlock>
);

const fieldBox = "flex items-center min-w-0 h-10 px-3.5 rounded-[10px] bg-bg border border-border font-mono text-[13px]";
const iconBtn = "w-10 h-10 shrink-0 flex items-center justify-center rounded-[10px] border border-border-strong text-text hover:bg-raised transition-colors duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal";

export default function McpConnect() {
  const [token, setToken] = createSignal<string | null>(null);
  const [showToken, setShowToken] = createSignal(false);
  const [refreshing, setRefreshing] = createSignal(false);
  const [refreshMsg, setRefreshMsg] = createSignal("");
  const [client, setClient] = createSignal<ClientId>("claude");
  const [server, setServer] = createSignal<ServerState>("checking");
  const [test, setTest] = createSignal<TestState>({ kind: "idle" });
  const [liveTools, setLiveTools] = createSignal<string[] | null>(null);
  const [shareMsg, setShareMsg] = createSignal("");
  const [now, setNow] = createSignal(Date.now());

  const url = mcpSseUrl();

  async function checkServer() {
    setServer("checking");
    try {
      const res = await fetch("/health", { cache: "no-store" });
      setServer(res.ok ? "online" : "offline");
    } catch {
      setServer("offline");
    }
  }

  onMount(() => {
    setToken(localStorage.getItem("jwt_token"));
    void checkServer();
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    const onOnline = () => void checkServer();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOnline);
    onCleanup(() => {
      clearInterval(tick);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOnline);
    });
  });

  const expiry = createMemo(() => expiryLabel(token(), now()));
  const clientNote = createMemo(() => CLIENTS.find((c) => c.value === client())!.note);
  const configJson = createMemo(() => (token() ? buildConfig(client(), url, token()!) : ""));
  // What we show on screen: the token stays masked unless the eye is on.
  const shownConfig = createMemo(() => {
    const t = token();
    if (!t) return buildConfig(client(), url, "<sign in to get a token>");
    return buildConfig(client(), url, showToken() ? t : maskToken(t));
  });

  const toolNames = () => liveTools() ?? KNOWN_TOOLS;
  const domains = createMemo(() => groupTools(toolNames()));

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshMsg("");
    try {
      const resp = await api.post<{ token: string }>("/v1/auth/refresh", undefined);
      localStorage.setItem("jwt_token", resp.token);
      setToken(resp.token);
      setTest({ kind: "idle" });
      setRefreshMsg("New token issued. Update every client that used the old one.");
    } catch (err) {
      setRefreshMsg(err instanceof Error ? err.message : "Could not regenerate the token.");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleTest() {
    const t = token();
    if (!t) { setTest({ kind: "fail", message: "Sign in to get a token first." }); return; }
    setTest({ kind: "run" });
    const r = await testConnection(t);
    if (r.ok) {
      setTest({ kind: "ok", ms: r.ms });
      setServer("online");
      if (r.tools && r.tools.length > 0) setLiveTools(r.tools);
    } else {
      setTest({ kind: "fail", message: r.message });
    }
  }

  async function handleShare() {
    setShareMsg("");
    const text = configJson();
    if (!text) return;
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: "Ledgerify MCP config", text });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareMsg("Sharing isn't available here, so the config was copied instead.");
    } catch {
      setShareMsg("Sharing isn't available here. Use Copy config.");
    }
  }

  const statusPill = () => (
    <span
      role="status"
      class="inline-flex items-center gap-[7px] h-[26px] px-2.5 rounded-pill bg-surface border border-border text-[12px] font-medium text-text whitespace-nowrap"
    >
      <span
        class={cn("w-1.5 h-1.5 rounded-full", server() === "online" ? "bg-pos" : server() === "offline" ? "bg-neg" : "bg-faint")}
        aria-hidden="true"
      />
      {server() === "online" ? "Server online" : server() === "offline" ? "Server unreachable" : "Checking…"}
    </span>
  );

  const testStatus = () => (
    <span class="inline-flex items-center gap-2 text-[13.5px] font-medium min-w-0" role="status" aria-live="polite">
      <Switch>
        <Match when={test().kind === "run"}>
          <Loader2 size={15} class="text-muted animate-spin motion-reduce:animate-none" />
          <span class="text-muted">Connecting…</span>
        </Match>
        <Match when={test().kind === "ok"}>
          <CheckCircle2 size={15} class="text-pos shrink-0" />
          <span class="text-pos">Connected · <span class="font-mono tabular">{(test() as { ms: number }).ms} ms</span></span>
        </Match>
        <Match when={test().kind === "fail"}>
          <XCircle size={15} class="text-neg shrink-0" />
          <span class="text-neg">{(test() as { message: string }).message}</span>
        </Match>
        <Match when={test().kind === "idle"}>
          <span class="text-muted">Checks that the server accepts your token.</span>
        </Match>
      </Switch>
    </span>
  );

  const signInPrompt = (
    <p class="text-[13.5px] text-muted">
      You are signed out. <A href="/login" class="text-signal underline underline-offset-2">Sign in</A> to get a token.
    </p>
  );

  return (
    <>
      <PageHeader
        title="MCP connect"
        actions={
          <div class="flex items-center gap-4">
            <span class="hidden sm:inline-flex">{statusPill()}</span>
            <span class="hidden lg:inline text-[13px] text-muted">Model Context Protocol over SSE</span>
          </div>
        }
      />

      <div class="px-5 md:px-7 py-5 grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-4">
        {/* Left column: the four steps */}
        <div class="flex flex-col gap-3 min-w-0">
          <p class="text-[14px] text-muted md:hidden">Let Claude, Cursor or any MCP client read and update your ledger.</p>
          <div class="sm:hidden">{statusPill()}</div>

          <StepCard step={1} title="Server URL" aside={<span class="text-[12px] text-muted">Never changes</span>}>
            <div class="flex gap-2 min-w-0">
              <code class={cn(fieldBox, "flex-1 text-text")}>
                <span class="truncate">{url}</span>
              </code>
              <CopyButton value={url} label="Copy" variant="default" class="h-10 min-w-[96px] justify-center" />
            </div>
          </StepCard>

          <StepCard
            step={2}
            title="Access token"
            aside={
              <Show when={token()}>
                <Show when={expiry()} fallback={<span class="font-mono text-[12px] text-muted">no expiry claim</span>}>
                  {(e) => <span class={cn("font-mono text-[12px] tabular", e().expired ? "text-neg" : "text-muted")}>{e().label}</span>}
                </Show>
              </Show>
            }
          >
            <Show when={token()} fallback={signInPrompt}>
              {(t) => (
                <>
                  <div class="flex flex-wrap sm:flex-nowrap gap-2 min-w-0">
                    <code class={cn(fieldBox, "basis-full sm:basis-auto sm:flex-1 text-muted text-[12.5px] overflow-x-auto")} aria-label={showToken() ? "Access token" : "Access token, hidden"}>
                      <span class={showToken() ? "whitespace-nowrap" : "truncate"}>{showToken() ? t() : maskToken(t())}</span>
                    </code>
                    <button
                      type="button"
                      class={iconBtn}
                      onClick={() => setShowToken((v) => !v)}
                      aria-pressed={showToken()}
                      aria-label={showToken() ? "Hide token" : "Show token"}
                    >
                      <Show when={showToken()} fallback={<Eye size={15} />}><EyeOff size={15} /></Show>
                    </button>
                    <CopyButton value={t()} label="Copy" variant="default" class="h-10 min-w-[96px] justify-center" />
                    <Button type="button" variant="outline" class="h-10" onClick={handleRefresh} disabled={refreshing()}>
                      <RefreshCw size={14} class={refreshing() ? "animate-spin motion-reduce:animate-none" : ""} />
                      {refreshing() ? "Regenerating…" : "Regenerate"}
                    </Button>
                  </div>
                  <span class="text-[12.5px] text-muted" aria-live="polite">
                    {refreshMsg() || "Full read and write access to your ledger. Keep it private."}
                  </span>
                </>
              )}
            </Show>
          </StepCard>

          <StepCard
            step={3}
            title="Add to your client"
            class="hidden md:flex"
            aside={
              <SegmentedControl
                options={CLIENTS.map((c) => ({ value: c.value, label: c.label }))}
                value={client()}
                onChange={setClient}
                size="sm"
                ariaLabel="MCP client"
                class="w-auto"
              />
            }
          >
            <p class="text-[12.5px] leading-[1.45] text-muted">{clientNote()}</p>
            <div class="relative rounded-[12px] bg-bg border border-border">
              <ConfigJson json={shownConfig()} class="px-4 py-3 pr-28" label={`${CLIENTS.find((c) => c.value === client())!.label} configuration`} />
              <Show when={token()}>
                <div class="absolute top-2.5 right-2.5">
                  <CopyButton value={configJson()} label="Copy config" variant="default" class="h-8" />
                </div>
              </Show>
            </div>
          </StepCard>

          <BentoBlock class="flex flex-wrap items-center gap-3.5 px-5 py-3.5">
            <span class="w-[22px] h-[22px] rounded-full bg-signal-soft text-signal flex items-center justify-center font-mono font-semibold text-[11px]" aria-hidden="true">4</span>
            <Button type="button" onClick={handleTest} disabled={!token() || test().kind === "run"}>
              <Plug size={14} />
              {test().kind === "ok" || test().kind === "fail" ? "Test again" : "Test connection"}
            </Button>
            {testStatus()}
          </BentoBlock>

          {/* Mobile: finish on a desktop client */}
          <div class="md:hidden flex flex-col gap-3 p-4 rounded-card bg-signal-soft">
            <div class="flex items-center gap-2.5">
              <Monitor size={18} class="text-signal" />
              <h2 class="text-[14.5px] font-semibold text-text">Finish on your computer</h2>
            </div>
            <p class="text-[13.5px] leading-[1.5] text-text">
              Desktop clients need a config file. Send yourself the ready-made config, or open MCP connect on desktop.
            </p>
            <Show when={token()} fallback={signInPrompt}>
              <div class="grid grid-cols-2 gap-2">
                <CopyButton value={configJson()} label="Copy config" variant="default" class="h-11 rounded-[12px] justify-center text-[14px]" />
                <Button type="button" class="h-11 rounded-[12px] text-[14px]" onClick={handleShare}>
                  <Share2 size={15} />
                  Share…
                </Button>
              </div>
              <p class="text-[12px] text-muted" aria-live="polite">
                {shareMsg() || "The config holds your token. Send it only to yourself."}
              </p>
            </Show>
          </div>
        </div>

        {/* Right column: reach + prompts */}
        <div class="flex flex-col gap-3.5 min-w-0">
          <BentoBlock class="flex flex-col gap-3.5">
            <div class="flex items-baseline justify-between gap-3">
              <Eyebrow as="h2">What your assistant can reach</Eyebrow>
              <span class="font-mono font-medium text-[12px] text-muted tabular" title={liveTools() ? "From the server's live tool list" : "From the tools this server registers"}>
                {toolNames().length} tools{liveTools() ? " · live" : ""}
              </span>
            </div>
            <ul class="flex flex-wrap gap-1.5" aria-label="Tool domains">
              <For each={domains()}>
                {(d) => (
                  <li class="inline-flex items-center gap-[7px] h-[30px] px-[11px] rounded-pill border border-border-strong text-[12.5px] font-medium text-text">
                    <Dynamic component={DOMAIN_ICONS[d.id]} size={13} class="text-muted" />
                    {DOMAIN_LABELS[d.id]}
                    <span class="font-mono text-[11px] text-faint tabular">{d.count}</span>
                  </li>
                )}
              </For>
            </ul>
          </BentoBlock>

          <BentoBlock class="flex flex-col gap-2.5">
            <Eyebrow as="h2">Try asking</Eyebrow>
            <For each={PROMPTS}>
              {(p) => (
                <div class="flex gap-3 p-3.5 rounded-[12px] bg-bg border border-border font-display text-[18px] leading-[1.4] text-text">
                  <MessageSquareQuote size={15} class="text-signal mt-1 shrink-0" aria-hidden="true" />
                  <span>{p}</span>
                </div>
              )}
            </For>
          </BentoBlock>
        </div>
      </div>
    </>
  );
}
