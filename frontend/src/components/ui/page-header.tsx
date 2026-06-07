import { Show, type Component, type JSX } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { ArrowLeft } from "lucide-solid";

type PageHeaderProps = { title: string; back?: boolean; actions?: JSX.Element };

export const PageHeader: Component<PageHeaderProps> = (props): JSX.Element => {
  const navigate = useNavigate();
  return (
    <header class="sticky top-0 z-30 bg-bg/95 backdrop-blur-sm border-b border-border h-14 md:h-16 flex items-center justify-between px-4 md:px-6">
      <div class="flex items-center gap-2 min-w-0">
        <Show when={props.back}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            class="w-10 h-10 flex items-center justify-center rounded-full bg-surface text-text active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <ArrowLeft size={20} />
          </button>
        </Show>
        <h1 class="font-display font-bold text-xl md:text-2xl text-text tracking-tight truncate">
          {props.title}
        </h1>
      </div>
      <div class="flex items-center gap-2">{props.actions}</div>
    </header>
  );
};
