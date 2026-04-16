/* ============================================================
   WMS ANALÍTICO — wms_helpers.js  [v3.1]
   DISPONIVEL é a fonte obrigatória em todo o app.
   ============================================================ */

/* ── Column finder ── */
function findCol(headers, keys) {
  const lc = headers.map(h => String(h ?? '').toLowerCase().trim().replace(/[\s\-\.]/g, '_'));
  for (const k of keys) { const i = lc.findIndex(h => h === k);         if (i !== -1) return i; }
  for (const k of keys) { const i = lc.findIndex(h => h.startsWith(k)); if (i !== -1) return i; }
  for (const k of keys) { const i = lc.findIndex(h => h.includes(k));   if (i !== -1) return i; }
  return -1;
}

/* ── Conversão numérica ── */
// numInt → saldo fisico (sempre inteiro)
function numInt(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : Math.round(v);
  const s = String(v).trim();
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s))
    return Math.round(parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0);
  if (/^\d+(,\d+)?$/.test(s))
    return Math.round(parseFloat(s.replace(',', '.')) || 0);
  return Math.round(parseFloat(s) || 0);
}

// numDec → disponivel (preserva ate 3 casas decimais, ex: 24.772,421 -> 24772.421)
function numDec(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : Math.round(v * 1000) / 1000;
  const s = String(v).trim();
  if (/^\d{1,3}(\.\d{3})+(,\d*)?$/.test(s))
    return Math.round(parseFloat(s.replace(/\./g, '').replace(',', '.')) * 1000) / 1000;
  if (/^\d+(,\d+)?$/.test(s))
    return Math.round(parseFloat(s.replace(',', '.')) * 1000) / 1000;
  return Math.round(parseFloat(s) * 1000) / 1000 || 0;
}

// Alias legado — usado em devolver e outros campos inteiros
function num(v) { return numInt(v); }

/* ── DISPONÍVEL — FONTE PRINCIPAL OBRIGATÓRIA ── */
function getDisponivel(r) {
  return (r.disponivel !== null && r.disponivel !== undefined)
    ? r.disponivel
    : r.saldo;
}

/* ── Formatação ── */
function fmt(v, dash = true) {
  if (dash && (v === null || v === undefined || v === '')) {
    return '<span class="val-empty">—</span>';
  }
  const n = Number(v);
  // Preserva decimais reais (ex: 24772.421), omite quando e inteiro exato
  const decimais = Number.isInteger(n) ? 0 : 3;
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: decimais,
    maximumFractionDigits: 3
  });
}

function fmtNum(v) {
  if (v === null || v === undefined) return '<span class="val-empty">—</span>';
  const cls = v < CRITICAL ? 'val-critical' : v < CRITICAL * WARN_MULT ? 'val-warn' : 'val-ok';
  return `<span class="${cls}">${fmt(v, false)}</span>`;
}

/* ── Status baseado em DISPONÍVEL ── */
function saldoStatus(v) {
  if (v === null || v === undefined) return '<span class="val-empty">—</span>';
  if (v <= 0) return `<span class="transfer-priority priority-urgent">● SEM ESTOQUE</span>`;
  if (v < CRITICAL) return `<span class="transfer-priority priority-urgent">● CRÍTICO</span>`;
  if (v < CRITICAL * WARN_MULT) return `<span class="transfer-priority priority-high">◐ ATENÇÃO</span>`;
  return `<span class="transfer-priority priority-normal">○ OK</span>`;
}

/* ── CD ── */
function cdBadge(cd) {
  const c = String(cd ?? '').trim();
  const cls = c === '1' ? 'cd-1' : c === '3' ? 'cd-3' : c === '6' ? 'cd-6' : c === '7' ? 'cd-7' : 'cd-x';
  return `<span class="cd-badge ${cls}">CD ${c || '?'}</span>`;
}

function cdClass(cd) {
  return cd === '1' ? 'cd-1' : cd === '3' ? 'cd-3' : cd === '6' ? 'cd-6' : cd === '7' ? 'cd-7' : 'cd-x';
}

/* ── Prioridade ── */
function priorityBadge(p) {
  const cls = p === 'URGENTE' ? 'priority-urgent' : p === 'ALTO' ? 'priority-high' : 'priority-normal';
  const dot = p === 'URGENTE' ? '▲' : p === 'ALTO' ? '◐' : '○';
  return `<span class="transfer-priority ${cls}">${dot} ${p}</span>`;
}

function priorityOrder(p) {
  return p === 'URGENTE' ? 0 : p === 'ALTO' ? 1 : 2;
}

/* ── Ordenação ── */
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

/* ── Paginação ── */
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
    [1, totalPages, currentPage, currentPage-1, currentPage-2, currentPage+1, currentPage+2]
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

/* ── Ordenação visual ── */
function updateSortHeaders(tableId, sortState) {
  document.querySelectorAll(`#${tableId} th.sortable`).forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.col === sortState.col) {
      th.classList.add(sortState.dir === 1 ? 'sort-asc' : 'sort-desc');
    }
  });
}

