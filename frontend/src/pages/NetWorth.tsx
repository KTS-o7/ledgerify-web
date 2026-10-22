import { createMemo, createResource, createSignal, For, Show } from "solid-js";
import { Camera, Trash2 } from "lucide-solid";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { cn } from "../lib/utils";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { SkeletonBlock } from "../components/ui/skeleton";
import { Eyebrow } from "../components/ui/eyebrow";
import { NumberRoll } from "../components/ui/number-roll";
import { Money } from "../components/ui/money";
import { AreaChart } from "../components/ui/area-chart";
import { WealthTabs } from "../components/wealth/WealthTabs";
import { pct, shortDate } from "../components/wealth/common";

interface NetWorthData { total_assets: number; total_liabilities: number; networth: number; }
interface AccountBalance { name: string; type: string; currency: string; balance: number }
interface SummaryData { account_balances?: AccountBalance[] }
interface Snapshot {
  id: string;
  as_of: string;
  currency: string;
  total_assets: number;
  total_liabilities: number;
  networth: number;
  note: string | null;
}

type Range = "1M" | "6M" | "1Y" | "3Y" | "ALL";
const RANGES: { value: Range; days: number }[] = [
  { value: "1M", days: 30 },
  { value: "6M", days: 182 },
  { value: "1Y", days: 365 },
  { value: "3Y", days: 1095 },
  { value: "ALL", days: Infinity },
];
const DAY = 864e5;

type Segment = { label: string; value: number; color: string; liability?: boolean };

/** Asset / liability split for the composition bar. Account types come from the summary. */
function composition(nw: NetWorthData, accounts: AccountBalance[] | undefined): Segment[] {
  if (!accounts || accounts.length === 0) {
    return [
      { label: "Assets", value: Math.max(0, nw.total_assets), color: "var(--color-cat-1)" },
      { label: "Liabilities", value: Math.max(0, nw.total_liabilities), color: "var(--color-neg)", liability: true },
    ];
  }
  let cash = 0, invAccounts = 0, negAccounts = 0, accountSum = 0;
  for (const a of accounts) {
    accountSum += a.balance;
    if (a.balance < 0) negAccounts += -a.balance;
    else if (a.type === "investment") invAccounts += a.balance;
    else cash += a.balance;
  }
  // total_assets = account balances + investment holdings (see handlers/networth.go).
  const holdings = Math.max(0, nw.total_assets - accountSum);
  return [
    { label: "Bank & cash", value: cash, color: "var(--color-cat-4)" },
    { label: "Investments", value: invAccounts + holdings, color: "var(--color-cat-1)" },
    { label: "Liabilities", value: nw.total_liabilities + negAccounts, color: "var(--color-neg)", liability: true },
  ];
}

