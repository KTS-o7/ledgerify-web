import { Search } from "lucide-solid";
import { type Component, type JSX } from "solid-js";
import { cn } from "../../lib/utils";

type SearchBarProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  class?: string;
};

export const SearchBar: Component<SearchBarProps> = (props): JSX.Element => (
  <label class={cn("relative block w-full", props.class)}>
    <span class="sr-only">Search transactions.</span>
    <Search
      size={20}
      class="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
    />
    <input
      type="search"
      value={props.value}
      onInput={(e) => props.onChange(e.currentTarget.value)}
      placeholder={props.placeholder ?? "Search…"}
      class="h-12 w-full bg-surface rounded-input pl-12 pr-4 text-text placeholder:text-muted border border-border focus:outline-none focus-within:ring-1 focus-within:ring-primary focus:border-primary transition-colors"
    />
  </label>
);
