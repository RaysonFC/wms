/* ============================================================
   WMS ANALÍTICO — wms_helpers.js  [v2.1]
   Funções utilitárias compartilhadas + exportação
   ============================================================ */

/* ── Column finder ── */
function findCol(headers, keys) {
  const lc = headers.map(h => String(h ?? '').toLowerCase().trim().replace(/[\s\-\.]/g, '_'));
  for (const k of keys) { const i = lc.findIndex(h => h === k);         if (i !== -1) return i; }
  for (const k of keys) { const i = lc.findIndex(h => h.startsWith(k)); if (i !== -1) return i; }
  for (const k of keys) { const i = lc.findIndex(h => h.includes(k));   if (i !== -1) return i; }
  return -1;
}

function num(v) {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

function fmt(v, dash = true) {
  if (dash && (v === null || v === undefined || v === '')) return '<span class="val-empty">—</span>';
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtNum(v) {
  if (v === null) return '<span class="val-empty">—</span>';
  const cls = v < CRITICAL ? 'val-critical' : v < CRITICAL * WARN_MULT ? 'val-warn' : 'val-ok';
  return `<span class="${cls}">${fmt(v, false)}</span>`;
}

function saldoStatus(v) {
  if (v === null || v === undefined) return '<span class="val-empty">—</span>';
  if (v < CRITICAL)              return `<span class="transfer-priority priority-urgent">● CRÍTICO</span>`;
  if (v < CRITICAL * WARN_MULT)  return `<span class="transfer-priority priority-high">◐ ATENÇÃO</span>`;
  return                                `<span class="transfer-priority priority-normal">○ OK</span>`;
}

function cdBadge(cd) {
  const c = String(cd ?? '').trim();
  const cls = c === '1' ? 'cd-1' : c === '3' ? 'cd-3' : c === '6' ? 'cd-6' : c === '7' ? 'cd-7' : 'cd-x';
  return `<span class="cd-badge ${cls}">CD ${c || '?'}</span>`;
}

function cdClass(cd) {
  return cd === '1' ? 'cd-1' : cd === '3' ? 'cd-3' : cd === '6' ? 'cd-6' : cd === '7' ? 'cd-7' : 'cd-x';
}

function priorityBadge(p) {
  const cls = p === 'URGENTE' ? 'priority-urgent' : p === 'ALTO' ? 'priority-high' : 'priority-normal';
  const dot = p === 'URGENTE' ? '▲' : p === 'ALTO' ? '◐' : '○';
  return `<span class="transfer-priority ${cls}">${dot} ${p}</span>`;
}

function priorityOrder(p) {
  return p === 'URGENTE' ? 0 : p === 'ALTO' ? 1 : 2;
}

function sortData(data, col, dir) {
  if (!col) return data;
  return [...data].sort((a, b) => {
    let va = a[col], vb = b[col];
    if (col === 'prioridade') { va = priorityOrder(va); vb = priorityOrder(vb); }
    if (va === null || va === undefined) va = typeof vb === 'number' ? -Infinity : '';
    if (vb === null || vb === undefined) vb = typeof va === 'number' ? -Infinity : '';
    if (typeof va === 'number') return (va - vb) * dir;
    return String(va).localeCompare(String(vb)) * dir;
  });
}

function renderPagination(id, total, currentPage, onPage) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const el = document.getElementById(id);
  if (totalPages <= 1) {
    el.innerHTML = `<span class="page-info">${total.toLocaleString('pt-BR')} registros</span>`;
    return;
  }
  const start = (currentPage - 1) * PAGE_SIZE + 1;
  const end   = Math.min(currentPage * PAGE_SIZE, total);
  const pages = [...new Set(
    [1, totalPages, currentPage, currentPage - 1, currentPage - 2, currentPage + 1, currentPage + 2]
      .filter(p => p >= 1 && p <= totalPages)
  )].sort((a, b) => a - b);

  let html = `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="(${onPage})(${currentPage - 1})">‹</button>`;
  html += `<span class="page-info">${start}–${end} / ${total.toLocaleString('pt-BR')}</span>`;
  let prev = 0;
  for (const p of pages) {
    if (p - prev > 1) html += `<span class="page-info">…</span>`;
    html += `<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="(${onPage})(${p})">${p}</button>`;
    prev = p;
  }
  html += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="(${onPage})(${currentPage + 1})">›</button>`;
  el.innerHTML = html;
}

function updateSortHeaders(tableId, sortState) {
  document.querySelectorAll(`#${tableId} th.sortable`).forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.col === sortState.col) {
      th.classList.add(sortState.dir === 1 ? 'sort-asc' : 'sort-desc');
    }
  });
}

