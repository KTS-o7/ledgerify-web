import { type RouteSectionProps, useLocation } from "@solidjs/router";
import { createSignal, onCleanup, onMount, Show, type Component, type JSX } from "solid-js";
import { BottomNav, Sidebar, MoreSheet } from "../components/ui/nav";

export const MainLayout: Component<RouteSectionProps> = (props): JSX.Element => {
  const [isDesktop, setIsDesktop] = createSignal(false);
  const location = useLocation();

  onMount(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    onCleanup(() => mq.removeEventListener("change", update));
  });

  const isFocusedView = () => location.pathname === "/activity" || location.pathname === "/transactions";

  return (
    <div class="min-h-screen bg-bg text-text">
      <a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-primary focus:text-bg focus:px-3 focus:py-1.5 focus:rounded-input">
        Skip to main content
      </a>
      <Show when={isDesktop()}><Sidebar /></Show>
      <main id="main" class={isDesktop() ? "md:ml-60" : ""} tabindex="-1">
        <div class={isFocusedView() ? "" : "pb-20 md:pb-0"}>{props.children}</div>
      </main>
      <Show when={!isDesktop()}><BottomNav /></Show>
      <MoreSheet />
    </div>
  );
};
