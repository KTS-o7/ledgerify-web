import { createResource, createSignal, For, Show } from "solid-js";
import { BarChart3, TrendingUp, TrendingDown, Minus, Camera, Trash2, AlertTriangle } from "lucide-solid";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Stat } from "../components/ui/stat";
import { Sparkline } from "../components/ui/sparkline";
import { SkeletonBlock } from "../components/ui/skeleton";

interface NetWorthData { total_assets: number; total_liabilities: number; networth: number; }
interface SummaryData { monthly_networth: Array<{ date: string; total_balance: number }>; }
interface Snapshot {
  id: string;
  as_of: string;
  currency: string;
  total_assets: number;
  total_liabilities: number;
  networth: number;
  note: string | null;
}

export default function NetWorth() {
  const [data] = createResource(() => api.get<NetWorthData>("/v1/networth"));
  const [summary] = createResource(() => api.get<SummaryData>("/v1/summary"));
  const [snapshots, { refetch: refetchSnapshots }] = createResource(
    () => api.get<Snapshot[]>("/v1/networth/snapshots").catch(() => [] as Snapshot[])
  );

  const [snapshotting, setSnapshotting] = createSignal(false);
  const [snapshotMsg, setSnapshotMsg] = createSignal<string | null>(null);

  async function handleSnapshot() {
    setSnapshotting(true);
    setSnapshotMsg(null);
    try {
      await api.post("/v1/networth/snapshot", {});
      setSnapshotMsg("Snapshot saved!");
      refetchSnapshots();
      setTimeout(() => setSnapshotMsg(null), 3000);
    } catch {
      setSnapshotMsg("Failed to take snapshot.");
      setTimeout(() => setSnapshotMsg(null), 3000);
    } finally {
      setSnapshotting(false);
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

  function formatSnapshotDate(iso: string): string {
    try {
      return new Intl.DateTimeFormat("en-IN", {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  return (
    <>
      <PageHeader
        title="Net Worth"
        actions={
          <div class="flex items-center gap-2">
            <Show when={snapshotMsg()}>
              <span class="text-xs text-muted">{snapshotMsg()}</span>
            </Show>
            <button
              type="button"
              onClick={handleSnapshot}
              disabled={snapshotting()}
              aria-label="Take net worth snapshot"
              class="w-10 h-10 flex items-center justify-center rounded-full bg-surface text-text active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-50"
            >
              <Camera size={20} />
            </button>
          </div>
        }
      />
      <div class="p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4">

        <Show when={data.loading}>
          <SkeletonBlock class="col-span-1 md:col-span-5 min-h-[200px]" />
          <SkeletonBlock class="col-span-1 md:col-span-7 min-h-[200px]" />
        </Show>

        <Show when={data.error && !data()}>
          <BentoBlock class="col-span-1 md:col-span-12 flex items-center justify-center py-16">
            <p class="text-accent text-sm">Couldn't load net worth. Try again later.</p>
          </BentoBlock>
        </Show>

        <Show when={data()}>
          {(d) => {
            const isPositive = () => d().networth >= 0;
            const sparkValues = () => (summary()?.monthly_networth ?? []).map((r) => r.total_balance);
            const hasSpark = () => sparkValues().length > 1;

            return (
              <>
                {/* Left: headline figure + asset/liability breakdown */}
                <BentoBlock class="col-span-1 md:col-span-5 flex flex-col justify-between gap-6 min-h-[240px]">
                  <Stat
                    label="Net Worth"
                    value={formatCurrency(d().networth)}
                    size="xl"
                    tone={isPositive() ? "primary" : "accent"}
                  />
                  <div class="flex flex-col gap-4 pt-2 border-t border-border">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <TrendingUp size={14} class="text-primary" />
                        <span class="text-[13px] text-muted font-medium uppercase tracking-wide">Assets</span>
                      </div>
                      <span class="font-display font-semibold text-lg text-primary">{formatCurrency(d().total_assets)}</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <TrendingDown size={14} class="text-accent" />
                        <span class="text-[13px] text-muted font-medium uppercase tracking-wide">Liabilities</span>
                      </div>
                      <span class="font-display font-semibold text-lg text-accent">{formatCurrency(d().total_liabilities)}</span>
                    </div>
                    <div class="flex items-center justify-between pt-2 border-t border-border">
                      <div class="flex items-center gap-2">
                        <Minus size={14} class={isPositive() ? "text-primary" : "text-accent"} />
                        <span class="text-[13px] text-muted font-medium uppercase tracking-wide">Net</span>
                      </div>
                      <span class={`font-display font-bold text-xl ${isPositive() ? "text-primary" : "text-accent"}`}>{formatCurrency(d().networth)}</span>
                    </div>
                  </div>
                </BentoBlock>

                {/* Right: sparkline trend */}
                <BentoBlock class="col-span-1 md:col-span-7 flex flex-col min-h-[240px]">
                  <div class="flex items-center justify-between mb-4">
                    <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide">6-month trend</span>
                    <BarChart3 size={16} class="text-muted" />
                  </div>
                  <Show
                    when={!summary.loading && hasSpark()}
                    fallback={
                      <div class="flex-1 flex items-center justify-center">
                        <p class="text-muted text-sm">Not enough data for a trend yet.</p>
                      </div>
                    }
                  >
                    <div class="flex-1 flex items-end">
                      <Sparkline
                        values={sparkValues()}
                        height={160}
                        tone={isPositive() ? "primary" : "accent"}
                        class="w-full"
                      />
                    </div>
                  </Show>
                </BentoBlock>
              </>
            );
          }}
        </Show>

        {/* Snapshot history */}
        <BentoBlock class="col-span-1 md:col-span-12 p-0 overflow-hidden">
          <div class="flex items-center justify-between px-5 py-4 border-b border-border">
            <span class="text-[13px] font-body font-medium text-muted uppercase tracking-wide">Snapshot history</span>
            <Show when={snapshotting()}>
              <span class="text-xs text-muted">Saving…</span>
            </Show>
          </div>

          <Show when={snapshots.loading}>
            <div class="px-5 py-4 text-sm text-muted">Loading snapshots…</div>
          </Show>

          <Show when={!snapshots.loading && (snapshots() ?? []).length === 0}>
            <div class="px-5 py-10 flex flex-col items-center gap-2 text-center">
              <AlertTriangle size={20} class="text-muted" />
              <p class="text-sm text-muted">No snapshots yet. Tap the camera icon to take one.</p>
            </div>
          </Show>

          <Show when={(snapshots() ?? []).length > 0}>
            <div class="divide-y divide-border">
              <For each={snapshots() ?? []}>
                {(snap) => (
                  <div class="flex items-center justify-between px-5 py-3 group">
                    <div class="flex flex-col gap-0.5 min-w-0">
                      <span class="font-display font-semibold text-text">
                        {formatCurrency(snap.networth, snap.currency)}
                      </span>
                      <div class="flex items-center gap-3 text-xs text-muted">
                        <span>{formatSnapshotDate(snap.as_of)}</span>
                        <span class="text-surface-hover">|</span>
                        <span class="text-primary">↑ {formatCurrency(snap.total_assets, snap.currency)}</span>
                        <span class="text-accent">↓ {formatCurrency(snap.total_liabilities, snap.currency)}</span>
                      </div>
                      <Show when={snap.note}>
                        <span class="text-xs text-muted italic">{snap.note}</span>
                      </Show>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteSnapshot(snap.id)}
                      aria-label="Delete snapshot"
                      class="opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center rounded-lg bg-surface-hover text-muted hover:text-accent transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </BentoBlock>

      </div>
    </>
  );
}
