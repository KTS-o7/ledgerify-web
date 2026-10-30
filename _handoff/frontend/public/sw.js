/* Ledgerify service worker
 * - App shell: cache-first for hashed /assets/*, network-first for HTML.
 * - API GETs: stale-while-revalidate so the app opens offline with last data.
 * - API writes while offline: queued in IndexedDB, replayed on reconnect.
 * - Share target: POST /import/share stores the CSV and redirects to /import?shared=1.
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

async function flushOutbox() {
  const items = await tx("outbox", "readonly", (s) => s.getAll());
  for (const it of items || []) {
    try {
      const res = await fetch(it.url, { method: it.method, headers: it.headers, body: it.body });
      if (res.ok || (res.status >= 400 && res.status < 500)) await tx("outbox", "readwrite", (s) => s.delete(it.id));
    } catch { break; }
  }
  await notifyClients("outbox", { count: await outboxCount() });
}

self.addEventListener("sync", (e) => { if (e.tag === "ledgerify-outbox") e.waitUntil(flushOutbox()); });
self.addEventListener("message", (e) => { if (e.data === "flush-outbox") e.waitUntil(flushOutbox()); });

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

  // Never cache SSE / MCP / auth
  if (url.pathname.startsWith("/api/v1/mcp") || url.pathname.startsWith("/api/v1/auth")) return;

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

  // API reads: stale-while-revalidate
  if (url.pathname.startsWith("/api/")) {
    e.respondWith((async () => {
      const cache = await caches.open(API);
      const cached = await cache.match(req);
      const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
      return cached || (await net) || new Response(JSON.stringify({ error: "offline" }), { status: 503, headers: { "Content-Type": "application/json" } });
    })());
    return;
  }

  // Hashed build assets: cache-first
  if (url.pathname.startsWith("/assets/")) {
    e.respondWith(caches.open(ASSETS).then(async (c) => (await c.match(req)) || fetch(req).then((r) => { c.put(req, r.clone()); return r; })));
    return;
  }

  // Navigations: network-first, fall back to cached shell
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((r) => { caches.open(SHELL).then((c) => c.put("/index.html", r.clone())); return r; })
      .catch(() => caches.match("/index.html")));
  }
});
