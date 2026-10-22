import { For, Show, createMemo, createSignal, type Component } from "solid-js";
import { TriangleAlert, Sparkles, Check } from "lucide-solid";
import { BentoBlock } from "../ui/bento-block";
import { Eyebrow } from "../ui/eyebrow";
import { Button } from "../ui/button";
import { Money } from "../ui/money";
import { cn } from "../../lib/utils";
import { formatDate } from "../../lib/format";
import type { ReviewRow } from "./csv";

type Filter = "all" | "ready" | "invalid";
const PAGE = 200;

type ReviewStepProps = {
  rows: ReviewRow[];
  /** Exact category names the server will match. */
  categoryNames: Set<string>;
  /** Exact account names that already exist. */
  accountNames: Set<string>;
  onBack: () => void;
  onImport: () => void;
};

/** Where a row's category will come from once imported. */
function categorySource(r: ReviewRow, names: Set<string>): { label: string; tone: "match" | "ai" | "nomatch" } {
  if (r.category && names.has(r.category)) return { label: r.category, tone: "match" };
  if (r.category) return { label: `“${r.category}” no match · rules + AI`, tone: "nomatch" };
  return { label: "Rules + AI", tone: "ai" };
}

const SourceChip: Component<{ row: ReviewRow; names: Set<string> }> = (props) => {
  const s = () => categorySource(props.row, props.names);
  return (
    <span class={cn("inline-flex items-center gap-1 max-w-full h-6 px-2 rounded-pill text-[12px] font-medium truncate",
      s().tone === "match" ? "bg-raised text-text" : s().tone === "ai" ? "bg-signal-soft text-signal" : "bg-raised text-warn")}>
      <Show when={s().tone === "ai"}><Sparkles size={11} class="shrink-0" /></Show>
      <Show when={s().tone === "match"}><Check size={11} class="shrink-0 text-muted" /></Show>
      <span class="truncate">{s().label}</span>
    </span>
  );
};

const Amount: Component<{ row: ReviewRow }> = (props) => (
  <span class={cn("font-mono tabular text-[14px] whitespace-nowrap", props.row.type === "income" ? "text-pos" : props.row.type === "expense" ? "text-text" : "text-muted")}>
    {props.row.type === "income" ? "+" : props.row.type === "expense" ? "−" : ""}
    <Money value={props.row.amount} currency={props.row.currency || "INR"} tone={props.row.type === "income" ? "pos" : props.row.type === "expense" ? "text" : "muted"} digits={2} />
  </span>
);

