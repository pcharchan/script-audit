// ==UserScript==
// @name         Script Audit (async/defer) - v2.1
// @namespace    https://seekio.pl/blog/
// @version      2.1.1
// @description  Podgląd <script> na stronie (src, async, defer, rozmiar, czas). Ruchomy i skalowalny panel, sortowanie, kopiowanie JSON/CSV.
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
    #sa-btn { position: fixed; z-index: 2147483646; right: 16px; bottom: 16px; background: #111; color: #fff; border-radius: 8px; padding: 8px 10px; font: 20px/1.2 system-ui, Segoe UI, Roboto; cursor: pointer; box-shadow: 0 6px 18px rgba(0,0,0,.2); user-select: none; transition: background .2s, color .2s; }
    #sa-btn:hover { background: #fff; color: #000; }
    #sa-panel { position: fixed; z-index: 2147483647; right: 16px; bottom: 64px; width: min(850px, 95vw); height: 50vh; min-width: 400px; min-height: 200px; background: #fff; color: #111; border: 1px solid #ddd; border-radius: 10px; box-shadow: 0 12px 30px rgba(0,0,0,.25); display: none; flex-direction: column; overflow: hidden; resize: both; }
    #sa-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: #f6f7f9; border-bottom: 1px solid #e5e7eb; cursor: move; user-select: none; }
    #sa-header .title { font-weight: 600; }
    #sa-actions { display: flex; gap: 8px; }
    #sa-actions button { border: 1px solid #d1d5db; background: #fff; color: #000; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 12px; }
    #sa-actions button:hover { background: #f3f4f6; }
    #sa-table-wrapper { flex-grow: 1; overflow: auto; }
    #sa-table { width: 100%; border-collapse: collapse; font: 12px/1.4 ui-monospace, Menlo, Consolas, monospace; }
    #sa-table th, #sa-table td { padding: 6px 8px; border-bottom: 1px solid #eee; text-align: left; vertical-align: top; }
    #sa-table th { position: sticky; top: 0; background: #fff; z-index: 1; cursor: pointer; white-space: nowrap; }
    #sa-table th:hover { background: #f5f5f5; }
    #sa-table th .sort-icon { display: inline-block; width: 1em; text-align: center; opacity: 0.4; }
    #sa-table th.sorted .sort-icon { opacity: 1; }
    #sa-panel .muted { opacity: .7; }
    .bad { background-color: #fff5f5 !important; }
    .good { background-color: #f3fff3; }
    .first-party { background-color: #eaf6ff; }
    .tag { display: inline-block; font-size: 10px; padding: 2px 6px; border-radius: 999px; border: 1px solid #ccc; margin-left: 6px; }
    .tag.bad { border-color: #f00; color: #b00000; }
    .tag.good { border-color: #16a34a; color: #166534; }
    .url { display: block; max-width: 420px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .col-resized .url { max-width: none; white-space: normal; word-break: break-all; }
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
        <button id="sa-copy-json">Kopiuj JSON</button>
        <button id="sa-copy-csv">Kopiuj CSV</button>
        <button id="sa-disable">Wyłącz</button>
        <button id="sa-close">Zamknij</button>
      </div>
    </div>
    <div id="sa-table-wrapper">
      <table id="sa-table">
        <thead>
          <tr>
            <th data-sort="index">#<span class="sort-icon"></span></th>
            <th data-sort="src">Źródło<span class="sort-icon"></span></th>
            <th data-sort="attrs">Atrybuty<span class="sort-icon"></span></th>
            <th data-sort="type">Typ<span class="sort-icon"></span></th>
            <th data-sort="host">Domena<span class="sort-icon"></span></th>
            <th data-sort="sizeKB">Rozmiar (KB)<span class="sort-icon"></span></th>
            <th data-sort="durationMs">Czas (ms)<span class="sort-icon"></span></th>
            <th data-sort="notes">Uwagi<span class="sort-icon"></span></th>
          </tr>
        </thead>
        <tbody id="sa-tbody"></tbody>
      </table>
    </div>`;
  document.documentElement.appendChild(panel);

  const header = panel.querySelector('#sa-header');
  const tableWrapper = panel.querySelector('#sa-table-wrapper');
  let allData = [];
  let sortState = { key: 'index', order: 'asc' };
  const getPerfMap = () => {
    const entries = performance.getEntriesByType('resource').filter(e => e.initiatorType === 'script');
    return new Map(entries.map(e => [e.name, e]));
  };

  const collect = () => {
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
      const attrs = [];
      if(s.async) attrs.push('async');
      if(s.defer) attrs.push('defer');
      if(isModule) attrs.push('module');
      return {
        index: i + 1,
        src: src || '[inline]',
        type: s.type || 'classic',
        async: !!s.async,
        defer: !!s.defer,
        module: isModule,
        host,
        sizeKB,
        durationMs,
        blockingCandidate,
        isFirstParty: host === window.location.host,
        attrs: attrs.length > 0 ? attrs.join(', ') : '—',
        notes: blockingCandidate ? 'blokuje?' : 'OK!'
      };
    });
  };

  const refresh = () => {
    allData = collect();
    renderTable();
  };

  const renderTable = () => {
    const sortedData = [...allData].sort((a, b) => {
        let valA = a[sortState.key];
        let valB = b[sortState.key];

        if (typeof valA === 'string') {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
        }

        if (typeof valA === 'number' || valA === null) valA = valA || -1;
        if (typeof valB === 'number' || valB === null) valB = valB || -1;

        if (valA < valB) return sortState.order === 'asc' ? -1 : 1;
        if (valA > valB) return sortState.order === 'asc' ? 1 : -1;
        return 0;
    });

    const summary = panel.querySelector('#sa-summary');
    const total = allData.length;
    const blocking = allData.filter(d => d.blockingCandidate).length;
    const modules = allData.filter(d => d.module).length;
    summary.textContent = ` skrypty: ${total} • potencjalnie blokujące: ${blocking} • module: ${modules}`;
    panel.querySelectorAll('#sa-table th').forEach(th => {
        th.classList.remove('sorted', 'asc', 'desc');
        const icon = th.querySelector('.sort-icon');
        icon.textContent = '';
        if (th.dataset.sort === sortState.key) {
            th.classList.add('sorted', sortState.order);
            icon.textContent = sortState.order === 'asc' ? '▲' : '▼';
        }
    });

    const tbody = panel.querySelector('#sa-tbody');
    tbody.innerHTML = '';
    for (const d of sortedData) {
      const tr = document.createElement('tr');

      if (d.blockingCandidate) {
        tr.classList.add('bad');
      } else if (d.isFirstParty && d.host !== 'inline') {
        tr.classList.add('first-party');
      }

      const urlCell = d.src === '[inline]'
        ? '<span class="muted">[inline]</span>'
        : `<span class="url" title="${d.src}">${d.src}</span>`;
      const note = d.blockingCandidate ? '<span class="tag bad">blokuje?</span>' : '<span class="tag good">OK!</span>';

      tr.innerHTML = `
        <td>${d.index}</td>
        <td>${urlCell}</td>
        <td>${d.attrs}</td>
        <td>${d.type || 'classic'}</td>
        <td>${d.host}</td>
        <td>${d.sizeKB != null ? d.sizeKB : '—'}</td>
        <td>${d.durationMs != null ? d.durationMs : '—'}</td>
        <td>${note}</td>
      `;
      tbody.appendChild(tr);
    }
  };

    btn.addEventListener('click', () => {
    const isVisible = panel.style.display === 'flex';
    panel.style.display = isVisible ? 'none' : 'flex';
    if (!isVisible) refresh();
  });

  panel.querySelector('#sa-close').addEventListener('click', () => panel.style.display = 'none');
  panel.querySelector('#sa-disable').addEventListener('click', () => {
    GM_setValue(KEY_ENABLED, false);
    alert('Skrypt wyłączony. Użyj menu rozszerzenia, aby włączyć go ponownie');
    panel.remove(); btn.remove();
  });

  panel.querySelector('#sa-refresh').addEventListener('click', refresh);

  const copyHandler = (formatter, type) => {
    const text = formatter(allData);
    try {
      if (typeof GM_setClipboard === 'function') GM_setClipboard(text, 'text');
      else if (navigator.clipboard) navigator.clipboard.writeText(text);
      toast(`${type} skopiowany do schowka`);
    } catch {
      alert('Nie udało się skopiować!');
    }
  };

  panel.querySelector('#sa-copy-json').addEventListener('click', () => {
      copyHandler(data => JSON.stringify(data, null, 2), 'JSON');
  });

  panel.querySelector('#sa-copy-csv').addEventListener('click', () => {
      copyHandler(data => {
          if (data.length === 0) return '';
          const headers = Object.keys(data[0]);
          const csvRows = [
              headers.join('\t'),
              ...data.map(row => headers.map(header => JSON.stringify(row[header])).join('\t'))
          ];
          return csvRows.join('\n');
      }, 'CSV');
  });

  panel.querySelectorAll('#sa-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (sortState.key === key) {
            sortState.order = sortState.order === 'asc' ? 'desc' : 'asc';
        } else {
            sortState.key = key;
            sortState.order = 'asc';
        }
        renderTable();
    });
  });

  const toast = (msg) => {
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed; right:20px; bottom:70px; background:#111; color:#fff; padding:8px 12px; border-radius:8px; z-index:2147483647; opacity:0; transition:opacity .2s; pointer-events:none;';
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.style.opacity = '1');
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 250); }, 1500);
  }

  const makeDraggable = (el, handle) => {
      handle.addEventListener('mousedown', e => {
          if (e.target.tagName === 'BUTTON') return;
          const startX = e.clientX;
          const startY = e.clientY;
          const startLeft = el.offsetLeft;
          const startTop = el.offsetTop;

          const onMouseMove = (e) => {
              el.style.left = `${startLeft + e.clientX - startX}px`;
              el.style.top = `${startTop + e.clientY - startY}px`;
          };

          const onMouseUp = () => {
              document.removeEventListener('mousemove', onMouseMove);
              document.removeEventListener('mouseup', onMouseUp);
              document.body.style.userSelect = '';
          };

          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
          document.body.style.userSelect = 'none';
      });
  };

  const makeResizable = (el) => {
  };

  const makeColsResizable = (table) => {
      const headers = table.querySelectorAll('th');
      headers.forEach(header => {
          const resizer = document.createElement('div');
          resizer.style.cssText = 'position:absolute; top:0; right:0; width:5px; height:100%; cursor:col-resize;';
          header.style.position = 'relative';
          header.appendChild(resizer);

          resizer.addEventListener('mousedown', (e) => {
              e.stopPropagation();
              const startX = e.clientX;
              const startWidth = header.offsetWidth;
              const colIndex = [...header.parentElement.children].indexOf(header);
              const cells = table.querySelectorAll(`tr td:nth-child(${colIndex + 1})`);

              const onMouseMove = (e) => {
                  const newWidth = startWidth + e.clientX - startX;
                  header.style.width = `${newWidth}px`;
                  header.classList.add('col-resized');
                  cells.forEach(cell => cell.classList.add('col-resized'));
              };

              const onMouseUp = () => {
                  document.removeEventListener('mousemove', onMouseMove);
                  document.removeEventListener('mouseup', onMouseUp);
                  document.body.style.userSelect = '';
              };

              document.addEventListener('mousemove', onMouseMove);
              document.addEventListener('mouseup', onMouseUp);
              document.body.style.userSelect = 'none';
          });
      });
  };

  makeDraggable(panel, header);
  makeResizable(panel);
  makeColsResizable(panel.querySelector('#sa-table'));

})();
