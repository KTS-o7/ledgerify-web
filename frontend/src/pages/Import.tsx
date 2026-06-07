import { createSignal, Show } from "solid-js";
import { FileUp, FileCheck, ChevronDown } from "lucide-solid";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Button } from "../components/ui/button";

export default function Import() {
  const [file, setFile] = createSignal<File | null>(null);
  let inputRef: HTMLInputElement | undefined;
  return (
    <>
      <PageHeader title="Import" />
      <div class="p-4 md:p-6 space-y-3 max-w-3xl">
        <BentoBlock variant="dashed" size="lg" class="flex flex-col items-center justify-center text-center py-12">
          <FileUp size={48} class="text-muted mb-3" />
          <h2 class="font-display text-xl font-bold text-text mb-1">Drop a CSV here or click to browse</h2>
          <p class="text-sm text-muted mb-4">We'll match the columns to your accounts and categories.</p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            aria-label="Choose CSV file"
            class="sr-only"
            onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)}
          />
          <Button onClick={() => inputRef?.click()}>Choose File</Button>
        </BentoBlock>

        <Show when={file()}>
          {(f) => (
            <>
              <BentoBlock size="md">
                <div class="flex items-center gap-3">
                  <FileCheck size={24} class="text-primary" />
                  <div class="flex-1 min-w-0">
                    <div class="font-body text-base text-text truncate">{f().name}</div>
                    <div class="text-sm text-muted">{(f().size / 1024).toFixed(1)} KB</div>
                  </div>
                </div>
              </BentoBlock>
              <BentoBlock size="md">
                <details class="group">
                  <summary class="flex items-center justify-between cursor-pointer list-none">
                    <span class="font-display text-lg font-bold text-text">Column Mapping</span>
                    <ChevronDown size={20} class="text-muted transition-transform group-open:rotate-180" />
                  </summary>
                  <div class="mt-4 space-y-3 text-sm text-muted">
                    <p>Map CSV columns to your Ledgerify fields. Auto-detected mappings are pre-selected.</p>
                    <ul class="space-y-2">
                      <li class="flex justify-between"><span>date</span><span>→ Date</span></li>
                      <li class="flex justify-between"><span>title</span><span>→ Merchant</span></li>
                      <li class="flex justify-between"><span>amount</span><span>→ Amount</span></li>
                      <li class="flex justify-between"><span>category</span><span>→ Category</span></li>
                    </ul>
                  </div>
                </details>
              </BentoBlock>
              <Button class="w-full" size="lg">Import {f().name}</Button>
            </>
          )}
        </Show>
      </div>
    </>
  );
}