/** Step 3: every row as it will be saved, with what the server would reject called out. */
export const ReviewStep: Component<ReviewStepProps> = (props) => {
  const [filter, setFilter] = createSignal<Filter>("all");
  const [limit, setLimit] = createSignal(PAGE);

  const ready = createMemo(() => props.rows.filter((r) => r.status === "ready"));
  const invalid = createMemo(() => props.rows.filter((r) => r.status === "invalid"));
  const visible = createMemo(() => (filter() === "ready" ? ready() : filter() === "invalid" ? invalid() : props.rows));
  const matched = () => ready().filter((r) => r.category && props.categoryNames.has(r.category)).length;
  const newAccounts = createMemo(() => [...new Set(ready().map((r) => r.account))].filter((a) => !props.accountNames.has(a)));
  const totals = createMemo(() => {
    let inn = 0, out = 0;
    for (const r of ready()) { if (r.type === "income") inn += r.amount; else if (r.type === "expense") out += r.amount; }
    return { inn, out };
  });

  const chip = (value: Filter, label: string, count: number, warn = false) => (
    <button
      type="button"
      onClick={() => { setFilter(value); setLimit(PAGE); }}
      aria-pressed={filter() === value}
      class={cn("inline-flex items-center gap-2 h-8 px-3 rounded-pill text-[13px] font-medium transition-colors duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal",
        filter() === value ? "bg-text text-bg" : "bg-surface text-muted hover:text-text border border-border")}
    >
      {label}
      <span class={cn("font-mono text-[11.5px] tabular", warn && count > 0 && filter() !== value && "text-warn")}>{count}</span>
    </button>
  );

  return (
    <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4">
      <div class="flex flex-col gap-3 min-w-0">
        <div class="flex flex-wrap gap-2" role="group" aria-label="Filter rows">
          {chip("all", "All", props.rows.length)}
          {chip("ready", "Ready", ready().length)}
          {chip("invalid", "Needs attention", invalid().length, true)}
        </div>

        <BentoBlock class="p-0 overflow-hidden">
          <Show when={visible().length > 0} fallback={<p class="px-5 py-12 text-center text-[14px] text-muted">No rows here.</p>}>
            {/* Desktop table */}
            <table class="hidden md:table w-full text-left table-fixed">
              <caption class="sr-only">Rows to import</caption>
              <thead>
                <tr class="border-b border-border font-mono font-medium text-[11px] uppercase tracking-[0.1em] text-faint">
                  <th scope="col" class="w-[64px] px-5 py-2.5 font-medium">Line</th>
                  <th scope="col" class="w-[72px] py-2.5 font-medium">Date</th>
                  <th scope="col" class="py-2.5 font-medium">Description</th>
                  <th scope="col" class="w-[34%] py-2.5 font-medium">Category</th>
                  <th scope="col" class="w-[130px] px-5 py-2.5 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                <For each={visible().slice(0, limit())}>
                  {(r) => (
                    <tr class="border-b border-border last:border-0 h-11 hover:bg-raised transition-colors duration-[160ms]">
                      <td class="px-5 font-mono text-[12px] text-faint tabular">{r.line}</td>
                      <td class="font-mono text-[12.5px] text-muted tabular">{r.date ? formatDate(r.date) : "—"}</td>
                      <td class="pr-3">
                        <div class="text-[14px] text-text truncate">{r.title || <span class="text-faint">—</span>}</div>
                        <Show when={!props.accountNames.has(r.account) && r.account}>
                          <div class="text-[11.5px] text-muted truncate">{r.account}</div>
                        </Show>
                      </td>
                      <td class="pr-3">
                        <Show when={r.status === "ready"} fallback={
                          <span class="flex items-center gap-1.5 text-[12.5px] text-warn truncate"><TriangleAlert size={13} class="shrink-0" />{r.problem}</span>
                        }>
                          <SourceChip row={r} names={props.categoryNames} />
                        </Show>
                      </td>
                      <td class="px-5 text-right">
                        <Show when={r.status === "ready"} fallback={<span class="text-faint">—</span>}><Amount row={r} /></Show>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>

            {/* Mobile list */}
            <ul class="md:hidden divide-y divide-border">
              <For each={visible().slice(0, limit())}>
                {(r) => (
                  <li class="px-4 py-3 flex flex-col gap-1.5">
                    <div class="flex items-baseline gap-3">
                      <span class="flex-1 min-w-0 text-[14.5px] font-medium text-text truncate">{r.title || "—"}</span>
                      <Show when={r.status === "ready"}><Amount row={r} /></Show>
                    </div>
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="font-mono text-[12px] text-muted tabular shrink-0">{r.date ? formatDate(r.date) : `Line ${r.line}`}</span>
                      <Show when={r.status === "ready"} fallback={<span class="text-[12.5px] text-warn truncate">{r.problem}</span>}>
                        <SourceChip row={r} names={props.categoryNames} />
                      </Show>
                    </div>
                  </li>
                )}
              </For>
            </ul>

            <Show when={visible().length > limit()}>
              <div class="flex items-center justify-between gap-3 px-5 py-3 border-t border-border">
                <span class="text-[12.5px] text-muted">Showing <span class="font-mono tabular">{limit()}</span> of <span class="font-mono tabular">{visible().length}</span></span>
                <Button size="sm" variant="ghost" onClick={() => setLimit((l) => l + PAGE)}>Show more</Button>
              </div>
            </Show>
          </Show>
        </BentoBlock>
      </div>

      <div class="flex flex-col gap-4">
        <BentoBlock class="flex flex-col gap-4">
          <Eyebrow>Summary</Eyebrow>
          <dl class="grid grid-cols-2 gap-x-3 gap-y-4">
            <div><dt class="text-[12px] text-muted">Ready</dt><dd class="font-mono tabular text-[21px] text-text mt-1">{ready().length}</dd></div>
            <div><dt class="text-[12px] text-muted">Left out</dt><dd class={cn("font-mono tabular text-[21px] mt-1", invalid().length ? "text-warn" : "text-text")}>{invalid().length}</dd></div>
            <div><dt class="text-[12px] text-muted">Money in</dt><dd class="mt-1"><Money value={totals().inn} tone="pos" class="text-[15px]" /></dd></div>
            <div><dt class="text-[12px] text-muted">Money out</dt><dd class="mt-1"><Money value={totals().out} class="text-[15px]" /></dd></div>
          </dl>
          <Show when={newAccounts().length > 0}>
            <p class="flex items-start gap-2 text-[12.5px] text-warn">
              <TriangleAlert size={14} class="shrink-0 mt-0.5" />
              <span>Creates {newAccounts().length === 1 ? "a new bank account" : `${newAccounts().length} new bank accounts`}: {newAccounts().slice(0, 4).join(", ")}{newAccounts().length > 4 ? "…" : ""}</span>
            </p>
          </Show>
        </BentoBlock>

        <BentoBlock class="flex flex-col gap-2.5">
          <Eyebrow>How categories are set</Eyebrow>
          <p class="text-[13px] leading-relaxed text-muted">
            <span class="font-mono tabular text-text">{matched()}</span> rows name one of your categories and keep it.
            The other <span class="font-mono tabular text-text">{ready().length - matched()}</span> go through your keyword rules first, then AI, as soon as they are saved.
          </p>
          <p class="text-[12.5px] leading-relaxed text-faint">Duplicates are not detected. Check the date range before importing a statement twice.</p>
        </BentoBlock>

        <div class="grid grid-cols-[auto_1fr] gap-2">
          <Button variant="outline" onClick={props.onBack}>Back</Button>
          <Button onClick={props.onImport} disabled={ready().length === 0}>
            Import <span class="font-mono tabular">{ready().length}</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
