import { createSignal, onCleanup, onMount, Show, type JSX, type Component } from "solid-js";
import { RefreshCw } from "lucide-solid";
import { prefersReducedMotion } from "../../lib/pwa";
import { cn } from "../../lib/utils";

const THRESHOLD = 64;
const MAX_PULL = 96;

type PullToRefreshProps = {
  onRefresh: () => Promise<unknown>;
  children: JSX.Element;
};

/**
 * Touch pull-to-refresh for a page that scrolls the window. Starts only when
 * the page is at the top; releases past 64px trigger `onRefresh`. Under
 * reduced motion the content does not move; only the spinner shows.
 */
export const PullToRefresh: Component<PullToRefreshProps> = (props) => {
  const [pull, setPull] = createSignal(0);
  const [refreshing, setRefreshing] = createSignal(false);
  const [dragging, setDragging] = createSignal(false);
  let ref: HTMLDivElement | undefined;
  let startY: number | null = null;

  const onStart = (e: TouchEvent) => {
    if (refreshing() || window.scrollY > 0 || e.touches.length !== 1) { startY = null; return; }
    startY = e.touches[0]!.clientY;
    setDragging(true);
  };
  const onMove = (e: TouchEvent) => {
    if (startY === null) return;
    const dy = e.touches[0]!.clientY - startY;
    if (dy <= 0 || window.scrollY > 0) { setPull(0); return; }
    setPull(Math.min(MAX_PULL, dy * 0.5));
  };
  const onEnd = async () => {
    if (startY === null) return;
    startY = null;
    setDragging(false);
    if (pull() < THRESHOLD) { setPull(0); return; }
    setRefreshing(true);
    setPull(THRESHOLD * 0.75);
    try { await props.onRefresh(); } finally { setRefreshing(false); setPull(0); }
  };

  onMount(() => {
    if (!ref) return;
    ref.addEventListener("touchstart", onStart, { passive: true });
    ref.addEventListener("touchmove", onMove, { passive: true });
    ref.addEventListener("touchend", onEnd);
    ref.addEventListener("touchcancel", onEnd);
    onCleanup(() => {
      ref!.removeEventListener("touchstart", onStart);
      ref!.removeEventListener("touchmove", onMove);
      ref!.removeEventListener("touchend", onEnd);
      ref!.removeEventListener("touchcancel", onEnd);
    });
  });

  const reduce = prefersReducedMotion();
  const offset = () => (reduce ? 0 : pull());

  return (
    <div ref={ref} class="relative">
      <Show when={pull() > 0 || refreshing()}>
        <div
          class="absolute left-0 right-0 top-0 flex justify-center pointer-events-none"
          style={{ height: `${Math.max(pull(), 40)}px` }}
          role="status"
          aria-live="polite"
        >
          <span class={cn("mt-2 w-8 h-8 rounded-full bg-raised border border-border flex items-center justify-center",
            pull() >= THRESHOLD || refreshing() ? "text-signal" : "text-muted")}>
            <RefreshCw
              size={15}
              class={cn(refreshing() && "animate-spin motion-reduce:animate-none")}
              style={!refreshing() && !reduce ? { transform: `rotate(${pull() * 3}deg)` } : undefined}
            />
          </span>
          <span class="sr-only">{refreshing() ? "Refreshing" : pull() >= THRESHOLD ? "Release to refresh" : "Pull to refresh"}</span>
        </div>
      </Show>
      <div
        class={cn(!dragging() && "transition-transform duration-[220ms] ease-[var(--ease-standard)]")}
        style={offset() ? { transform: `translateY(${offset()}px)` } : undefined}
      >
        {props.children}
      </div>
    </div>
  );
};
