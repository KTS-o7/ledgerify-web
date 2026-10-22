import { type Component, createSignal, onCleanup, onMount, createEffect, on } from "solid-js";
import { prefersReducedMotion } from "../../lib/pwa";
import { Money, type MoneyTone } from "./money";

type NumberRollProps = {
  value: number;
  currency?: string;
  tone?: MoneyTone;
  mutedSymbol?: boolean;
  class?: string;
  /** Count-up duration in ms (first mount only). */
  duration?: number;
};

const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

/**
 * Counts up to `value` on first mount (quartic ease-out, 1.5s), then shows
 * later values directly. Reduced motion and hidden tabs render the final value.
 */
export const NumberRoll: Component<NumberRollProps> = (props) => {
  const [shown, setShown] = createSignal(prefersReducedMotion() ? props.value : 0);
  let raf = 0;
  let fallback: ReturnType<typeof setTimeout> | undefined;
  let done = prefersReducedMotion();

  const finish = () => { done = true; cancelAnimationFrame(raf); setShown(props.value); };

  onMount(() => {
    if (done) return;
    const duration = props.duration ?? 1500;
    const target = props.value;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(target * easeOutQuart(t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else finish();
    };
    raf = requestAnimationFrame(tick);
    // rAF does not run in hidden tabs: make sure the final value lands anyway.
    fallback = setTimeout(finish, duration + 100);
  });

  createEffect(on(() => props.value, (v) => { if (done) setShown(v); }, { defer: true }));

  onCleanup(() => { cancelAnimationFrame(raf); if (fallback) clearTimeout(fallback); });

  return (
    <Money
      value={Math.round(shown())}
      currency={props.currency}
      tone={props.tone}
      mutedSymbol={props.mutedSymbol}
      class={props.class}
    />
  );
};
