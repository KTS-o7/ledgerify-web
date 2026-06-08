import { type RouteSectionProps, useLocation } from "@solidjs/router";
import { type Component, type JSX } from "solid-js";
import { BottomNav, Sidebar, MoreSheet } from "../components/ui/nav";

export const MainLayout: Component<RouteSectionProps> = (props): JSX.Element => {
  const location = useLocation();

  const isFocusedView = () => {
    const p = location.pathname;
    return p === "/activity" || p === "/transactions" || p.startsWith("/reports/");
  };

  return (
    <div class="min-h-screen bg-bg">
      <a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-primary focus:text-bg focus:px-3 focus:py-1.5 focus:rounded-input">
        Skip to main content
      </a>

      {/* Always in DOM — CSS hides on mobile (hidden md:flex is on the aside itself) */}
      <Sidebar />

      {/* Offset by sidebar on desktop, full width on mobile */}
      <main
        id="main"
        class={`md:pl-60 text-text min-h-screen${isFocusedView() ? "" : " pb-16 md:pb-0"}`}
        tabindex="-1"
      >
        {props.children}
      </main>

      {/* Always in DOM — CSS hides on desktop (md:hidden is on the nav itself) */}
      <BottomNav />
      <MoreSheet />
    </div>
  );
};
