import { Show, createSignal, type Component } from "solid-js";
import { FileUp, ClipboardPaste, FileText } from "lucide-solid";
import { Button } from "../ui/button";
import { Eyebrow } from "../ui/eyebrow";
import { BentoBlock } from "../ui/bento-block";
import { cn } from "../../lib/utils";

type UploadStepProps = {
  onFile: (f: File) => void;
  error: string | null;
  loading: boolean;
};

const canPaste = () => typeof navigator !== "undefined" && !!navigator.clipboard?.readText;

/** Step 1: drop zone, Choose file, Paste from clipboard, and the expected format. */
export const UploadStep: Component<UploadStepProps> = (props) => {
  const [over, setOver] = createSignal(false);
  const [pasteError, setPasteError] = createSignal<string | null>(null);
  let input: HTMLInputElement | undefined;

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) props.onFile(f);
  };

  const paste = async () => {
    setPasteError(null);
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) { setPasteError("The clipboard is empty."); return; }
      props.onFile(new File([text], "clipboard.csv", { type: "text/csv" }));
    } catch {
      setPasteError("Clipboard access was blocked. Choose a file instead.");
    }
  };

  return (
    <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4">
      <div
        role="group"
        aria-label="Statement upload"
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        class={cn(
          "flex flex-col items-center justify-center gap-4 text-center rounded-[20px] border-[1.5px] border-dashed bg-surface px-6 py-12 md:py-20 transition-colors duration-[160ms] ease-[var(--ease-standard)] hover:border-signal",
          over() ? "border-signal bg-signal-soft" : "border-border-strong",
        )}
      >
        <div class="w-16 h-16 rounded-[18px] bg-signal-soft text-signal flex items-center justify-center" aria-hidden="true">
          <FileUp size={28} />
        </div>
        <h2 class="font-display text-[34px] leading-none text-text">Drop a statement here</h2>
        <p class="text-[15px] leading-relaxed text-muted max-w-[420px] text-pretty">
          CSV from any bank or card. You map the columns and check every row before anything is saved.
        </p>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          class="sr-only"
          aria-label="Choose CSV file"
          onChange={(e) => { const f = e.currentTarget.files?.[0]; if (f) props.onFile(f); e.currentTarget.value = ""; }}
        />
        <div class="flex flex-wrap justify-center gap-2 mt-1">
          <Button onClick={() => input?.click()} disabled={props.loading}>
            <FileText size={16} />
            {props.loading ? "Reading…" : "Choose file"}
          </Button>
          <Show when={canPaste()}>
            <Button variant="outline" onClick={paste} disabled={props.loading}>
              <ClipboardPaste size={16} />
              Paste from clipboard
            </Button>
          </Show>
        </div>
        <Show when={props.error ?? pasteError()}>
          {(msg) => <p role="alert" class="text-[13.5px] text-neg">{msg()}</p>}
        </Show>
      </div>

      <div class="flex flex-col gap-4">
        <BentoBlock class="flex flex-col gap-3">
          <Eyebrow>What works</Eyebrow>
          <ul class="flex flex-col gap-2 text-[13.5px] leading-relaxed text-muted">
            <li>Any column names. You match them to Ledgerify fields in the next step.</li>
            <li>One amount column with a type, a signed amount, or separate debit and credit columns.</li>
            <li>Dates like <span class="font-mono text-text tabular">2026-09-05</span>, <span class="font-mono text-text tabular">05/09/2026</span> or <span class="font-mono text-text tabular">05-Sep-2026</span>.</li>
          </ul>
        </BentoBlock>
        <BentoBlock class="flex flex-col gap-3">
          <Eyebrow>Categories</Eyebrow>
          <p class="text-[13.5px] leading-relaxed text-muted">
            A category column that matches one of your categories is kept. Every other row goes through your keyword rules, then AI, right after import.
          </p>
        </BentoBlock>
      </div>
    </div>
  );
};
