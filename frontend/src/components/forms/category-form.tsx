import { createSignal, For, Show, type Component } from "solid-js";
import { api } from "../../lib/api";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { SegmentedControl } from "../ui/segmented-control";
import {
  ShoppingCart,
  House,
  Car,
  Utensils,
  Zap,
  Heart,
  Briefcase,
  Coffee,
  Plane,
  Music,
  Book,
  Gift,
  Smartphone,
  Dumbbell,
  Pill,
  GraduationCap,
  Wallet,
  TrendingUp,
  Film,
  Bus,
} from "lucide-solid";
import { cn } from "../../lib/utils";

const ICON_OPTIONS: { name: string; icon: Component<{ size?: number; class?: string }> }[] = [
  { name: "shopping-cart", icon: ShoppingCart },
  { name: "house", icon: House },
  { name: "car", icon: Car },
  { name: "utensils", icon: Utensils },
  { name: "zap", icon: Zap },
  { name: "heart", icon: Heart },
  { name: "briefcase", icon: Briefcase },
  { name: "coffee", icon: Coffee },
  { name: "plane", icon: Plane },
  { name: "music", icon: Music },
  { name: "book", icon: Book },
  { name: "gift", icon: Gift },
  { name: "smartphone", icon: Smartphone },
  { name: "dumbbell", icon: Dumbbell },
  { name: "pill", icon: Pill },
  { name: "graduation-cap", icon: GraduationCap },
  { name: "wallet", icon: Wallet },
  { name: "trending-up", icon: TrendingUp },
  { name: "film", icon: Film },
  { name: "bus", icon: Bus },
];

type CategoryFormProps = {
  onSuccess: () => void;
  onClose: () => void;
  existing?: {
    id: string;
    name: string;
    type: "income" | "expense";
    color: string;
    icon?: string;
  };
};

export function CategoryForm(props: CategoryFormProps) {
  const [name, setName] = createSignal(props.existing?.name ?? "");
  const [type, setType] = createSignal<"income" | "expense">(props.existing?.type ?? "expense");
  const [color, setColor] = createSignal(props.existing?.color ?? "#CCFF00");
  const [icon, setIcon] = createSignal(props.existing?.icon ?? "");
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
      const body = {
        name: name().trim(),
        type: type(),
        color: color(),
        icon: icon(),
      };
      if (props.existing) {
        await api.put(`/v1/categories/${props.existing.id}`, body);
      } else {
        await api.post("/v1/categories", body);
      }
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
        <label for="category-name" class="text-[12.5px] font-medium text-muted mb-1.5 block">
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
        <span id="category-type-label" class="text-[12.5px] font-medium text-muted mb-1.5 block">
          Type
        </span>
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
        <label for="category-color" class="text-[12.5px] font-medium text-muted mb-1.5 block">
          Color
        </label>
        <input
          id="category-color"
          type="color"
          class="h-11 w-full rounded-input cursor-pointer border border-border-strong bg-surface p-1"
          value={color()}
          onInput={(e) => setColor(e.currentTarget.value)}
        />
      </div>

      <div>
        <span id="category-icon-label" class="text-[12.5px] font-medium text-muted mb-1.5 block">
          Icon
        </span>
        <div class="grid grid-cols-5 gap-1.5" role="group" aria-labelledby="category-icon-label">
          {/* None option */}
          <button
            type="button"
            onClick={() => setIcon("")}
            aria-label="No icon"
            aria-pressed={icon() === ""}
            class={cn(
              "h-10 flex items-center justify-center rounded-[10px] border text-[12px] text-muted transition-colors duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal",
              icon() === ""
                ? "border-signal bg-signal-soft text-signal"
                : "border-border bg-surface hover:border-border-strong hover:text-text"
            )}
          >
            None
          </button>
          <For each={ICON_OPTIONS}>
            {(opt) => {
              const selected = () => icon() === opt.name;
              return (
                <button
                  type="button"
                  onClick={() => setIcon(opt.name)}
                  aria-label={opt.name}
                  aria-pressed={selected()}
                  class={cn(
                    "h-10 flex items-center justify-center rounded-[10px] border transition-colors duration-[160ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal",
                    selected()
                      ? "border-signal bg-signal-soft text-signal"
                      : "border-border bg-surface text-muted hover:border-border-strong hover:text-text"
                  )}
                >
                  <opt.icon size={18} />
                </button>
              );
            }}
          </For>
        </div>
      </div>

      <Show when={error()}>
        <p role="alert" class="text-neg text-[13.5px]">{error()}</p>
      </Show>

      <Button type="submit" size="lg" class="w-full" disabled={submitting()}>
        {submitting() ? "Saving…" : props.existing ? "Save changes" : "Save"}
      </Button>
    </form>
  );
}
