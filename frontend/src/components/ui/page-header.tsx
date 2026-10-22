import { Show, type Component, type JSX } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { ArrowLeft } from "lucide-solid";
import { MobileMenuButton } from "./nav";

type PageHeaderProps = {
  title: string;
  back?: boolean;
  actions?: JSX.Element;
  /** Small mono count or note next to the title, e.g. "248". */
  meta?: JSX.Element;
};

/** 68px header: serif title (34px mobile, 30px desktop), actions on the right. */
export const PageHeader: Component<PageHeaderProps> = (props): JSX.Element => {
  const navigate = useNavigate();
  return (
    <header class="sticky top-0 z-30 bg-nav backdrop-blur-[16px] border-b border-border min-h-[60px] md:h-[68px] flex items-center justify-between gap-3 px-5 md:px-7 pt-[env(safe-area-inset-top)]">
      <div class="flex items-center gap-2 min-w-0">
        <Show when={props.back}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            class="w-9 h-9 flex items-center justify-center rounded-full text-muted hover:text-text hover:bg-raised active:scale-[0.96] transition-[transform,background-color] duration-[90ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            <ArrowLeft size={18} />
          </button>
        </Show>
        <h1 class="font-display font-normal text-[34px] md:text-[30px] leading-none text-text tracking-[-0.01em] truncate">
          {props.title}
        </h1>
        <Show when={props.meta}>
          <span class="font-mono text-[13px] text-muted tabular self-end mb-0.5">{props.meta}</span>
        </Show>
      </div>
      <div class="flex items-center gap-2 shrink-0">{props.actions}<MobileMenuButton /></div>
    </header>
  );
};
