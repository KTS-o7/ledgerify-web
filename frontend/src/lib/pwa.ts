import { createSignal } from "solid-js";

/** Online/offline + queued-write count, driven by the service worker. */
export const [online, setOnline] = createSignal(typeof navigator === "undefined" ? true : navigator.onLine);
export const [queued, setQueued] = createSignal(0);
/** Bumped when the service worker drops a queued write the server rejected. */
export const [rejectedWrites, setRejectedWrites] = createSignal(0);

/** A transaction write waiting in the service worker outbox. */
export type QueuedWrite = { id: number; method: string; url: string; body: Record<string, unknown> | null; at: number };

/** Deferred install prompt (Chromium). iOS shows manual "Add to Home Screen" copy instead. */
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const [installEvent, setInstallEvent] = createSignal<BIPEvent | null>(null);

const SESSIONS_KEY = "ledgerify.sessions";
const DISMISS_KEY = "ledgerify.install.dismissedAt";

function store(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
const dismissedRecently = () => Date.now() - Number(store()?.getItem(DISMISS_KEY) || 0) < 14 * 864e5;
const sessionCount = () => Number(store()?.getItem(SESSIONS_KEY) || 0);

/** Show the install sheet only from the second session on, at most once per 14 days. */
export const canInstall = () => installEvent() !== null && !isStandalone() && !dismissedRecently() && sessionCount() >= 2;
export function dismissInstall() { store()?.setItem(DISMISS_KEY, String(Date.now())); setInstallEvent(null); }
export async function promptInstall() {
  const e = installEvent(); if (!e) return;
  await e.prompt(); await e.userChoice; setInstallEvent(null);
}

/** Theme: "system" | "light" | "dark", persisted. */
export type Theme = "system" | "light" | "dark";
const THEME_KEY = "ledgerify.theme";
const initialTheme = (): Theme => {
  const t = store()?.getItem(THEME_KEY);
  return t === "light" || t === "dark" ? t : "system";
};
export const [theme, setThemeSignal] = createSignal<Theme>(initialTheme());
export function setTheme(t: Theme) {
  setThemeSignal(t);
  if (t === "system") { store()?.removeItem(THEME_KEY); delete document.documentElement.dataset.theme; }
  else { store()?.setItem(THEME_KEY, t); document.documentElement.dataset.theme = t; }
  syncThemeColor();
}

/** Keep the browser chrome colour in step with a forced theme. */
function syncThemeColor() {
  const forced = document.documentElement.dataset.theme;
  for (const m of Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'))) {
    const scheme = m.media.includes("light") ? "light" : "dark";
    const value = (forced ?? scheme) === "light" ? "#F4F0E7" : "#0C0B09";
    m.content = value;
  }
}

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Route changes wrapped in the View Transitions API when available. */
export function withViewTransition(fn: () => void) {
  const d = document as Document & { startViewTransition?: (cb: () => void) => void };
  if (d.startViewTransition && !prefersReducedMotion()) d.startViewTransition(fn);
  else fn();
}

function post(msg: Record<string, unknown>) {
  navigator.serviceWorker?.controller?.postMessage(msg);
}

/** Ask the service worker to replay queued writes with the current token. */
export function flushOutbox() {
  post({ type: "flush-outbox", token: store()?.getItem("jwt_token") ?? undefined });
}

/** Drop cached API data and queued writes. Call on logout. */
export async function clearUserData() {
  post({ type: "clear-user-data" });
  try { await caches.delete("api-luxe-v1"); } catch { /* caches unavailable */ }
  setQueued(0);
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("ledgerify", 1);
    r.onupgradeneeded = () => { r.result.createObjectStore("outbox", { keyPath: "id", autoIncrement: true }); r.result.createObjectStore("shared"); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/** Read the queued writes so pages can show "Waiting to sync" rows. */
export async function queuedWrites(): Promise<QueuedWrite[]> {
  try {
    const d = await openDB();
    return await new Promise((resolve) => {
      const g = d.transaction("outbox", "readonly").objectStore("outbox").getAll();
      g.onsuccess = () => resolve((g.result as Array<QueuedWrite & { body: string }>).map((it) => {
        let body: Record<string, unknown> | null = null;
        try { body = JSON.parse(it.body); } catch { /* not JSON */ }
        return { id: it.id, method: it.method, url: it.url, body, at: it.at };
      }));
      g.onerror = () => resolve([]);
    });
  } catch { return []; }
}

export function initPWA() {
  const s = store();
  if (s) s.setItem(SESSIONS_KEY, String(sessionCount() + 1));
  syncThemeColor();

  window.addEventListener("online", () => { setOnline(true); flushOutbox(); });
  window.addEventListener("offline", () => setOnline(false));
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); setInstallEvent(e as BIPEvent); });

  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register("/sw.js").then(() => navigator.serviceWorker.ready).then(() => {
      post({ type: "outbox-count" });
      if (navigator.onLine) flushOutbox();
    }).catch(() => { /* SW unsupported or blocked */ });
    navigator.serviceWorker.addEventListener("message", (e) => {
      if (e.data?.type === "outbox") setQueued(e.data.count ?? 0);
      if (e.data?.type === "outbox-rejected") setRejectedWrites((n) => n + 1);
    });
  }
}

/** Read a CSV handed over by the share target (see sw.js). */
export async function takeSharedFile(): Promise<File | null> {
  try {
    const d = await openDB();
    return await new Promise((resolve) => {
      const s = d.transaction("shared", "readwrite").objectStore("shared");
      const g = s.get("latest");
      g.onsuccess = () => { s.delete("latest"); resolve((g.result as File) ?? null); };
      g.onerror = () => resolve(null);
    });
  } catch { return null; }
}
