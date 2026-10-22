import { Show, type Component } from "solid-js";
import { CloudOff, RefreshCw } from "lucide-solid";
import { online, queued } from "../../lib/pwa";

/** Dashed banner while offline, or while queued writes wait to sync. */
export const OfflineBanner: Component = () => (
  <Show when={!online() || queued() > 0}>
    <div role="status" aria-live="polite" class="mx-5 md:mx-7 mt-4 flex items-center gap-3 rounded-[14px] border border-dashed border-border-strong bg-surface px-4 py-3">
      <Show when={!online()} fallback={<RefreshCw size={18} class="text-signal shrink-0 animate-spin motion-reduce:animate-none" />}>
        <CloudOff size={18} class="text-warn shrink-0" />
      </Show>
      <div class="min-w-0">
        <div class="text-[14px] font-medium text-text">{online() ? "Back online · syncing" : "You're offline"}</div>
        <div class="text-[12.5px] text-muted">
          <Show when={queued() > 0} fallback="Showing the last data saved on this device.">
            <span class="font-mono tabular">{queued()}</span> change{queued() === 1 ? "" : "s"} saved on this device. {online() ? "Sending now." : "They sync when you reconnect."}
          </Show>
        </div>
      </div>
    </div>
  </Show>
);