export default function NetWorth() {
  const [data] = createResource(() => api.get<NetWorthData>("/v1/networth"));
  const [summary] = createResource(() => api.get<SummaryData>("/v1/summary").catch(() => ({} as SummaryData)));
  const [snapshots, { refetch: refetchSnapshots }] = createResource(
    () => api.get<Snapshot[]>("/v1/networth/snapshots").catch(() => [] as Snapshot[])
  );

  const [range, setRange] = createSignal<Range>("1Y");
  const [snapshotting, setSnapshotting] = createSignal(false);
  const [snapshotMsg, setSnapshotMsg] = createSignal<string | null>(null);

  async function handleSnapshot() {
    setSnapshotting(true);
    setSnapshotMsg(null);
    try {
      await api.post("/v1/networth/snapshot", {});
      setSnapshotMsg("Snapshot saved");
      refetchSnapshots();
    } catch {
      setSnapshotMsg("Snapshot failed");
    } finally {
      setSnapshotting(false);
      setTimeout(() => setSnapshotMsg(null), 3000);
    }
  }

  async function handleDeleteSnapshot(id: string) {
    if (!confirm("Delete this snapshot?")) return;
    try {
      await api.delete(`/v1/networth/snapshots/${id}`);
      refetchSnapshots();
    } catch {
      alert("Failed to delete snapshot.");
    }
  }

  /** Snapshots oldest → newest. */
  const history = createMemo(() =>
    [...(snapshots() ?? [])].sort((a, b) => new Date(a.as_of).getTime() - new Date(b.as_of).getTime())
  );

  /** Chart series for the selected range, ending at today's live value. */
  const series = createMemo(() => {
    const now = Date.now();
    const days = RANGES.find((r) => r.value === range())!.days;
    const pts = history()
      .filter((s) => now - new Date(s.as_of).getTime() <= days * DAY)
      .map((s) => ({ t: new Date(s.as_of).getTime(), v: s.networth }));
    const live = data();
    if (live) pts.push({ t: now, v: live.networth });
    return pts;
  });

  const chartLabels = () => {
    const pts = series();
    if (pts.length < 2) return [];
    const n = Math.min(6, pts.length);
    const fmt = new Intl.DateTimeFormat("en-IN", { month: "short", ...(range() === "3Y" || range() === "ALL" ? { year: "2-digit" } : {}) });
    return Array.from({ length: n }, (_, i) => fmt.format(new Date(pts[Math.round((i * (pts.length - 1)) / (n - 1))]!.t)));
  };

  /** Change versus the snapshot nearest one year ago (or the oldest one). */
  const yearDelta = createMemo(() => {
    const live = data();
    const h = history();
    if (!live || h.length === 0) return null;
    const cutoff = Date.now() - 365 * DAY;
    const older = h.filter((s) => new Date(s.as_of).getTime() <= cutoff);
    const base = older.length > 0 ? older[older.length - 1]! : h[0]!;
    const change = live.networth - base.networth;
    const full = older.length > 0;
    return {
      change,
      pct: base.networth !== 0 ? (change / Math.abs(base.networth)) * 100 : null,
      label: full ? "1Y" : `since ${shortDate(base.as_of.slice(0, 10))}`,
    };
  });

  function formatSnapshotDate(iso: string): string {
    try {
      return new Intl.DateTimeFormat("en-IN", {
        year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  return (
    <>
      <PageHeader
        title="Net worth"
        actions={
          <div class="flex items-center gap-2">
            <span class="sr-only md:not-sr-only text-[12.5px] text-muted" role="status" aria-live="polite">{snapshotMsg() ?? ""}</span>
            <button
              type="button"
              onClick={handleSnapshot}
              disabled={snapshotting()}
              aria-label="Take net worth snapshot"
              class="inline-flex items-center justify-center gap-1.5 h-9 w-9 md:w-auto md:px-3 rounded-[10px] border border-border-strong text-text text-[13.5px] font-semibold hover:bg-raised active:scale-[0.97] transition-[background-color,transform] duration-[90ms] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal motion-reduce:active:scale-100"
            >
              <Camera size={16} />
              <span class="hidden md:inline">{snapshotting() ? "Saving…" : "Snapshot"}</span>
            </button>
          </div>
        }
      />

      <div class="px-5 md:px-7 py-5 md:py-6 flex flex-col gap-4">
        <WealthTabs />

        <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
          <Show when={data.loading}>
            <SkeletonBlock class="md:col-span-8 min-h-[300px]" />
            <SkeletonBlock class="md:col-span-4 min-h-[300px]" />
          </Show>

          <Show when={data.error && !data()}>
            <BentoBlock class="md:col-span-12 flex items-center justify-center py-16">
              <p class="text-neg text-[14px]">Couldn't load net worth. Try again later.</p>
            </BentoBlock>
          </Show>

          <Show when={data()}>
            {(d) => {
              const segments = () => composition(d(), summary()?.account_balances);
              const gross = () => segments().reduce((s, x) => s + x.value, 0) || 1;
              return (
                <>
                  {/* Value + trend */}
                  <BentoBlock class="md:col-span-8 flex flex-col gap-5 relative overflow-hidden aurora">
                    <div class="relative z-[1] flex flex-col gap-2">
                      <Eyebrow>Net worth</Eyebrow>
                      <NumberRoll
                        value={d().networth}
                        tone={d().networth >= 0 ? "signal" : "neg"}
                        mutedSymbol
                        class="text-[38px] md:text-[46px] leading-none tracking-[-0.045em]"
                      />
                      <Show when={yearDelta()}>
                        {(delta) => (
                          <div class={cn("font-mono tabular text-[13px]", delta().change >= 0 ? "text-pos" : "text-neg")}>
                            {delta().change >= 0 ? "↑" : "↓"} <Money value={Math.abs(delta().change)} tone={delta().change >= 0 ? "pos" : "neg"} />
                            <Show when={delta().pct !== null}> · {pct(delta().pct!)}</Show>
                            <span class="text-muted"> {delta().label}</span>
                          </div>
                        )}
                      </Show>
                    </div>

                    <div class="relative z-[1]">
                      <Show
                        when={series().length > 1}
                        fallback={
                          <div class="h-[170px] flex items-center justify-center rounded-[14px] border border-dashed border-border-strong">
                            <p class="text-[13.5px] text-muted text-center px-6 text-pretty">
                              Take a snapshot now and then to build your net worth trend.
                            </p>
                          </div>
                        }
                      >
                        <AreaChart
                          values={series().map((p) => p.v)}
                          labels={chartLabels()}
                          height={170}
                          endDot
                          color={d().networth >= 0 ? "var(--color-signal)" : "var(--color-neg)"}
                          ariaLabel={`Net worth trend, ${range()}, ${series().length} points, now ${formatCurrency(d().networth)}`}
                        />
                      </Show>
                    </div>

                    <div class="relative z-[1] flex gap-1.5" role="group" aria-label="Chart range">
                      <For each={RANGES}>
                        {(r) => (
                          <button
                            type="button"
                            onClick={() => setRange(r.value)}
                            aria-pressed={range() === r.value}
                            class={cn(
                              "h-7 px-3 rounded-pill font-mono text-[11.5px] tabular transition-colors duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal",
                              range() === r.value ? "bg-signal-soft text-signal" : "text-muted hover:text-text hover:bg-raised"
                            )}
                          >
                            {r.value}
                          </button>
                        )}
                      </For>
                    </div>
                  </BentoBlock>

                  {/* Composition */}
                  <BentoBlock class="md:col-span-4 flex flex-col gap-5">
                    <Eyebrow>Composition</Eyebrow>
                    <div
                      class="flex h-3 w-full rounded-pill overflow-hidden bg-sunken gap-[2px]"
                      role="img"
                      aria-label={segments().map((s) => `${s.label} ${formatCurrency(s.value)}`).join(", ")}
                    >
                      <For each={segments().filter((s) => s.value > 0)}>
                        {(s) => (
                          <div
                            class="h-full transition-[width] duration-[800ms] ease-[var(--ease-standard)] motion-reduce:transition-none"
                            style={{ width: `${(s.value / gross()) * 100}%`, background: s.color }}
                          />
                        )}
                      </For>
                    </div>
                    <ul class="flex flex-col gap-3">
                      <For each={segments()}>
                        {(s) => (
                          <li class="flex items-center gap-2.5 text-[13.5px]">
                            <span class="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: s.color }} aria-hidden="true" />
                            <span class="flex-1 text-text">{s.label}</span>
                            <span class="font-mono tabular text-[12px] text-muted w-10 text-right">{Math.round((s.value / gross()) * 100)}%</span>
                            <Money value={s.liability ? -s.value : s.value} tone={s.liability ? "neg" : "text"} class="text-[13.5px] min-w-[96px] text-right" />
                          </li>
                        )}
                      </For>
                    </ul>
                    <div class="mt-auto pt-4 border-t border-border grid grid-cols-2 gap-3">
                      <div>
                        <Eyebrow class="text-[10.5px]">Assets</Eyebrow>
                        <Money value={d().total_assets} class="block mt-1.5 text-[17px] tracking-[-0.03em]" />
                      </div>
                      <div>
                        <Eyebrow class="text-[10.5px]">Liabilities</Eyebrow>
                        <Money value={-d().total_liabilities} tone={d().total_liabilities > 0 ? "neg" : "text"} class="block mt-1.5 text-[17px] tracking-[-0.03em]" />
                      </div>
                    </div>
                  </BentoBlock>
                </>
              );
            }}
          </Show>

          {/* Snapshot history */}
          <BentoBlock class="md:col-span-12 p-0 overflow-hidden">
            <div class="flex items-center justify-between px-5 h-12 border-b border-border">
              <Eyebrow as="h2">Snapshot history</Eyebrow>
              <span class="font-mono tabular text-[12px] text-muted">{(snapshots() ?? []).length}</span>
            </div>

            <Show when={snapshots.loading}>
              <div class="px-5 py-4 text-[13.5px] text-muted">Loading snapshots…</div>
            </Show>

            <Show when={!snapshots.loading && (snapshots() ?? []).length === 0}>
              <p class="px-5 py-10 text-center text-[13.5px] text-muted text-pretty">
                No snapshots yet. Use Snapshot to record today's net worth.
              </p>
            </Show>

            <Show when={(snapshots() ?? []).length > 0}>
              <ul class="divide-y divide-border">
                <For each={snapshots() ?? []}>
                  {(snap) => (
                    <li class="group flex items-center gap-3 px-5 min-h-[56px] py-2 hover:bg-raised transition-colors duration-[160ms]">
                      <div class="flex-1 min-w-0">
                        <Money value={snap.networth} currency={snap.currency} tone={snap.networth < 0 ? "neg" : "text"} class="text-[14.5px]" />
                        <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 font-mono tabular text-[11.5px] text-muted">
                          <span>{formatSnapshotDate(snap.as_of)}</span>
                          <span>assets <Money value={snap.total_assets} currency={snap.currency} tone="muted" /></span>
                          <span>debt <Money value={snap.total_liabilities} currency={snap.currency} tone={snap.total_liabilities > 0 ? "neg" : "muted"} /></span>
                        </div>
                        <Show when={snap.note}>
                          <p class="text-[12.5px] text-muted italic mt-0.5">{snap.note}</p>
                        </Show>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteSnapshot(snap.id)}
                        aria-label={`Delete snapshot from ${formatSnapshotDate(snap.as_of)}`}
                        class="opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 w-8 h-8 flex items-center justify-center rounded-[8px] text-muted hover:text-neg hover:bg-surface transition-[opacity,color] duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </BentoBlock>
        </div>
      </div>
    </>
  );
}
