/* Ledgerify service worker
 * - App shell: cache-first for hashed /assets/*, network-first for HTML.
 * - API GETs: network-first, cache fallback, so the app opens offline with the
 *   last data but never shows stale data after a write while online.
 * - API writes to /api/v1/transactions while offline: queued in IndexedDB,
 *   replayed on reconnect with the page's current token.
 * - Share target: POST /import/share stores the CSV and redirects to /import?shared=1.
 * - "clear-user-data" (sent on logout) drops cached API data and the outbox.
 */
const VERSION = "luxe-v1";
const SHELL = `shell-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const API = `api-${VERSION}`;
const SHELL_URLS = ["/", "/index.html", "/manifest.webmanifest", "/favicon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_URLS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keep = new Set([SHELL, ASSETS, API]);
    for (const k of await caches.keys()) if (!keep.has(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

// ---------- IndexedDB outbox ----------
function db() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("ledgerify", 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore("outbox", { keyPath: "id", autoIncrement: true });
      r.result.createObjectStore("shared");
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const out = fn(t.objectStore(store));
    t.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
    t.onerror = () => rej(t.error);
  });
}
async function outboxCount() { return tx("outbox", "readonly", (s) => s.count()); }
async function notifyClients(type, payload) {
  for (const c of await self.clients.matchAll({ includeUncontrolled: true })) c.postMessage({ type, ...payload });
}

let flushing = null;
function flushOutbox(token) {
  // Serialise flushes: "online", Background Sync and a manual flush can race.
  flushing = (flushing || Promise.resolve()).then(() => doFlush(token)).catch(() => {});
  return flushing;
}
async function doFlush(token) {
  const items = await tx("outbox", "readonly", (s) => s.getAll());
  for (const it of items || []) {
    const headers = { ...it.headers };
    if (token) headers["authorization"] = `Bearer ${token}`;
    let res;
    try { res = await fetch(it.url, { method: it.method, headers, body: it.body }); }
    catch { break; } // still offline
    // An expired token is not a bad request: keep the item until the user signs in again.
    if (res.status === 401 || res.status === 403) break;
    // 2xx = synced; other 4xx = the server rejected it and a retry cannot help.
    if (res.ok || (res.status >= 400 && res.status < 500)) {
      await tx("outbox", "readwrite", (s) => s.delete(it.id));
      if (!res.ok) await notifyClients("outbox-rejected", { status: res.status });
    } else break; // 5xx: retry later
  }
  await notifyClients("outbox", { count: await outboxCount() });
}

async function clearUserData() {
  await caches.delete(API);
  await tx("outbox", "readwrite", (s) => s.clear());
  await notifyClients("outbox", { count: 0 });
}

self.addEventListener("sync", (e) => { if (e.tag === "ledgerify-outbox") e.waitUntil(flushOutbox()); });
self.addEventListener("message", (e) => {
  const m = e.data || {};
  if (m.type === "flush-outbox") e.waitUntil(flushOutbox(m.token));
  else if (m.type === "outbox-count") e.waitUntil(outboxCount().then((count) => notifyClients("outbox", { count })));
  else if (m.type === "clear-user-data") e.waitUntil(clearUserData());
});

// ---------- Fetch ----------
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Share target
  if (url.pathname === "/import/share" && req.method === "POST") {
    e.respondWith((async () => {
      const form = await req.formData();
      const file = form.get("file");
      if (file) await tx("shared", "readwrite", (s) => s.put(file, "latest"));
      return Response.redirect("/import?shared=1", 303);
    })());
    return;
  }

  // Never touch auth, MCP, or file transfers.
  if (/^\/api\/v1\/(mcp|auth|import|export)/.test(url.pathname)) return;

  // Offline writes → outbox (transactions only; other entities need online)
  if (url.pathname.startsWith("/api/v1/transactions") && req.method !== "GET") {
    e.respondWith((async () => {
      try { return await fetch(req.clone()); }
      catch {
        const body = await req.clone().text();
        const headers = {};
        req.headers.forEach((v, k) => { headers[k] = v; });
        await tx("outbox", "readwrite", (s) => s.add({ url: req.url, method: req.method, headers, body, at: Date.now() }));
        try { await self.registration.sync.register("ledgerify-outbox"); } catch {}
        await notifyClients("outbox", { count: await outboxCount() });
        return new Response(JSON.stringify({ queued: true }), { status: 202, headers: { "Content-Type": "application/json" } });
      }
    })());
    return;
  }

  if (req.method !== "GET") return;

  // API reads: network-first, cached copy only when the network fails.
  if (url.pathname.startsWith("/api/")) {
    e.respondWith((async () => {
      const cache = await caches.open(API);
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        return (await cache.match(req)) ||
          new Response(JSON.stringify({ error: "offline" }), { status: 503, headers: { "Content-Type": "application/json" } });
      }
    })());
    return;
  }

  // Hashed build assets: cache-first
  if (url.pathname.startsWith("/assets/")) {
    e.respondWith(caches.open(ASSETS).then(async (c) => (await c.match(req)) || fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; })));
    return;
  }

  // Navigations: network-first, fall back to cached shell
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((r) => {
      if (r.ok && (r.headers.get("content-type") || "").includes("text/html")) {
        const copy = r.clone();
        caches.open(SHELL).then((c) => c.put("/index.html", copy));
      }
      return r;
    }).catch(() => caches.match("/index.html")));
  }
});
