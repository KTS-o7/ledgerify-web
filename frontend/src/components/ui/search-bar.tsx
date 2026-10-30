import { Search } from "lucide-solid";
import { type Component, type JSX } from "solid-js";
import { cn } from "../../lib/utils";

type SearchBarProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  class?: string;
  /** Optional trailing control, e.g. a filter button. */
  trailing?: JSX.Element;
};

export const SearchBar: Component<SearchBarProps> = (props): JSX.Element => (
  <label class={cn("relative flex items-center w-full h-11 bg-surface rounded-input border border-border-strong focus-within:border-signal transition-colors duration-[160ms]", props.class)}>
    <span class="sr-only">Search transactions.</span>
    <Search size={17} class="absolute left-3.5 text-muted pointer-events-none" />
    <input
      type="search"
      value={props.value}
      onInput={(e) => props.onChange(e.currentTarget.value)}
      placeholder={props.placeholder ?? "Search…"}
      class="h-full flex-1 min-w-0 bg-transparent pl-10 pr-3 text-[15px] text-text placeholder:text-faint focus:outline-none"
    />
    {props.trailing}
  </label>
);