/* ── Toast ── */
function showToast(msg, type = 'success', duration = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icon = type === 'success' ? '✔' : type === 'error' ? '✖' : 'ℹ';
  toast.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ============================================================
   EXPORTAÇÃO
   ============================================================ */

function csvEscape(v) {
  const s = String(v ?? '');
  if (s.includes(';') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function downloadBlob(content, filename) {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* ── ESTOQUE ── */
function exportEstoqueCSV(filtered = false) {
  const data = filtered ? getEstoqueFiltered() : WMS_DATA;
  const rows = [
    ['Cód Material','Descrição','CD','Armazém','Desc Armazém','Saldo','Disponível','Status'].join(';'),
    ...data.map(r => [
      r.cd_material, r.desc_material, r.cd, r.cd_centro_armaz, r.desc_armaz,
      r.saldo, getDisponivel(r), getDisponivel(r) < CRITICAL ? 'CRÍTICO' : 'OK'
    ].map(csvEscape).join(';'))
  ];
  downloadBlob(rows.join('\n'), 'estoque.csv');
}

/* ── TRANSFERÊNCIA ── */
function exportTransferCSV(filtered = false) {
  const data = filtered ? getTransferFiltered() : TRANSFER_DATA;
  const rows = [
    ['Material','Descrição','CD Destino','Saldo Destino','Disponível Destino',
     'CD Origem','Saldo Origem','Disponível Origem','Qtd','Prioridade'].join(';'),
    ...data.map(r => [
      r.cd_material, r.desc_material, r.cd_destino, r.saldo_destino,
      r.disponivel_destino, r.cd_origem, r.saldo_origem, r.disponivel_origem,
      r.qtd_sugerida, r.prioridade
    ].map(csvEscape).join(';'))
  ];
  downloadBlob(rows.join('\n'), 'transferencias.csv');
}

/* ── COPY EXCEL ── */
async function copyTransferToClipboard() {
  const data = getTransferFiltered();
  const rows = data.map(r =>
    [
      r.cd_material, r.desc_material, r.cd_destino, r.saldo_destino,
      r.disponivel_destino, r.cd_origem, r.saldo_origem, r.disponivel_origem,
      r.qtd_sugerida, r.prioridade
    ].join('\t')
  );
  await navigator.clipboard.writeText(rows.join('\n'));
}

/* ── RESUMO CONSOLIDADO ── */
function exportResumoCSV() {
  const totalItens  = WMS_DATA.length;
  const criticos    = WMS_DATA.filter(r => getDisponivel(r) < CRITICAL).length;
  const semEstoque  = WMS_DATA.filter(r => getDisponivel(r) <= 0).length;
  const totalDisp   = WMS_DATA.reduce((s, r) => s + getDisponivel(r), 0);
  const totalTransf = TRANSFER_DATA.length;
  const urgentes    = TRANSFER_DATA.filter(r => r.prioridade === 'URGENTE').length;

  const linhasResumo = [
    ['RESUMO GERAL', ''].join(';'),
    ['Total de itens', totalItens].join(';'),
    ['Disponível total', totalDisp].join(';'),
    ['Críticos (disp < 200)', criticos].join(';'),
    ['Sem estoque (disp ≤ 0)', semEstoque].join(';'),
    ['Sugestões de transferência', totalTransf].join(';'),
    ['Transferências urgentes', urgentes].join(';'),
    ['', ''],
    ['SUGESTÕES DE TRANSFERÊNCIA','','','','','','','','',''].join(';'),
    ['Material','Descrição','CD Destino','ARM Destino','Disponível Destino',
     'CD Origem','ARM Origem','Disponível Origem','Qtd Sugerida','Prioridade'].join(';'),
    ...TRANSFER_DATA.map(r => [
      r.cd_material, r.desc_material, r.cd_destino, r.armaz_destino,
      r.disponivel_destino, r.cd_origem, r.armaz_origem, r.disponivel_origem,
      r.qtd_sugerida, r.prioridade,
    ].map(csvEscape).join(';')),
  ];

  downloadBlob(linhasResumo.join('\n'), 'resumo_estoque.csv');
}

/* ── COMP 1×3×7 ARM1 ── */
function exportComp1CSV(filtered = true) {
  const data = filtered ? sortData(getComp1Filtered(comp1All), null, 1) : comp1All;
  const rows = [
    ['Cód Material','Descrição','CD 1','CD 3','CD 7','Total'].join(';'),
    ...data.map(r => [
      r.cd_material, r.desc_material,
      r.v_cd1 ?? '', r.v_cd3 ?? '', r.v_cd7 ?? '', r.total
    ].map(csvEscape).join(';'))
  ];
  downloadBlob(rows.join('\n'), 'comp_cd1x3x7_arm1.csv');
}

/* ── COMP 1×6 ARM28 ── */
function exportComp2CSV(filtered = true) {
  const data = filtered ? sortData(getComp2Filtered(comp2All), null, 1) : comp2All;
  const rows = [
    ['Cód Material','Descrição','CD 1 · ARM28','CD 6 · ARM28','Total'].join(';'),
    ...data.map(r => [
      r.cd_material, r.desc_material,
      r.v_cd1 ?? '', r.v_cd6 ?? '', r.total
    ].map(csvEscape).join(';'))
  ];
  downloadBlob(rows.join('\n'), 'comp_cd1x6_arm28.csv');
}