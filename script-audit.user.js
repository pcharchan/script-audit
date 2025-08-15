// ==UserScript==
// @name         Script Audit (async/defer) - panel + włącz/wyłącz
// @namespace    https://seekio.pl
// @version      1.0.0
// @description  Podgląd wszystkich <script> na stronie (src, async, defer, module, rozmiar, czas). Panel + przycisk + globalne Włącz/Wyłącz
// @author       pcharchan
// @license      MIT
// @match        http*://*/*
// @run-at       document-idle
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @updateURL    https://raw.githubusercontent.com/pcharchan/script-audit/main/script-audit.user.js
// @downloadURL  https://raw.githubusercontent.com/pcharchan/script-audit/main/script-audit.user.js
// ==/UserScript==

(() => {
  'use strict';

  const KEY_ENABLED = 'script_audit_enabled';
  const enabled = GM_getValue(KEY_ENABLED, true);

  GM_registerMenuCommand(enabled ? 'Wyłącz audyt skryptów' : 'Włącz audyt skryptów', () => {
    GM_setValue(KEY_ENABLED, !enabled);
    location.reload();
  });

  if (!enabled) return;

  GM_addStyle(`
#sa-btn{position:fixed;z-index:2147483646;right:16px;bottom:16px;background:#111;color:#fff;border-radius:8px;padding:8px 10px;font:20px/1.2 system-ui,Segoe UI,Roboto;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.2);user-select:none}
#sa-btn:hover{background:#fff;color:#000}
#sa-panel{position:fixed;z-index:2147483647;right:16px;bottom:64px;width:min(840px,95vw);max-height:70vh;background:#fff;color:#111;border:1px solid #ddd;border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,.25);display:none;flex-direction:column;overflow:hidden}
#sa-header{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#f6f7f9;border-bottom:1px solid #e5e7eb}
#sa-header .title{font-weight:600}
#sa-actions{display:flex;gap:8px}
#sa-actions button{border:1px solid #d1d5db;background:#fff;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px}
#sa-actions button:hover{background:#f3f4f6}
#sa-table{width:100%;border-collapse:collapse;font:12px/1.4 ui-monospace,Menlo,Consolas,monospace}
#sa-table th,#sa-table td{padding:6px 8px;border-bottom:1px solid #eee;vertical-align:top}
#sa-table th{position:sticky;top:0;background:#fff;z-index:1}
#sa-panel .muted{opacity:.7}
.bad{background:#fff5f5}
.good{background:#f3fff3}
.tag{display:inline-block;font-size:10px;padding:2px 6px;border-radius:999px;border:1px solid #ccc;margin-left:6px}
.tag.bad{border-color:#f00;color:#b00000}
.tag.good{border-color:#16a34a;color:#166534}
.url{max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  `);

  const btn = document.createElement('div');
  btn.id = 'sa-btn';
  btn.title = 'Pokaż audyt skryptów';
  btn.textContent = 'JS';
  document.documentElement.appendChild(btn);

  const panel = document.createElement('div');
  panel.id = 'sa-panel';
  panel.innerHTML = `
    <div id="sa-header">
      <div class="title">Info:<span class="muted" id="sa-summary"></span></div>
      <div id="sa-actions">
        <button id="sa-refresh">Odśwież</button>
        <button id="sa-copy">Kopiuj JSON</button>
        <button id="sa-disable">Wyłącz</button>
        <button id="sa-close">Zamknij</button>
      </div>
    </div>
    <div style="overflow:auto">
      <table id="sa-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Źródło</th>
            <th>Atrybuty</th>
            <th>Typ</th>
            <th>Domena</th>
            <th>Rozmiar (KB)</th>
            <th>Czas (ms)</th>
            <th>Uwagi</th>
          </tr>
        </thead>
        <tbody id="sa-tbody"></tbody>
      </table>
    </div>`;
  document.documentElement.appendChild(panel);

  btn.addEventListener('click', () => {
    panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
    if (panel.style.display === 'flex') refresh();
  });

  panel.querySelector('#sa-close').addEventListener('click', () => {
    panel.style.display = 'none';
  });

  panel.querySelector('#sa-disable').addEventListener('click', () => {
    GM_setValue(KEY_ENABLED, false);
    alert('Skrypt wyłączony. Użyj menu i włącz ponownie');
    panel.remove(); btn.remove();
  });

  panel.querySelector('#sa-refresh').addEventListener('click', refresh);
  panel.querySelector('#sa-copy').addEventListener('click', () => {
    const json = JSON.stringify(collect(), null, 2);
    try {
      if (typeof GM_setClipboard === 'function') GM_setClipboard(json, 'text');
      else if (navigator.clipboard) navigator.clipboard.writeText(json);
      toast('JSON skopiowany do schowka');
    } catch {
      alert('Nie udało się skopiować');
    }
  });

  function toast(msg) {
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;right:20px;bottom:20px;background:#111;color:#fff;padding:8px 10px;border-radius:8px;z-index:999;opacity:0;transition:opacity .2s';
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.style.opacity = '1');
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 250); }, 1200);
  }

  function getPerfMap() {
    const entries = performance.getEntriesByType('resource').filter(e => e.initiatorType === 'script');
    const map = new Map();
    for (const e of entries) map.set(e.name, e);
    return map;
  }

  function truncateUrl(u) {
    try {
      const url = new URL(u);
      const path = url.pathname.length > 40 ? url.pathname.slice(0, 37) + '…' : url.pathname;
      const qs = url.search ? '?' + (url.search.length > 20 ? url.search.slice(1, 18) + '…' : url.search.slice(1)) : '';
      return url.host + path + qs;
    } catch { return u; }
  }

  function collect() {
    const perf = getPerfMap();
    return Array.from(document.scripts).map((s, i) => {
      const src = s.src || '';
      const isModule = s.type === 'module';
      const blockingCandidate = !!(src && !s.async && !s.defer && !isModule);
      const e = src ? perf.get(src) : undefined;
      const sizeKB = e && e.transferSize > 0 ? +(e.transferSize / 1024).toFixed(1) : null;
      const durationMs = e ? Math.round(e.duration) : null;
      let host = 'inline';
      if (src) { try { host = new URL(src).host; } catch {} }
      return {
        index: i + 1,
        src: src || '[inline]',
        type: s.type || 'classic',
        async: !!s.async,
        defer: !!s.defer,
        module: isModule,
        crossorigin: s.crossOrigin || '',
        integrity: s.integrity || '',
        host,
        sizeKB,
        durationMs,
        blockingCandidate
      };
    });
  }

  function refresh() {
    const data = collect();
    const tbody = panel.querySelector('#sa-tbody');
    tbody.innerHTML = '';
    const summary = panel.querySelector('#sa-summary');
    const total = data.length;
    const blocking = data.filter(d => d.blockingCandidate).length;
    const modules = data.filter(d => d.module).length;
    summary.textContent = ` skrypty: ${total} • potencjalnie blokujące: ${blocking} • module: ${modules}`;

    for (const d of data) {
      const tr = document.createElement('tr');
      if (d.blockingCandidate) tr.classList.add('bad');
      const attrs = [];
      if (d.async) attrs.push('async');
      if (d.defer) attrs.push('defer');
      if (d.module) attrs.push('module');
      if (!attrs.length) attrs.push('—');
      const urlCell = d.src === '[inline]'
        ? '<span class="muted">[inline]</span>'
        : `<span class="url" title="${d.src}">${truncateUrl(d.src)}</span>`;
      const note = d.blockingCandidate ? '<span class="tag bad">blokuje?</span>' : '<span class="tag good">OK!</span>';

      tr.innerHTML = `
        <td>${d.index}</td>
        <td>${urlCell}</td>
        <td>${attrs.join(', ')}</td>
        <td>${d.type || 'classic'}</td>
        <td>${d.host}</td>
        <td>${d.sizeKB != null ? d.sizeKB : '—'}</td>
        <td>${d.durationMs != null ? d.durationMs : '—'}</td>
        <td>${note}</td>
      `;
      tbody.appendChild(tr);
    }
  }
})();
