import { For, Show, createMemo, createUniqueId, type Component } from "solid-js";
import { ArrowRight, TriangleAlert } from "lucide-solid";
import { BentoBlock } from "../ui/bento-block";
import { Eyebrow } from "../ui/eyebrow";
import { Select } from "../ui/select";
import { Button } from "../ui/button";
import { SegmentedControl } from "../ui/segmented-control";
import { cn } from "../../lib/utils";
import { DATE_FORMATS, missingFields, parseDate, type AmountMode, type DateFormat, type MappedField, type Mapping } from "./csv";

export interface ImportAccount { id: string; name: string; currency: string }

type MapStepProps = {
  fileName: string;
  headers: string[];
  data: string[][];
  mapping: Mapping;
  onChange: (patch: Partial<Mapping>) => void;
  accounts: ImportAccount[];
  onBack: () => void;
  onNext: () => void;
};

type FieldRow = { key: MappedField; label: string; required: boolean; hint?: string };

const AMOUNT_MODES: { value: AmountMode; label: string }[] = [
  { value: "amount-type", label: "Amount + type" },
  { value: "signed", label: "Signed amount" },
  { value: "debit-credit", label: "Debit & credit" },
];

/** Step 2: match the file's columns to Ledgerify fields. Runs in the browser; nothing is saved. */
export const MapStep: Component<MapStepProps> = (props) => {
  const uid = createUniqueId();

  const fields = createMemo<FieldRow[]>(() => {
    const mode = props.mapping.amountMode;
    const rows: FieldRow[] = [
      { key: "date", label: "Date", required: true },
      { key: "title", label: "Description", required: true },
    ];
    if (mode === "debit-credit") {
      rows.push({ key: "debit", label: "Debit (money out)", required: true }, { key: "credit", label: "Credit (money in)", required: true });
    } else {
      rows.push({ key: "amount", label: "Amount", required: true, hint: mode === "signed" ? "Negative = expense" : undefined });
      if (mode === "amount-type") rows.push({ key: "type", label: "Type", required: true, hint: "income / expense / transfer, or DR / CR" });
    }
    rows.push(
      { key: "account", label: "Account", required: false, hint: "Or pick one account on the right" },
      { key: "category", label: "Category", required: false },
      { key: "currency", label: "Currency", required: false },
      { key: "note", label: "Note", required: false },
    );
    return rows;
  });

  const sample = (col: number) => {
    if (col < 0) return "";
    for (const r of props.data.slice(0, 20)) { const v = (r[col] ?? "").trim(); if (v) return v; }
    return "";
  };

  const missing = () => missingFields(props.mapping);
  const dateSample = () => sample(props.mapping.date);
  const datePreview = () => (dateSample() ? parseDate(dateSample(), props.mapping.dateFormat) : null);

  const pickAccount = (name: string) => {
    const acct = props.accounts.find((a) => a.name === name);
    props.onChange({ fixedAccount: name, fixedCurrency: acct?.currency ?? props.mapping.fixedCurrency });
  };

  return (
    <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4">
      <BentoBlock class="p-0 overflow-hidden">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-5 pt-5 pb-4">
          <div class="min-w-0">
            <Eyebrow>Columns</Eyebrow>
            <p class="text-[13.5px] text-muted mt-1.5 truncate">
              <span class="font-mono text-text">{props.fileName}</span> · <span class="font-mono tabular">{props.data.length}</span> rows · <span class="font-mono tabular">{props.headers.length}</span> columns
            </p>
          </div>
          <SegmentedControl
            size="sm"
            class="sm:w-[330px]"
            ariaLabel="How amounts are stored"
            options={AMOUNT_MODES}
            value={props.mapping.amountMode}
            onChange={(v) => props.onChange({ amountMode: v })}
          />
        </div>

        {/* Header row (desktop) */}
        <div class="hidden md:grid grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)] gap-4 px-5 py-2 border-y border-border font-mono font-medium text-[11px] uppercase tracking-[0.1em] text-faint" aria-hidden="true">
          <span>Ledgerify field</span><span>Column in your file</span><span>Sample</span>
        </div>
        <ul class="divide-y divide-border">
          <For each={fields()}>
            {(f) => {
              const id = `${uid}-${f.key}`;
              const col = () => props.mapping[f.key];
              const unmapped = () => f.required && col() < 0;
              return (
                <li class="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)] gap-x-4 gap-y-1.5 px-5 py-3 md:items-center">
                  <label for={id} class="text-[14px] font-medium text-text">
                    {f.label}
                    <Show when={f.required}><span class="text-muted font-normal"> · required</span></Show>
                    <Show when={f.hint}><span class="block text-[12px] font-normal text-muted mt-0.5">{f.hint}</span></Show>
                  </label>
                  <Select
                    id={id}
                    value={String(col())}
                    onChange={(e) => props.onChange({ [f.key]: Number(e.currentTarget.value) } as Partial<Mapping>)}
                    aria-invalid={unmapped() || undefined}
                    class={cn("h-10 text-[14px]", unmapped() && "border-warn")}
                  >
                    <option value="-1">{f.required ? "Choose a column…" : "— Not in file —"}</option>
                    <For each={props.headers}>{(h, i) => <option value={String(i())}>{h || `Column ${i() + 1}`}</option>}</For>
                  </Select>
                  <span class="font-mono text-[12.5px] text-muted truncate tabular" title={sample(col())}>
                    {sample(col()) || <span class="text-faint">—</span>}
                  </span>
                </li>
              );
            }}
          </For>
        </ul>
      </BentoBlock>

      <div class="flex flex-col gap-4">
        <BentoBlock class="flex flex-col gap-3">
          <Eyebrow>Date format</Eyebrow>
          <Select
            aria-label="Date format"
            value={props.mapping.dateFormat}
            onChange={(e) => props.onChange({ dateFormat: e.currentTarget.value as DateFormat })}
            class="h-10 font-mono text-[14px]"
          >
            <For each={DATE_FORMATS}>{(f) => <option value={f}>{f}</option>}</For>
          </Select>
          <Show when={dateSample()}>
            <p class="text-[12.5px] text-muted">
              <span class="font-mono tabular">{dateSample()}</span>
              {" → "}
              <Show when={datePreview()} fallback={<span class="text-warn">does not match this format</span>}>
                <span class="font-mono tabular text-text">{datePreview()}</span>
              </Show>
            </p>
          </Show>
        </BentoBlock>

        <Show when={props.mapping.account < 0}>
          <BentoBlock class="flex flex-col gap-3">
            <Eyebrow>Target account</Eyebrow>
            <Select
              aria-label="Target account"
              value={props.mapping.fixedAccount}
              onChange={(e) => pickAccount(e.currentTarget.value)}
              class={cn("h-10 text-[14px]", !props.mapping.fixedAccount && "border-warn")}
            >
              <option value="">Choose an account…</option>
              <For each={props.accounts}>{(a) => <option value={a.name}>{a.name} · {a.currency}</option>}</For>
            </Select>
            <p class="text-[12.5px] text-muted">Every row is added to this account.</p>
          </BentoBlock>
        </Show>

        <Show when={props.mapping.currency < 0}>
          <BentoBlock class="flex flex-col gap-3">
            <Eyebrow>Currency</Eyebrow>
            <Select
              aria-label="Currency for every row"
              value={props.mapping.fixedCurrency}
              onChange={(e) => props.onChange({ fixedCurrency: e.currentTarget.value })}
              class="h-10 font-mono text-[14px]"
            >
              <option value="">INR (default)</option>
              <For each={[...new Set(["INR", "USD", "EUR", "GBP", ...props.accounts.map((a) => a.currency)])].filter((c) => c !== "INR")}>
                {(c) => <option value={c}>{c}</option>}
              </For>
            </Select>
          </BentoBlock>
        </Show>

        <div class="flex flex-col gap-2">
          <Show when={missing().length > 0}>
            <p class="flex items-start gap-2 text-[13px] text-warn" role="status">
              <TriangleAlert size={15} class="shrink-0 mt-0.5" />
              <span>Still needed: {missing().join(", ")}.</span>
            </p>
          </Show>
          <div class="grid grid-cols-[auto_1fr] gap-2">
            <Button variant="outline" onClick={props.onBack}>Back</Button>
            <Button onClick={props.onNext} disabled={missing().length > 0}>
              Review rows <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
