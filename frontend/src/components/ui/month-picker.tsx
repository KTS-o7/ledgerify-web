import { type Component } from "solid-js";
import { ChevronLeft, ChevronRight } from "lucide-solid";

type MonthPickerProps = {
  value: string; // "YYYY-MM"
  onChange: (month: string) => void;
};

function formatMonthLabel(ym: string): string {
  const [year, month] = ym.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleString("en-US", { month: "short", year: "numeric" });
}

export function addMonths(ym: string, delta: number): string {
  const [year, month] = ym.split("-").map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const stepBtn = "w-8 h-full flex items-center justify-center text-muted hover:text-text hover:bg-raised transition-colors duration-[160ms] disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal";

/** Month stepper: mono label in a 32px bordered pill. */
export const MonthPicker: Component<MonthPickerProps> = (props) => {
  const isCurrentMonth = () => props.value === currentMonth();

  return (
    <div class="flex items-center h-8 rounded-[10px] border border-border-strong overflow-hidden">
      <button type="button" onClick={() => props.onChange(addMonths(props.value, -1))} aria-label="Previous month" class={stepBtn}>
        <ChevronLeft size={15} />
      </button>
      <span class="font-mono text-[12.5px] text-text tabular min-w-[84px] text-center select-none" aria-live="polite">
        {formatMonthLabel(props.value)}
      </span>
      <button type="button" onClick={() => props.onChange(addMonths(props.value, 1))} disabled={isCurrentMonth()} aria-label="Next month" class={stepBtn}>
        <ChevronRight size={15} />
      </button>
    </div>
  );
};
