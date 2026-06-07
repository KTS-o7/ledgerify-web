import { createSignal, Show } from "solid-js";
import { api } from "../../lib/api";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { SegmentedControl } from "../ui/segmented-control";

type CategoryFormProps = {
  onSuccess: () => void;
  onClose: () => void;
};

export function CategoryForm(props: CategoryFormProps) {
  const [name, setName] = createSignal("");
  const [type, setType] = createSignal<"income" | "expense">("expense");
  const [color, setColor] = createSignal("#CCFF00");
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal("");

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setError("");

    if (!name().trim()) {
      setError("Name is required.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/v1/categories", {
        name: name().trim(),
        type: type(),
        color: color(),
      });
      props.onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} class="flex flex-col gap-4">
      <div>
        <label for="category-name" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Name
        </label>
        <Input
          id="category-name"
          type="text"
          placeholder="e.g. Groceries"
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          required
        />
      </div>

      <div>
        <label class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Type
        </label>
        <SegmentedControl
          options={[
            { value: "expense", label: "Expense" },
            { value: "income", label: "Income" },
          ]}
          value={type()}
          onChange={(v) => setType(v)}
          ariaLabel="Category type"
        />
      </div>

      <div>
        <label for="category-color" class="text-[13px] font-body font-medium text-muted uppercase tracking-wide mb-1.5 block">
          Color
        </label>
        <input
          id="category-color"
          type="color"
          class="h-12 w-full rounded-input cursor-pointer border border-border bg-surface"
          value={color()}
          onInput={(e) => setColor(e.currentTarget.value)}
        />
      </div>

      <Show when={error()}>
        <p class="text-accent text-sm">{error()}</p>
      </Show>

      <Button type="submit" class="w-full" disabled={submitting()}>
        {submitting() ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
