import { createSignal, Show } from "solid-js";
import { FileUp, FileCheck, CheckCircle, AlertCircle } from "lucide-solid";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Button } from "../components/ui/button";

interface ImportStats {
  imported: number;
  skipped: number;
  errors?: string[];
}

export default function Import() {
  const [file, setFile] = createSignal<File | null>(null);
  const [importing, setImporting] = createSignal(false);
  const [result, setResult] = createSignal<ImportStats | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  let inputRef: HTMLInputElement | undefined;

  const onFileChange = (e: Event) => {
    const f = (e.currentTarget as HTMLInputElement).files?.[0] ?? null;
    setFile(f);
    setResult(null);
    setError(null);
  };

  const onImport = async () => {
    const f = file();
    if (!f) return;
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      const token = localStorage.getItem("jwt_token");
      const form = new FormData();
      form.append("file", f);
      const res = await fetch("/api/import", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Import failed: ${res.status}`);
      }
      const data: ImportStats = await res.json();
      setResult(data);
      setFile(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <PageHeader title="Import" />
      <div class="p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-3">
        {/* Drop zone */}
        <BentoBlock variant="dashed" class="col-span-1 md:col-span-12 flex flex-col items-center justify-center text-center py-12">
          <FileUp size={48} class="text-muted mb-3" />
          <h2 class="font-display text-xl font-bold text-text mb-1">Drop a CSV here or click to browse</h2>
          <p class="text-sm text-muted mb-4">We'll match the columns to your accounts and categories.</p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            aria-label="Choose CSV file"
            class="sr-only"
            onChange={onFileChange}
          />
          <Button onClick={() => inputRef?.click()}>Choose File</Button>
        </BentoBlock>

        {/* File selected state */}
        <Show when={file()}>
          {(f) => (
            <>
              <BentoBlock class="col-span-1 md:col-span-6">
                <div class="flex items-center gap-3">
                  <FileCheck size={24} class="text-primary" />
                  <div class="flex-1 min-w-0">
                    <div class="font-body text-base text-text truncate">{f().name}</div>
                    <div class="text-sm text-muted">{(f().size / 1024).toFixed(1)} KB</div>
                  </div>
                </div>
              </BentoBlock>
              <BentoBlock class="col-span-1 md:col-span-6 flex flex-col justify-between gap-3">
                <div class="text-sm text-muted space-y-1">
                  <p>Expected columns: <span class="font-mono text-text">date, title, amount, type, category, account</span></p>
                  <p>Duplicates are skipped automatically.</p>
                </div>
                <Show when={error()}>
                  <p class="text-accent text-sm">{error()}</p>
                </Show>
                <Button class="w-full" size="lg" disabled={importing()} onClick={onImport}>
                  {importing() ? "Importing…" : `Import ${f().name}`}
                </Button>
              </BentoBlock>
            </>
          )}
        </Show>

        {/* Result */}
        <Show when={result()}>
          {(r) => (
            <BentoBlock class="col-span-1 md:col-span-12">
              <div class="flex items-start gap-3">
                <CheckCircle size={24} class="text-primary flex-shrink-0 mt-0.5" />
                <div class="flex-1">
                  <div class="font-display text-lg font-bold text-text mb-1">Import complete</div>
                  <div class="text-sm text-muted">
                    <span class="text-primary font-semibold">{r().imported}</span> imported,&nbsp;
                    <span class="text-muted">{r().skipped}</span> skipped
                  </div>
                  <Show when={(r().errors ?? []).length > 0}>
                    <div class="mt-2 flex items-start gap-2">
                      <AlertCircle size={16} class="text-accent flex-shrink-0 mt-0.5" />
                      <ul class="text-xs text-accent space-y-0.5">
                        {(r().errors ?? []).map((e) => <li>{e}</li>)}
                      </ul>
                    </div>
                  </Show>
                </div>
              </div>
            </BentoBlock>
          )}
        </Show>
      </div>
    </>
  );
}
