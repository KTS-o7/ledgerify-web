import { createSignal } from "solid-js";

/** Online/offline + queued-write count, driven by the service worker. */
export const [online, setOnline] = createSignal(typeof navigator === "undefined" ? true : navigator.onLine);
export const [queued, setQueued] = createSignal(0);

/** Deferred install prompt (Chromium). iOS shows manual "Add to Home Screen" copy instead. */
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const [installEvent, setInstallEvent] = createSignal<BIPEvent | null>(null);
export const canInstall = () => installEvent() !== null && !isStandalone() && !dismissedRecently();
export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

const DISMISS_KEY = "ledgerify.install.dismissedAt";
const dismissedRecently = () => Date.now() - Number(localStorage.getItem(DISMISS_KEY) || 0) < 14 * 864e5;
export function dismissInstall() { localStorage.setItem(DISMISS_KEY, String(Date.now())); setInstallEvent(null); }
export async function promptInstall() {
  const e = installEvent(); if (!e) return;
  await e.prompt(); await e.userChoice; setInstallEvent(null);
}

/** Theme: "system" | "light" | "dark", persisted. */
export type Theme = "system" | "light" | "dark";
const THEME_KEY = "ledgerify.theme";
export const [theme, setThemeSignal] = createSignal<Theme>((localStorage.getItem(THEME_KEY) as Theme) || "system");
export function setTheme(t: Theme) {
  setThemeSignal(t);
  if (t === "system") { localStorage.removeItem(THEME_KEY); delete document.documentElement.dataset.theme; }
  else { localStorage.setItem(THEME_KEY, t); document.documentElement.dataset.theme = t; }
}

/** Route changes wrapped in the View Transitions API when available. */
export function withViewTransition(fn: () => void) {
  const d = document as Document & { startViewTransition?: (cb: () => void) => void };
  if (d.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) d.startViewTransition(fn);
  else fn();
}

export function initPWA() {
  window.addEventListener("online", () => { setOnline(true); navigator.serviceWorker?.controller?.postMessage("flush-outbox"); });
  window.addEventListener("offline", () => setOnline(false));
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); setInstallEvent(e as BIPEvent); });

  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register("/sw.js");
    navigator.serviceWorker.addEventListener("message", (e) => {
      if (e.data?.type === "outbox") setQueued(e.data.count ?? 0);
    });
  }
}

/** Read a CSV handed over by the share target (see sw.js). */
export async function takeSharedFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const r = indexedDB.open("ledgerify", 1);
    r.onupgradeneeded = () => { r.result.createObjectStore("outbox", { keyPath: "id", autoIncrement: true }); r.result.createObjectStore("shared"); };
    r.onsuccess = () => {
      const t = r.result.transaction("shared", "readwrite");
      const s = t.objectStore("shared");
      const g = s.get("latest");
      g.onsuccess = () => { s.delete("latest"); resolve((g.result as File) ?? null); };
      g.onerror = () => resolve(null);
    };
    r.onerror = () => resolve(null);
  });
}
