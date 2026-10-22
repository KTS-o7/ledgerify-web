import { For, Show, createSignal } from "solid-js";
import { A } from "@solidjs/router";
import { Download, Share2, Check } from "lucide-solid";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Button } from "../components/ui/button";
import { Eyebrow } from "../components/ui/eyebrow";
import { Input } from "../components/ui/input";
import { SegmentedControl } from "../components/ui/segmented-control";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

type Preset = "1m" | "3m" | "ytd" | "all" | "custom";

/** Columns GET /v1/export understands, in its column order. */
const FIELDS = [
  { key: "date", label: "Date" },
  { key: "title", label: "Description" },
  { key: "amount", label: "Amount" },
  { key: "type", label: "Type" },
  { key: "category", label: "Category" },
  { key: "account", label: "Account" },
  { key: "currency", label: "Currency" },
  { key: "note", label: "Note" },
  { key: "tags", label: "Tags" },
];

/** Columns the importer needs to read the file back. */
const ROUND_TRIP = ["date", "title", "amount", "type", "account"];

const fmt = (d: Date) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

function presetDates(preset: Exclude<Preset, "custom">): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (preset === "1m") from.setMonth(from.getMonth() - 1);
  else if (preset === "3m") from.setMonth(from.getMonth() - 3);
  else if (preset === "ytd") from.setMonth(0, 1);
  else from.setFullYear(2000, 0, 1);
  return { from: fmt(from), to: fmt(to) };
}

const PRESETS: { value: Preset; label: string }[] = [
  { value: "1m", label: "1M" },
  { value: "3m", label: "3M" },
  { value: "ytd", label: "YTD" },
  { value: "all", label: "All" },
  { value: "custom", label: "Custom" },
];

type NavigatorShare = Navigator & { canShare?: (d: { files: File[] }) => boolean };