/* ═══════════════════════════════════════════════
   TOAST SYSTEM
═══════════════════════════════════════════════ */
function showToast(msg, type = 'success', duration = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icon = type === 'success' ? '✔' : type === 'error' ? '✖' : 'ℹ';
  toast.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ═══════════════════════════════════════════════
   EXPORT ENGINE
   Gera CSV com BOM UTF-8 para Excel Brasil
═══════════════════════════════════════════════ */

/** Escapa campo para CSV (separador ponto-e-vírgula) */
function csvEscape(v) {
  const s = String(v ?? '');
  if (s.includes(';') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/** Baixa blob como arquivo */
function downloadBlob(content, filename, mime = 'text/csv;charset=utf-8;') {
  const BOM  = '\uFEFF';
  const blob = new Blob([BOM + content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`${filename} baixado com sucesso.`, 'success');
}

/** Exporta estoque geral (filtrado ou completo) */
function exportEstoqueCSV(filtered = false) {
  const data  = filtered ? getEstoqueFiltered() : WMS_DATA;
  const rows  = [
    ['Cód Material', 'Descrição', 'CD', 'Armazém', 'Desc Armazém', 'Saldo', 'Disponível', 'A Devolver', 'Status'].join(';'),
    ...data.map(r => [
      r.cd_material, r.desc_material, r.cd, r.cd_centro_armaz,
      r.desc_armaz, r.saldo, r.disponivel, r.devolver ?? '',
      r.disponivel < CRITICAL ? 'CRÍTICO' : r.disponivel < CRITICAL * WARN_MULT ? 'ATENÇÃO' : 'OK'
    ].map(csvEscape).join(';'))
  ];
  const suffix = filtered ? '_filtrado' : '_completo';
  const date   = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
  downloadBlob(rows.join('\n'), `estoque${suffix}_${date}.csv`);
}

/** Exporta sugestões de transferência */
function exportTransferCSV(filtered = false) {
  const data  = filtered ? getTransferFiltered() : TRANSFER_DATA;
  const rows  = [
    ['Cód Material','Descrição','CD Destino','ARM Destino','Saldo Destino','Disponível Destino','CD Origem','ARM Origem','Saldo Origem','Disponível Origem','Qtd Sugerida','Prioridade'].join(';'),
    ...data.map(r => [
      r.cd_material, r.desc_material,
      r.cd_destino, r.armaz_destino, r.saldo_destino, r.disponivel_destino,
      r.cd_origem,  r.armaz_origem,  r.saldo_origem,  r.disponivel_origem,
      r.qtd_sugerida, r.prioridade
    ].map(csvEscape).join(';'))
  ];
  const suffix = filtered ? '_filtrado' : '_completo';
  const date   = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
  downloadBlob(rows.join('\n'), `transferencias${suffix}_${date}.csv`);
}

/** Exporta comparativo CD1×3×7 */
function exportComp1CSV() {
  const rows = [
    ['Cód Material','Descrição','Saldo CD1','Saldo CD3','Saldo CD7','Total','Status'].join(';'),
    ...comp1All.map(r => {
      const hasCrit = [r.v_cd1, r.v_cd3, r.v_cd7].some(v => v !== null && v < CRITICAL);
      return [
        r.cd_material, r.desc_material,
        r.v_cd1 ?? '', r.v_cd3 ?? '', r.v_cd7 ?? '', r.total,
        hasCrit ? 'CRÍTICO' : 'OK'
      ].map(csvEscape).join(';');
    })
  ];
  const date = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
  downloadBlob(rows.join('\n'), `comp_cd1x3x7_${date}.csv`);
}

/** Exporta comparativo CD1×6 ARM28 */
function exportComp2CSV() {
  const rows = [
    ['Cód Material','Descrição','Saldo CD1 ARM28','Saldo CD6 ARM28','Total','Status'].join(';'),
    ...comp2All.map(r => {
      const hasCrit = [r.v_cd1, r.v_cd6].some(v => v !== null && v < CRITICAL);
      return [
        r.cd_material, r.desc_material,
        r.v_cd1 ?? '', r.v_cd6 ?? '', r.total,
        hasCrit ? 'CRÍTICO' : 'OK'
      ].map(csvEscape).join(';');
    })
  ];
  const date = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
  downloadBlob(rows.join('\n'), `comp_cd1x6_arm28_${date}.csv`);
}

/** Exporta resumo geral consolidado */
function exportResumoCSV() {
  const urgentes = TRANSFER_DATA.filter(r => r.prioridade === 'URGENTE').length;
  const altos    = TRANSFER_DATA.filter(r => r.prioridade === 'ALTO').length;
  const criticos = WMS_DATA.filter(r => r.disponivel < CRITICAL).length;
  const atencao  = WMS_DATA.filter(r => r.disponivel >= CRITICAL && r.disponivel < CRITICAL * WARN_MULT).length;

  const linhas = [
    ['RESUMO WMS ANALÍTICO', ''].join(';'),
    ['Gerado em', new Date().toLocaleString('pt-BR')].join(';'),
    ['', ''].join(';'),
    ['ESTOQUE', ''].join(';'),
    ['Total de itens', WMS_DATA.length].join(';'),
    ['Itens críticos (< 200 disponível)', criticos].join(';'),
    ['Itens em atenção (200–300 disponível)', atencao].join(';'),
    ['', ''].join(';'),
    ['TRANSFERÊNCIAS', ''].join(';'),
    ['Total de sugestões', TRANSFER_DATA.length].join(';'),
    ['Urgentes', urgentes].join(';'),
    ['Alto', altos].join(';'),
    ['Normal', TRANSFER_DATA.length - urgentes - altos].join(';'),
    ['', ''].join(';'),
    ['ITENS SEM ESTOQUE (armazéns elegíveis)', ZERO_STOCK_DATA.length].join(';'),
  ];
  const date = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
  downloadBlob(linhas.join('\n'), `resumo_wms_${date}.csv`);
}

/** Copia dados de transferência filtrados para clipboard como TSV (cola no Excel) */
async function copyTransferToClipboard() {
  const data = getTransferFiltered();
  if (!data.length) { showToast('Sem dados para copiar.', 'error'); return; }

  const header = ['Cód Material','Descrição','CD Destino','ARM Destino','Saldo Destino','Disponível Destino',
                  'CD Origem','ARM Origem','Saldo Origem','Disponível Origem','Qtd Sugerida','Prioridade'].join('\t');
  const rows   = data.map(r =>
    [r.cd_material, r.desc_material, r.cd_destino, r.armaz_destino, r.saldo_destino, r.disponivel_destino,
     r.cd_origem, r.armaz_origem, r.saldo_origem, r.disponivel_origem, r.qtd_sugerida, r.prioridade].join('\t')
  );
  const tsv = [header, ...rows].join('\n');

  try {
    await navigator.clipboard.writeText(tsv);
    showToast(`${data.length} linhas copiadas para área de transferência.`, 'success');
  } catch {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = tsv;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast(`${data.length} linhas copiadas.`, 'success');
  }
}
