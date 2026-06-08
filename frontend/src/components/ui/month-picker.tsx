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

function addMonths(ym: string, delta: number): string {
  const [year, month] = ym.split("-").map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export const MonthPicker: Component<MonthPickerProps> = (props) => {
  const isCurrentMonth = () => props.value === currentMonth();

  return (
    <div class="flex items-center gap-1">
      <button
        type="button"
        onClick={() => props.onChange(addMonths(props.value, -1))}
        aria-label="Previous month"
        class="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <ChevronLeft size={16} />
      </button>
      <span class="text-sm font-medium text-text min-w-[96px] text-center select-none">
        {formatMonthLabel(props.value)}
      </span>
      <button
        type="button"
        onClick={() => props.onChange(addMonths(props.value, 1))}
        disabled={isCurrentMonth()}
        aria-label="Next month"
        class="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-surface-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
};
