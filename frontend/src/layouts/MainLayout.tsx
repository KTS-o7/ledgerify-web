import { type RouteSectionProps, useLocation } from "@solidjs/router";
import { type Component, type JSX, createEffect, on } from "solid-js";
import { BottomNav, Sidebar, MoreSheet } from "../components/ui/nav";
import { CommandPalette } from "../components/shell/CommandPalette";
import { Shortcuts } from "../components/shell/Shortcuts";
import { QuickAddSheet } from "../components/shell/QuickAddSheet";
import { OfflineBanner } from "../components/shell/OfflineBanner";
import { InstallSheet } from "../components/shell/InstallSheet";
import { prefersReducedMotion } from "../lib/pwa";

export const MainLayout: Component<RouteSectionProps> = (props): JSX.Element => {
  const location = useLocation();
  let mainRef: HTMLElement | undefined;

  // Page change: 220ms fade + 8px rise (opacity only under reduced motion).
  createEffect(on(() => location.pathname, () => {
    if (!mainRef?.animate) return;
    const reduce = prefersReducedMotion();
    mainRef.animate(
      reduce ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }],
      { duration: reduce ? 120 : 220, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" },
    );
  }, { defer: true }));

  return (
    <div class="min-h-screen bg-bg text-text">
      <a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] focus:bg-btn focus:text-btn-text focus:px-3 focus:py-1.5 focus:rounded-input">
        Skip to main content
      </a>

      <Sidebar />

      <main
        ref={mainRef}
        id="main"
        class="md:pl-60 min-h-screen pb-[calc(76px+env(safe-area-inset-bottom))] md:pb-0"
        tabindex="-1"
      >
        <OfflineBanner />
        {props.children}
      </main>

      <BottomNav />
      <MoreSheet />
      <CommandPalette />
      <QuickAddSheet />
      <InstallSheet />
      <Shortcuts />
    </div>
  );
};
