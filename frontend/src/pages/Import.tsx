import { For, Match, Show, Switch, createMemo, createResource, createSignal, onMount } from "solid-js";
import { A, useSearchParams } from "@solidjs/router";
import { Check, LoaderCircle, TriangleAlert, ArrowRight, RotateCcw } from "lucide-solid";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Button } from "../components/ui/button";
import { Eyebrow } from "../components/ui/eyebrow";
import { StepPills, type Step } from "../components/import/StepPills";
import { UploadStep } from "../components/import/UploadStep";
import { MapStep, type ImportAccount } from "../components/import/MapStep";
import { ReviewStep } from "../components/import/ReviewStep";
import { parseCsv, guessMapping, buildRows, toServerCsv, type Mapping } from "../components/import/csv";
import { api } from "../lib/api";
import { takeSharedFile } from "../lib/pwa";
import { cn } from "../lib/utils";

/** Response of POST /v1/import. */
interface ImportStats {
  imported: number;
  skipped: number;
  categorised: number;
  errors?: string[];
}

const MAX_BYTES = 32 << 20; // server multipart limit

export default function Import() {
  const [params, setParams] = useSearchParams();
  const [step, setStep] = createSignal<Step>(1);
  const [reachable, setReachable] = createSignal<Step>(1);
  const [fileName, setFileName] = createSignal("");
  const [headers, setHeaders] = createSignal<string[]>([]);
  const [data, setData] = createSignal<string[][]>([]);
  const [mapping, setMapping] = createSignal<Mapping | null>(null);
  const [reading, setReading] = createSignal(false);
  const [uploadError, setUploadError] = createSignal<string | null>(null);
  const [importing, setImporting] = createSignal(false);
  const [importError, setImportError] = createSignal<string | null>(null);
  const [result, setResult] = createSignal<ImportStats | null>(null);

  const [accounts] = createResource(() => api.get<ImportAccount[]>("/v1/accounts").catch(() => [] as ImportAccount[]));
  const [categories] = createResource(() => api.get<Array<{ name: string }>>("/v1/categories").catch(() => []));
  const accountNames = createMemo(() => new Set((accounts() ?? []).map((a) => a.name)));
  const categoryNames = createMemo(() => new Set((categories() ?? []).map((c) => c.name)));

  const rows = createMemo(() => {
    const m = mapping();
    return m && step() >= 3 ? buildRows(data(), m) : [];
  });
  const leftOut = () => rows().filter((r) => r.status === "invalid").length;
  const readyCount = () => rows().length - leftOut();

  const go = (s: Step) => {
    setStep(s);
    setReachable((r) => (s > r ? s : r));
  };

  const reset = () => {
    setStep(1); setReachable(1); setFileName(""); setHeaders([]); setData([]); setMapping(null);
    setResult(null); setImportError(null); setUploadError(null);
  };

  const loadFile = async (f: File) => {
    setUploadError(null);
    if (f.size > MAX_BYTES) { setUploadError("That file is over 32 MB. Split it and import the parts."); return; }
    setReading(true);
    try {
      const table = parseCsv(await f.text());
      if (table.length < 2) { setUploadError("The file needs a header row and at least one transaction."); return; }
      const [head, ...body] = table;
      const m = guessMapping(head!, body.slice(0, 50));
      // One account and no account column: the choice is obvious.
      const accts = accounts() ?? [];
      if (m.account < 0 && accts.length === 1) { m.fixedAccount = accts[0]!.name; m.fixedCurrency = accts[0]!.currency; }
      setFileName(f.name);
      setHeaders(head!);
      setData(body);
      setMapping(m);
      setReachable(2);
      go(2);
    } catch {
      setUploadError("This file could not be read as text. Export the statement as CSV and try again.");
    } finally {
      setReading(false);
    }
  };

  // PWA share target: sw.js stores the shared CSV and redirects here with ?shared=1.
  onMount(async () => {
    if (params.shared !== "1") return;
    setParams({ shared: undefined }, { replace: true });
    const f = await takeSharedFile();
    if (f) await loadFile(f);
  });

  const runImport = async () => {
    setImportError(null);
    setImporting(true);
    try {
      const form = new FormData();
      form.append("file", new File([toServerCsv(rows())], fileName().replace(/\.[^.]+$/, "") + ".ledgerify.csv", { type: "text/csv" }));
      const stats = await api.upload<ImportStats>("/v1/import", form);
      // The server numbers rows in the cleaned file; point them back at the user's statement.
      const ready = rows().filter((r) => r.status === "ready");
      stats.errors = (stats.errors ?? []).map((e) =>
        e.replace(/^row (\d+):/, (m, n) => { const src = ready[Number(n) - 2]; return src ? `line ${src.line}:` : m; }));
      setResult(stats);
      setReachable(4);
      setStep(4);
    } catch (e: unknown) {
      setImportError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const tabs = (
    <div class="flex p-[3px] rounded-[9px] bg-sunken" role="navigation" aria-label="Import or export">
      <span class="px-3 h-7 inline-flex items-center rounded-[7px] bg-raised text-[12.5px] font-semibold text-text" aria-current="page">Import</span>
      <A href="/export" class="px-3 h-7 inline-flex items-center rounded-[7px] text-[12.5px] font-medium text-muted hover:text-text transition-colors duration-[160ms]">Export</A>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Import"
        actions={
          <div class="flex items-center gap-3">
            <StepPills class="hidden md:flex" step={step()} reachable={result() ? 4 : reachable()} onSelect={(s) => !result() && !importing() && setStep(s)} />
            {tabs}
          </div>
        }
      />

      <div class="px-5 md:px-7 py-5 md:py-6 flex flex-col gap-4">
        <StepPills class="md:hidden -mx-1 overflow-x-auto scrollbar-none" step={step()} reachable={result() ? 4 : reachable()} onSelect={(s) => !result() && !importing() && setStep(s)} />

        {/* Steps change with the page transition timing: 220ms fade + rise. */}
        <Show when={step()} keyed>
        {(current) => (
        <div class="animate-page-in motion-reduce:animate-[fade-in_120ms_linear]" role="region" aria-label={`Step ${current} of 4`}>
          <Switch>
            <Match when={step() === 1}>
              <UploadStep onFile={loadFile} error={uploadError()} loading={reading()} />
            </Match>

            <Match when={step() === 2 && mapping()}>
              {(m) => (
                <MapStep
                  fileName={fileName()}
                  headers={headers()}
                  data={data()}
                  mapping={m()}
                  onChange={(patch) => setMapping((prev) => (prev ? { ...prev, ...patch } : prev))}
                  accounts={accounts() ?? []}
                  onBack={() => setStep(1)}
                  onNext={() => go(3)}
                />
              )}
            </Match>

            <Match when={step() === 3 && importing()}>
              <ImportProgress fileName={fileName()} rows={readyCount()} />
            </Match>

            <Match when={step() === 3}>
              <div class="flex flex-col gap-3">
                <Show when={importError()}>
                  <p role="alert" class="flex items-start gap-2 rounded-[14px] border border-dashed border-border-strong bg-surface px-4 py-3 text-[13.5px] text-neg">
                    <TriangleAlert size={16} class="shrink-0 mt-0.5" />
                    <span>Nothing was saved. {importError()}</span>
                  </p>
                </Show>
                <ReviewStep
                  rows={rows()}
                  categoryNames={categoryNames()}
                  accountNames={accountNames()}
                  onBack={() => setStep(2)}
                  onImport={runImport}
                />
              </div>
            </Match>

            <Match when={step() === 4 && result()}>
              {(r) => <DoneStep stats={r()} leftOut={leftOut()} onAgain={reset} />}
            </Match>
          </Switch>
        </div>
        )}
        </Show>
      </div>
    </>
  );
}

/** Mobile "reading" view while the single import request runs. */
function ImportProgress(props: { fileName: string; rows: number }) {
  const item = (state: "done" | "run", label: string, sub?: string) => (
    <li class="flex items-center gap-3 h-12">
      <span class={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0", state === "done" ? "bg-signal-soft text-signal" : "bg-raised text-text")} aria-hidden="true">
        {state === "done" ? <Check size={14} /> : <LoaderCircle size={15} class="animate-spin motion-reduce:animate-none" />}
      </span>
      <div class="min-w-0">
        <div class={cn("text-[14px] font-medium", state === "done" ? "text-muted" : "text-text")}>{label}</div>
        <Show when={sub}><div class="text-[12px] text-muted">{sub}</div></Show>
      </div>
    </li>
  );
  return (
    <BentoBlock class="max-w-[520px] mx-auto w-full flex flex-col gap-4" role="status">
      <Eyebrow>Importing</Eyebrow>
      <p class="font-mono text-[13px] text-muted truncate">{props.fileName}</p>
      <ul class="flex flex-col">
        {item("done", "Read the file")}
        {item("done", "Checked every row", `${props.rows} ready to save`)}
        {item("run", "Saving and categorising", "Keyword rules first, then AI. This can take a minute.")}
      </ul>
    </BentoBlock>
  );
}

function DoneStep(props: { stats: ImportStats; leftOut: number; onAgain: () => void }) {
  const errors = () => props.stats.errors ?? [];
  const tile = (label: string, value: number, tone = "text-text") => (
    <div class="flex flex-col gap-1.5">
      <span class="font-mono font-medium text-[11px] uppercase tracking-[0.1em] text-muted">{label}</span>
      <span class={cn("font-mono tabular text-[30px] leading-none tracking-[-0.03em]", tone)}>{value}</span>
    </div>
  );
  return (
    <div class="max-w-[720px] mx-auto w-full flex flex-col items-center text-center gap-6 py-6 md:py-10">
      <div class="w-14 h-14 rounded-[16px] bg-signal-soft text-signal flex items-center justify-center" aria-hidden="true"><Check size={26} /></div>
      <h2 class="font-display text-[40px] md:text-[44px] leading-[1.05] text-text text-balance">
        {props.stats.imported > 0 ? `${props.stats.imported} transaction${props.stats.imported === 1 ? "" : "s"} added` : "Nothing was added"}
      </h2>
      <BentoBlock class="w-full grid grid-cols-2 md:grid-cols-4 gap-5 text-left">
        {tile("Added", props.stats.imported)}
        {tile("Auto-categorised", props.stats.categorised, "text-signal")}
        {tile("Skipped", props.stats.skipped, props.stats.skipped ? "text-warn" : "text-text")}
        {tile("Left out", props.leftOut, props.leftOut ? "text-warn" : "text-text")}
      </BentoBlock>
      <Show when={errors().length > 0}>
        <BentoBlock class="w-full text-left flex flex-col gap-2">
          <Eyebrow class="text-warn">{errors().length} row{errors().length === 1 ? "" : "s"} failed</Eyebrow>
          <ul class="flex flex-col gap-1 max-h-48 overflow-y-auto font-mono text-[12px] text-muted">
            <For each={errors()}>{(e) => <li>{e}</li>}</For>
          </ul>
        </BentoBlock>
      </Show>
      <div class="flex flex-wrap justify-center gap-2">
        <A href="/activity" class="inline-flex items-center gap-2 h-10 px-4 rounded-button bg-btn text-btn-text text-[13.5px] font-semibold hover:opacity-90 active:scale-[0.97] transition-[opacity,transform] duration-[90ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-bg">
          View in Activity <ArrowRight size={16} />
        </A>
        <Button variant="outline" onClick={props.onAgain}><RotateCcw size={15} /> Import another</Button>
      </div>
    </div>
  );
}
