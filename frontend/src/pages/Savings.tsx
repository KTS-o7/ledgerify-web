import { createResource, createSignal, For, Show } from "solid-js";
import { PiggyBank, Plus } from "lucide-solid";
import { api } from "../lib/api";
import { formatCurrency, numericToFloat, pgDateToString } from "../lib/format";
import { PageHeader } from "../components/ui/page-header";
import { BentoBlock } from "../components/ui/bento-block";
import { Badge } from "../components/ui/badge";
import { CategoryBar } from "../components/ui/category-bar";
import { SkeletonBlock } from "../components/ui/skeleton";
import { EmptyState } from "../components/ui/empty-state";
import { Sheet } from "../components/ui/sheet";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { SegmentedControl } from "../components/ui/segmented-control";
import { Button } from "../components/ui/button";

interface SavingsGoal {
  id: string;
  name: string;
  description: { String: string; Valid: boolean };
  target_amount: unknown;
  current_amount: unknown;
  currency: string;
  deadline: unknown;
  status: "active" | "achieved" | "abandoned";
}

const STATUS_OPTIONS = [
  { value: "active" as const, label: "Active" },
  { value: "achieved" as const, label: "Achieved" },
  { value: "abandoned" as const, label: "Abandoned" },
];

const CURRENCY_OPTIONS = ["INR", "USD", "EUR", "GBP"];

export default function Savings() {
  const [sheetOpen, setSheetOpen] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const [formError, setFormError] = createSignal("");

  // Form fields
  const [name, setName] = createSignal("");
  const [targetAmount, setTargetAmount] = createSignal("");
  const [currentAmount, setCurrentAmount] = createSignal("");
  const [currency, setCurrency] = createSignal("INR");
  const [deadline, setDeadline] = createSignal("");
  const [status, setStatus] = createSignal<"active" | "achieved" | "abandoned">("active");

  const [goals, { refetch }] = createResource(() => api.get<SavingsGoal[]>("/v1/savings"));

  function resetForm() {
    setName("");
    setTargetAmount("");
    setCurrentAmount("");
    setCurrency("INR");
    setDeadline("");
    setStatus("active");
    setFormError("");
  }

  function openSheet() {
    resetForm();
    setSheetOpen(true);
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!name().trim()) {
      setFormError("Goal name is required.");
      return;
    }
    setFormError("");
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        name: name().trim(),
        currency: currency(),
        status: status(),
      };
      if (targetAmount()) body.target_amount = parseFloat(targetAmount());
      if (currentAmount()) body.current_amount = parseFloat(currentAmount());
      if (deadline()) body.deadline = deadline();
      await api.post("/v1/savings", body);
      setSheetOpen(false);
      refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create goal.");
    } finally {
      setSubmitting(false);
    }
  }

  function statusBadgeVariant(s: string): "success" | "outline" {
    if (s === "active" || s === "achieved") return "success";
    return "outline";
  }

  return (
    <>
      <PageHeader
        title="Savings Goals"
        actions={
          <button
            type="button"
            aria-label="Add savings goal"
            onClick={openSheet}
            class="w-10 h-10 flex items-center justify-center rounded-full bg-surface text-text active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <Plus size={20} />
          </button>
        }
      />

      <div class="p-4 md:p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Show when={goals.loading}>
            <SkeletonBlock class="min-h-[160px]" />
            <SkeletonBlock class="min-h-[160px]" />
          </Show>
          <Show when={goals.error}>
            <div class="col-span-1 md:col-span-2 lg:col-span-3">
              <p class="text-accent text-sm py-6 text-center">Failed to load savings goals.</p>
            </div>
          </Show>
          <Show when={!goals.loading && !goals.error && (goals() ?? []).length === 0}>
            <div class="col-span-1 md:col-span-2 lg:col-span-3">
              <EmptyState
                icon={PiggyBank}
                title="No savings goals yet"
                body="Create a goal to start tracking your progress."
                action={{ label: "Add your first goal", onClick: openSheet }}
              />
            </div>
          </Show>
          <For each={goals() ?? []}>
            {(g) => {
              const target = () => numericToFloat(g.target_amount);
              const current = () => numericToFloat(g.current_amount);
              const progress = () => target() > 0 ? Math.min(current() / target(), 1) : 0;
              const deadlineStr = () => pgDateToString(g.deadline);
              const barColor = () =>
                g.status === "achieved"
                  ? "var(--color-primary)"
                  : "var(--color-primary)";
              return (
                <BentoBlock variant="pressable" size="md">
                  <div class="flex flex-col gap-2">
                    <div class="flex items-start justify-between gap-2">
                      <span class="font-display text-lg font-bold text-text leading-tight">{g.name}</span>
                      <Badge variant={statusBadgeVariant(g.status)} class="shrink-0 capitalize">
                        {g.status}
                      </Badge>
                    </div>
                    <div class="flex items-baseline justify-between text-sm">
                      <span class="text-muted">
                        {formatCurrency(current(), g.currency)}
                        {" / "}
                        {formatCurrency(target(), g.currency)}
                      </span>
                      <span class="text-muted">{(progress() * 100).toFixed(0)}%</span>
                    </div>
                    <CategoryBar
                      value={progress()}
                      color={barColor()}
                      trackColor="bg-bg"
                    />
                    <Show when={deadlineStr()}>
                      <span class="text-[12px] text-muted font-body">Due {deadlineStr()}</span>
                    </Show>
                  </div>
                </BentoBlock>
              );
            }}
          </For>
        </div>
      </div>

      <Sheet open={sheetOpen()} onClose={() => setSheetOpen(false)} title="New Savings Goal">
        <form onSubmit={handleSubmit} class="flex flex-col gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-muted" for="sg-name">Goal Name</label>
            <Input
              id="sg-name"
              type="text"
              placeholder="e.g. Emergency Fund"
              required
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-muted" for="sg-target">Target Amount</label>
            <Input
              id="sg-target"
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              value={targetAmount()}
              onInput={(e) => setTargetAmount(e.currentTarget.value)}
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-muted" for="sg-current">Current Amount</label>
            <Input
              id="sg-current"
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              value={currentAmount()}
              onInput={(e) => setCurrentAmount(e.currentTarget.value)}
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-muted" for="sg-currency">Currency</label>
            <Select
              id="sg-currency"
              value={currency()}
              onChange={(e) => setCurrency((e.currentTarget as HTMLSelectElement).value)}
            >
              <For each={CURRENCY_OPTIONS}>
                {(c) => <option value={c}>{c}</option>}
              </For>
            </Select>
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-muted" for="sg-deadline">Deadline</label>
            <Input
              id="sg-deadline"
              type="date"
              value={deadline()}
              onInput={(e) => setDeadline(e.currentTarget.value)}
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium text-muted">Status</label>
            <SegmentedControl
              options={STATUS_OPTIONS}
              value={status()}
              onChange={setStatus}
              ariaLabel="Goal status"
            />
          </div>

          <Show when={formError()}>
            <p class="text-accent text-sm">{formError()}</p>
          </Show>

          <Button type="submit" disabled={submitting()} class="w-full mt-2">
            {submitting() ? "Saving…" : "Create Goal"}
          </Button>
        </form>
      </Sheet>
    </>
  );
}
