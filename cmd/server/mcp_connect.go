package main

import (
	"net/http"
)

// mcpConnectPage is a one-page HTML UI that helps the user generate an
// MCP config (Claude Desktop, Cursor, or CLI) for the running ledgerify
// instance. The page POSTs to /api/v1/auth/login, then displays the
// resulting bearer token alongside three ready-to-paste client configs.
//
// No build step: the HTML is inline, the SSE URL is derived from the
// page's own origin so the same page works in any environment.
const mcpConnectPage = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connect your AI client to Ledgerify</title>
<style>
  :root {
    --bg: #faf8f5;
    --fg: #1f1b16;
    --muted: #6b6258;
    --accent: #b45309;
    --border: #e7e1d8;
    --code-bg: #f1ede6;
    --success: #15803d;
    --error: #b91c1c;
  }
  * { box-sizing: border-box; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: var(--bg);
    color: var(--fg);
    margin: 0;
    line-height: 1.5;
  }
  .wrap { max-width: 760px; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
  h1 { font-size: 1.6rem; margin: 0 0 0.25rem; font-weight: 600; }
  .sub { color: var(--muted); margin: 0 0 1.5rem; }
  .card {
    background: white;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1.25rem;
    margin: 1rem 0;
  }
  h2 { font-size: 1.05rem; margin: 0 0 0.75rem; font-weight: 600; }
  label { display: block; font-size: 0.85rem; color: var(--muted); margin: 0.75rem 0 0.25rem; }
  input {
    width: 100%;
    padding: 0.55rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.95rem;
    font-family: inherit;
    background: white;
    color: var(--fg);
  }
  input:focus { outline: 2px solid var(--accent); outline-offset: -1px; border-color: var(--accent); }
  button {
    cursor: pointer;
    font-family: inherit;
    font-size: 0.9rem;
    padding: 0.55rem 0.9rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: white;
    color: var(--fg);
  }
  button:hover { background: var(--code-bg); }
  button.primary {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
    font-weight: 500;
  }
  button.primary:hover { background: #9a4408; }
  .token-row { display: flex; gap: 0.5rem; align-items: stretch; }
  .token-row input { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.8rem; }
  pre {
    background: var(--code-bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.75rem 0.9rem;
    overflow-x: auto;
    font-size: 0.78rem;
    line-height: 1.45;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    margin: 0 0 0.5rem;
    white-space: pre;
  }
  .copy-row { display: flex; gap: 0.5rem; align-items: flex-start; }
  .copy-row pre { flex: 1; margin: 0; }
  .badge {
    display: inline-block;
    background: var(--success);
    color: white;
    border-radius: 999px;
    padding: 0.15rem 0.6rem;
    font-size: 0.75rem;
    font-weight: 500;
    margin-left: 0.5rem;
    vertical-align: middle;
  }
  .err { color: var(--error); font-size: 0.85rem; margin: 0.5rem 0 0; }
  .muted { color: var(--muted); font-size: 0.85rem; }
  details { margin-top: 0.5rem; }
  details summary { cursor: pointer; color: var(--muted); font-size: 0.85rem; }
  .hidden { display: none; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Connect your AI client to Ledgerify</h1>
  <p class="sub">Log in once, get a bearer token, paste the config into Claude Desktop, Cursor, or the Claude Code CLI. The token expires in 7 days &mdash; come back and re-issue when needed.</p>

  <div class="card">
    <h2>1. Sign in</h2>
    <form id="login-form">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" autocomplete="email" required value="">
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required value="">
      <div style="margin-top: 1rem;">
        <button class="primary" type="submit" id="login-btn">Sign in &amp; generate token</button>
      </div>
      <p class="err hidden" id="err"></p>
    </form>
  </div>

  <div class="card hidden" id="token-card">
    <h2>2. Your MCP bearer token</h2>
    <p class="muted">Treat this like a password. It gives full read/write access to your books. Don't share it; revoke by changing your password.</p>
    <div class="token-row">
      <input id="token" type="text" readonly value="">
      <button data-copy-target="token">Copy</button>
    </div>
    <p class="muted">SSE endpoint: <code id="sse-url"></code></p>
    <p class="muted" style="margin-top: 0.75rem;">Already have a token that's about to expire? <a href="#" id="refresh-link">Paste it here to get a new one (no re-login needed)</a>.</p>
    <div id="refresh-form" class="hidden" style="margin-top: 0.75rem;">
      <div class="token-row">
        <input id="old-token" type="password" placeholder="Paste current (still-valid) bearer token">
        <button id="refresh-btn">Refresh</button>
      </div>
      <p class="err hidden" id="refresh-err"></p>
    </div>
  </div>

  <div class="card hidden" id="config-card">
    <h2>3. Paste into your AI client</h2>
    <p class="muted">The JSON snippets below are the exact contents of each client's MCP config file. Replace the existing <code>mcpServers</code> map (or add to it). The token is the same in all three.</p>

    <h2 style="margin-top: 1.25rem;">Claude Desktop</h2>
    <p class="muted">Config file: <code>~/Library/Application Support/Claude/claude_desktop_config.json</code> (macOS) or <code>%APPDATA%\\Claude\\claude_desktop_config.json</code> (Windows). Restart Claude Desktop after editing.</p>
    <div class="copy-row">
      <pre id="claude-desktop-cfg"></pre>
      <button data-copy-target="claude-desktop-cfg">Copy</button>
    </div>

    <h2 style="margin-top: 1.25rem;">Cursor</h2>
    <p class="muted">Settings &rarr; MCP &rarr; "Add new global MCP server" &rarr; paste the JSON below.</p>
    <div class="copy-row">
      <pre id="cursor-cfg"></pre>
      <button data-copy-target="cursor-cfg">Copy</button>
    </div>

    <h2 style="margin-top: 1.25rem;">Claude Code (CLI)</h2>
    <p class="muted">Run the command below in your terminal. It registers <code>ledgerify</code> as an MCP server in Claude Code.</p>
    <pre id="cli-cmd"></pre>
    <div class="copy-row" style="margin-top: 0.5rem;">
      <button data-copy-target="cli-cmd">Copy command</button>
    </div>
  </div>

  <div class="card hidden" id="user-card">
    <h2>Signed in as <span id="user-name"></span> <span class="badge" id="user-badge">connected</span></h2>
    <p class="muted">After pasting a config above, restart your client. It will see 55 tools across transactions, accounts, categories, budgets, investments, loans, insurance, savings goals, exchange rates, and the net-worth snapshot/trend tools.</p>
    <details>
      <summary>What can the agent do with these tools?</summary>
      <p style="margin-top: 0.5rem;">Once connected, an LLM agent can manage your net worth end-to-end through MCP: open accounts, log transactions, take out loans, mark EMIs paid, buy investments, set up insurance policies, set exchange rates, change your default currency, take net-worth snapshots, and ask for the running trend at any time. The only things left to the REST API or the SPA are auth (login/register), CSV bulk-import with LLM column-mapping, and direct UI access.</p>
    </details>
  </div>
</div>

<script>
(function () {
  var SSE_PATH = '/api/v1/mcp/sse';

  function deriveSseUrl() { return window.location.origin + SSE_PATH; }
  function show(id) { document.getElementById(id).classList.remove('hidden'); }
  function hide(id) { document.getElementById(id).classList.add('hidden'); }
  function setText(id, text) { document.getElementById(id).textContent = text; }
  function setValue(id, value) { document.getElementById(id).value = value; }
  function escapeJSON(obj) { return JSON.stringify(obj, null, 2); }

  function buildConfigs(token) {
    var sseUrl = deriveSseUrl();
    var headerValue = 'Bearer ' + token;
    var claudeDesktop = { mcpServers: { ledgerify: { url: sseUrl, headers: { Authorization: headerValue } } } };
    var cursor        = { mcpServers: { ledgerify: { url: sseUrl, headers: { Authorization: headerValue } } } };
    var cliCmd = 'claude mcp add --transport sse ledgerify ' + sseUrl + ' \\\n' +
                 '  --header "Authorization: ' + headerValue + '"';
    return { sseUrl: sseUrl, claudeDesktop: escapeJSON(claudeDesktop), cursor: escapeJSON(cursor), cli: cliCmd };
  }

  document.getElementById('login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = document.getElementById('login-btn');
    var errEl = document.getElementById('err');
    hide('err');
    btn.disabled = true;
    btn.textContent = 'Signing in...';

    var email = document.getElementById('email').value.trim();
    var password = document.getElementById('password').value;

    fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password })
    })
    .then(function (r) {
      if (!r.ok) {
        return r.json().then(function (j) { throw new Error((j && j.error) || ('HTTP ' + r.status)); });
      }
      return r.json();
    })
    .then(function (resp) {
      if (!resp.token) throw new Error('No token in response');
      var configs = buildConfigs(resp.token);
      setValue('token', resp.token);
      setText('sse-url', configs.sseUrl);
      setText('claude-desktop-cfg', configs.claudeDesktop);
      setText('cursor-cfg', configs.cursor);
      setText('cli-cmd', configs.cli);
      var user = resp.user || {};
      setText('user-name', user.name || user.email || email);
      show('token-card');
      show('config-card');
      show('user-card');
      window.scrollTo({ top: document.getElementById('token-card').offsetTop, behavior: 'smooth' });
    })
    .catch(function (err) {
      errEl.textContent = 'Login failed: ' + err.message;
      show('err');
    })
    .finally(function () {
      btn.disabled = false;
      btn.textContent = 'Sign in & generate token';
    });
  });

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-copy-target]');
    if (!btn) return;
    var target = document.getElementById(btn.getAttribute('data-copy-target'));
    if (!target) return;
    var text = target.value !== undefined ? target.value : target.textContent;
    navigator.clipboard.writeText(text).then(function () {
      var orig = btn.textContent;
      btn.textContent = 'Copied';
      btn.disabled = true;
      setTimeout(function () { btn.textContent = orig; btn.disabled = false; }, 1400);
    }).catch(function () { target.select && target.select(); });
  });

  // Refresh-token flow: paste an existing (still-valid) bearer
  // token, get a new one in return. Useful when the agent is
  // about to time out and the user wants to keep going without
  // re-entering their password.
  var refreshLink = document.getElementById('refresh-link');
  var refreshForm = document.getElementById('refresh-form');
  if (refreshLink) {
    refreshLink.addEventListener('click', function (e) {
      e.preventDefault();
      refreshForm.classList.toggle('hidden');
      if (!refreshForm.classList.contains('hidden')) {
        document.getElementById('old-token').focus();
      }
    });
  }
  var refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', function () {
      var errEl = document.getElementById('refresh-err');
      errEl.classList.add('hidden');
      refreshBtn.disabled = true;
      refreshBtn.textContent = 'Refreshing...';
      var oldToken = document.getElementById('old-token').value.trim();
      if (!oldToken) {
        errEl.textContent = 'Paste a token first.';
        errEl.classList.remove('hidden');
        refreshBtn.disabled = false;
        refreshBtn.textContent = 'Refresh';
        return;
      }
      fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + oldToken }
      })
      .then(function (r) {
        if (!r.ok) {
          return r.json().then(function (j) { throw new Error((j && j.error) || ('HTTP ' + r.status)); });
        }
        return r.json();
      })
      .then(function (resp) {
        // Splat the refreshed token into the existing display + configs
        // so the user can copy from anywhere.
        var configs = buildConfigs(resp.token);
        setValue('token', resp.token);
        setText('sse-url', configs.sseUrl);
        setText('claude-desktop-cfg', configs.claudeDesktop);
        setText('cursor-cfg', configs.cursor);
        setText('cli-cmd', configs.cli);
        if (resp.expires_at) {
          setText('user-name', (resp.user && (resp.user.name || resp.user.email)) || document.getElementById('user-name').textContent);
        }
        show('token-card');
        show('config-card');
        if (!document.getElementById('user-card').classList.contains('hidden') === false) show('user-card');
        document.getElementById('old-token').value = '';
        refreshForm.classList.add('hidden');
        errEl.textContent = '';
        errEl.classList.add('hidden');
        window.scrollTo({ top: document.getElementById('token-card').offsetTop, behavior: 'smooth' });
      })
      .catch(function (err) {
        errEl.textContent = 'Refresh failed: ' + err.message + ' (the token may have already expired — log in again)';
        errEl.classList.remove('hidden');
      })
      .finally(function () {
        refreshBtn.disabled = false;
        refreshBtn.textContent = 'Refresh';
      });
    });
  }
})();
</script>
</body>
</html>`

func mcpConnectHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	_, _ = w.Write([]byte(mcpConnectPage))
}
