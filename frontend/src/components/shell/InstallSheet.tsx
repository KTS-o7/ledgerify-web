import { Show, createSignal, type Component } from "solid-js";
import { Portal } from "solid-js/web";
import { Zap, WifiOff, Share2 } from "lucide-solid";
import { canInstall, dismissInstall, promptInstall } from "../../lib/pwa";
import { Button } from "../ui/button";

/** Install prompt: second session on, at most once per 14 days (see lib/pwa.ts). */
export const InstallSheet: Component = () => {
  const [closed, setClosed] = createSignal(false);
  const open = () => canInstall() && !closed();
  const notNow = () => { dismissInstall(); setClosed(true); };
  const install = async () => { setClosed(true); await promptInstall(); };
  const benefit = (Icon: typeof Zap, text: string) => (
    <li class="flex items-center gap-3 text-[14px] text-text">
      <span class="w-8 h-8 rounded-[10px] bg-raised text-signal flex items-center justify-center shrink-0"><Icon size={16} /></span>
      {text}
    </li>
  );
  return (
    <Show when={open()}>
      <Portal>
        <div class="fixed inset-0 z-50 bg-scrim backdrop-blur-[3px]" onClick={notNow} aria-hidden="true" />
        <div role="dialog" aria-modal="true" aria-labelledby="install-title"
          class="fixed z-50 bottom-0 left-0 right-0 md:left-auto md:right-6 md:bottom-6 md:w-[380px] bg-surface border border-border-strong rounded-t-[28px] md:rounded-[18px] shadow-frame px-5 pt-5 pb-[calc(20px+env(safe-area-inset-bottom))] md:pb-5 animate-slide-up motion-reduce:animate-none">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-12 h-12 rounded-[12px] bg-btn text-btn-text flex items-center justify-center font-display italic text-[28px]" aria-hidden="true">L</div>
            <div>
              <h2 id="install-title" class="font-display text-[26px] leading-none text-text">Install Ledgerify</h2>
              <p class="font-mono text-[12px] text-muted mt-1">{location.host}</p>
            </div>
          </div>
          <ul class="flex flex-col gap-2.5 mb-5">
            {benefit(Zap, "Opens instantly from your home screen")}
            {benefit(WifiOff, "Works offline; changes sync later")}
            {benefit(Share2, "Share bank statements straight in")}
          </ul>
          <div class="grid grid-cols-2 gap-2">
            <Button variant="outline" size="lg" onClick={notNow}>Not now</Button>
            <Button size="lg" onClick={install}>Install app</Button>
          </div>
        </div>
      </Portal>
    </Show>
  );
};