export default function Export() {
  const initial = presetDates("3m");
  const [preset, setPreset] = createSignal<Preset>("3m");
  const [fromDate, setFromDate] = createSignal(initial.from);
  const [toDate, setToDate] = createSignal(initial.to);
  const [selected, setSelected] = createSignal<Set<string>>(new Set(["date", "title", "amount", "type", "category", "account"]));
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [done, setDone] = createSignal<string | null>(null);

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p === "custom") return;
    const d = presetDates(p);
    setFromDate(d.from);
    setToDate(d.to);
  };

  const toggle = (key: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const fileName = () => `ledgerify_${fromDate()}_${toDate()}.csv`;
  const rangeInvalid = () => !fromDate() || !toDate() || fromDate() > toDate();
  const roundTrip = () => ROUND_TRIP.every((k) => selected().has(k));

  const fetchFile = async (): Promise<File> => {
    // Keep the server's column order regardless of click order.
    const fields = FIELDS.map((f) => f.key).filter((k) => selected().has(k)).join(",");
    const blob = await api.download(`/v1/export?from_date=${fromDate()}&to_date=${toDate()}&fields=${encodeURIComponent(fields)}`);
    return new File([blob], fileName(), { type: "text/csv" });
  };

  const save = (file: File) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const canShareFiles = () => {
    const n = navigator as NavigatorShare;
    try {
      return typeof n.share === "function" && !!n.canShare?.({ files: [new File([""], "x.csv", { type: "text/csv" })] });
    } catch {
      return false;
    }
  };

  const run = async (mode: "download" | "share") => {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const file = await fetchFile();
      const n = navigator as NavigatorShare;
      if (mode === "share" && n.canShare?.({ files: [file] })) {
        try {
          await n.share({ files: [file], title: "Ledgerify export" });
          setDone("Shared");
        } catch (e) {
          // The user closed the share sheet: not an error.
          if ((e as DOMException)?.name !== "AbortError") { save(file); setDone("Saved to downloads"); }
        }
      } else {
        save(file);
        setDone("Saved to downloads");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Export"
        actions={
          <div class="flex p-[3px] rounded-[9px] bg-sunken" role="navigation" aria-label="Import or export">
            <A href="/import" class="px-3 h-7 inline-flex items-center rounded-[7px] text-[12.5px] font-medium text-muted hover:text-text transition-colors duration-[160ms]">Import</A>
            <span class="px-3 h-7 inline-flex items-center rounded-[7px] bg-raised text-[12.5px] font-semibold text-text" aria-current="page">Export</span>
          </div>
        }
      />
      <div class="px-5 md:px-7 py-5 md:py-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4">
        <BentoBlock class="flex flex-col gap-6">
          <section class="flex flex-col gap-3" aria-labelledby="export-range">
            <Eyebrow as="h2" class="block" >
              <span id="export-range">Date range</span>
            </Eyebrow>
            <SegmentedControl ariaLabel="Date range" options={PRESETS} value={preset()} onChange={applyPreset} />
            <div class="grid grid-cols-2 gap-2">
              <label class="flex flex-col gap-1.5">
                <span class="text-[12px] text-muted">From</span>
                <Input type="date" value={fromDate()} max={toDate()} class="font-mono tabular text-[14px] h-10"
                  onInput={(e) => { setFromDate(e.currentTarget.value); setPreset("custom"); }} />
              </label>
              <label class="flex flex-col gap-1.5">
                <span class="text-[12px] text-muted">To</span>
                <Input type="date" value={toDate()} min={fromDate()} class="font-mono tabular text-[14px] h-10"
                  onInput={(e) => { setToDate(e.currentTarget.value); setPreset("custom"); }} />
              </label>
            </div>
            <Show when={rangeInvalid()}>
              <p class="text-[12.5px] text-warn" role="status">The start date must be on or before the end date.</p>
            </Show>
          </section>

          <section class="flex flex-col gap-3" aria-labelledby="export-fields">
            <div class="flex items-baseline justify-between">
              <Eyebrow as="h2"><span id="export-fields">Fields</span></Eyebrow>
              <span class="font-mono text-[12px] text-muted tabular">{selected().size} of {FIELDS.length}</span>
            </div>
            <ul class="flex flex-wrap gap-2">
              <For each={FIELDS}>
                {(f) => {
                  const on = () => selected().has(f.key);
                  return (
                    <li>
                      <button
                        type="button"
                        aria-pressed={on()}
                        onClick={() => toggle(f.key)}
                        class={cn(
                          "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-pill text-[13.5px] font-medium border transition-colors duration-[160ms] ease-[var(--ease-standard)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal",
                          on() ? "bg-signal-soft border-transparent text-text" : "bg-transparent border-border-strong text-muted hover:text-text",
                        )}
                      >
                        <Show when={on()}><Check size={13} class="text-signal" /></Show>
                        {f.label}
                      </button>
                    </li>
                  );
                }}
              </For>
            </ul>
            <Show when={!roundTrip()}>
              <p class="text-[12.5px] text-muted">Keep Date, Description, Amount, Type and Account to import this file back later.</p>
            </Show>
          </section>

          <section class="flex flex-col gap-3" aria-labelledby="export-format">
            <Eyebrow as="h2"><span id="export-format">Format</span></Eyebrow>
            <div class="flex items-center gap-3 rounded-[12px] border border-border-strong px-4 h-12">
              <span class="font-mono text-[13px] text-text">CSV</span>
              <span class="text-[12.5px] text-muted">Opens in Excel, Google Sheets and Numbers</span>
            </div>
          </section>

          <div class="flex flex-col gap-2">
            <Show when={error()}><p role="alert" class="text-[13px] text-neg">{error()}</p></Show>
            <Show when={done()}><p role="status" class="text-[13px] text-pos flex items-center gap-1.5"><Check size={14} />{done()}</p></Show>
            <div class={cn("grid gap-2", canShareFiles() ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
              <Show when={canShareFiles()}>
                <Button size="lg" disabled={selected().size === 0 || rangeInvalid() || busy()} onClick={() => run("share")}>
                  <Share2 size={17} />
                  {busy() ? "Preparing…" : "Export & share"}
                </Button>
              </Show>
              <Button size="lg" variant={canShareFiles() ? "outline" : "default"} disabled={selected().size === 0 || rangeInvalid() || busy()} onClick={() => run("download")}>
                <Download size={17} />
                {busy() && !canShareFiles() ? "Preparing…" : "Download CSV"}
              </Button>
            </div>
          </div>
        </BentoBlock>

        <div class="flex flex-col gap-4">
          <BentoBlock class="flex flex-col gap-3">
            <Eyebrow>File</Eyebrow>
            <p class="font-mono text-[13px] text-text break-all">{fileName()}</p>
            <p class="text-[13px] leading-relaxed text-muted">One row per transaction, in the date range above. Amounts are positive; the Type column says whether money came in or went out.</p>
          </BentoBlock>
          <BentoBlock class="flex flex-col gap-3">
            <Eyebrow>Moving to another device?</Eyebrow>
            <p class="text-[13px] leading-relaxed text-muted">
              Export with the default fields, then use <A href="/import" class="font-medium">Import</A> on the other account. The columns map themselves.
            </p>
          </BentoBlock>
        </div>
      </div>
    </>
  );
}
