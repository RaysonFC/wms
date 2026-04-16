/* ============================================================
   WMS ANALÍTICO — wms_app.js  [v2.1]
   Inicialização do app, tabs, badges e modal de exportação
   ============================================================ */

/* ── Atualizar timestamp da última carga ── */
function updateLoadTimestamp() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const timeStr = `${hh}:${mm}:${ss}`;
  
  const timestamp = document.getElementById('header-timestamp');
  if (timestamp) {
    timestamp.textContent = timeStr;
  }
}

/* ── Lançamento após upload ── */
function launchApp(filename) {
  document.getElementById('upload-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('brand-file').textContent = filename;

  // Debug: mostrar se disponível foi carregado
  const primeiroItem = WMS_DATA[0];
  if (primeiroItem) {
    console.log('Primeiro item carregado:', {
      cd_material: primeiroItem.cd_material,
      saldo: primeiroItem.saldo,
      disponivel: primeiroItem.disponivel
    });
  }

  // Mostra botão recarregar + timestamp
  const reloadGroup = document.getElementById('reload-group');
  if (reloadGroup) {
    reloadGroup.style.display = 'flex';
    updateLoadTimestamp();
  }

  populateCdFilter();
  populateArmazFilter();
  updateBadges();

  initEstoque();
  initTransfer();
  initComp1();
  initComp2();
  initExportModal();
}

/* ── Filtros globais ── */
function populateCdFilter() {
  const cds = [...new Set(WMS_DATA.map(r => normalizeCd(r.cd)).filter(Boolean))]
    .sort((a, b) => +a - +b || a.localeCompare(b));

  const sel = document.getElementById('filter-cd');
  sel.innerHTML = '<option value="">Todos</option>';
  cds.forEach(cd => sel.innerHTML += `<option value="${cd}">CD ${cd}</option>`);

  // Filtro CD Origem nas transferências
  const tselOrigem = document.getElementById('filter-t-origem');
  tselOrigem.innerHTML = '<option value="">Todos</option>';
  cds.forEach(cd => tselOrigem.innerHTML += `<option value="${cd}">CD ${cd}</option>`);

  // Filtro CD Destino nas transferências
  const tselDest = document.getElementById('filter-t-dest');
  tselDest.innerHTML = '<option value="">Todos</option>';
  cds.forEach(cd => tselDest.innerHTML += `<option value="${cd}">CD ${cd}</option>`);

  document.getElementById('badge-cds').textContent = cds.length;
}

function populateArmazFilter(cdFilter = '') {
  const arms = [...new Set(
    WMS_DATA
      .filter(r => !cdFilter || normalizeCd(r.cd) === normalizeCd(cdFilter))
      .map(r => normalizeArmaz(r.cd_centro_armaz))
      .filter(Boolean)
  )].sort((a, b) => +a - +b || a.localeCompare(b));

  const sel = document.getElementById('filter-armaz');
  const cur = sel.value;
  sel.innerHTML = '<option value="">Todos</option>';
  arms.forEach(arm => {
    // busca descrição usando normalização para garantir match
    const desc = WMS_DATA.find(r => normalizeArmaz(r.cd_centro_armaz) === arm)?.desc_armaz || '';
    const label = desc ? `${arm} — ${desc}` : arm;
    sel.innerHTML += `<option value="${arm}">${label}</option>`;
  });
  if (arms.includes(cur)) sel.value = cur;
}

/* ── Badges de cabeçalho ── */
function updateBadges() {
  const critical = WMS_DATA.filter(r => getDisponivel(r) < CRITICAL).length;
  const urgent   = TRANSFER_DATA.filter(r => r.prioridade === 'URGENTE').length;

  document.getElementById('badge-total').textContent    = WMS_DATA.length.toLocaleString('pt-BR');
  document.getElementById('badge-critical').textContent = critical.toLocaleString('pt-BR');
  document.getElementById('badge-transfer').textContent = TRANSFER_DATA.length.toLocaleString('pt-BR');
  document.getElementById('tab-pill-transfer').textContent = TRANSFER_DATA.length;
  document.getElementById('ts-count').textContent  = TRANSFER_DATA.length;
  document.getElementById('ts-urgent').textContent = urgent;
}

/* ── Navegação tabs ── */
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});

/* ── Botão voltar ── */
document.getElementById('back-btn').addEventListener('click', () => {
  if (confirm('Voltar para o upload? Os dados atuais serão perdidos.')) {
    WMS_DATA = []; TRANSFER_DATA = []; ZERO_STOCK_DATA = [];
    window._lastFile = null;
    const rg = document.getElementById('reload-group');
    if (rg) rg.style.display = 'none';
    document.getElementById('app').style.display = 'none';
    document.getElementById('upload-screen').style.display = 'flex';
    document.getElementById('upload-progress').style.display = 'none';
    document.getElementById('upload-fill').style.width = '0%';
    document.getElementById('upload-error').style.display = 'none';
  }
});

/* ── Botão Recarregar ── */
document.getElementById('btn-reload').addEventListener('click', async () => {
  if (!window._lastFile && !window._fileHandle) return;
  const btn = document.getElementById('btn-reload');
  const original = btn.innerHTML;
  btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Carregando...';
  btn.style.opacity = '0.7';
  btn.disabled = true;
  try {
    await window.reloadLastFile();
  } finally {
    setTimeout(() => {
      btn.innerHTML = original;
      btn.style.opacity = '';
      btn.disabled = false;
      updateLoadTimestamp(); // Atualiza timestamp após recarregar
    }, 800);
  }
});

/* ═══════════════════════════════════════════════
   MODAL DE EXPORTAÇÃO
═══════════════════════════════════════════════ */
function initExportModal() {
  const modal   = document.getElementById('export-modal');
  const overlay = document.getElementById('export-overlay');

  /* Abre modal */
  document.getElementById('btn-export-header').addEventListener('click', () => {
    modal.classList.remove('hidden');
    overlay.classList.remove('hidden');
  });

  /* Fecha modal */
  function closeModal() {
    modal.classList.add('hidden');
    overlay.classList.add('hidden');
    document.getElementById('copy-feedback').classList.remove('show');
  }
  document.getElementById('modal-close').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  /* ── Botões de escopo ── */
  const scopeBtns = document.querySelectorAll('.scope-btn');
  scopeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.group;
      document.querySelectorAll(`.scope-btn[data-group="${group}"]`).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  /* ── Export actions ── */
  document.getElementById('btn-dl-estoque').addEventListener('click', () => {
    const filtered = document.querySelector('.scope-btn[data-group="estoque"].active')?.dataset.value === 'filtrado';
    exportEstoqueCSV(filtered);
    closeModal();
  });

  document.getElementById('btn-dl-transfer').addEventListener('click', () => {
    const filtered = document.querySelector('.scope-btn[data-group="transfer"].active')?.dataset.value === 'filtrado';
    exportTransferCSV(filtered);
    closeModal();
  });

  document.getElementById('btn-dl-comp1').addEventListener('click', () => {
    exportComp1CSV();
    closeModal();
  });

  document.getElementById('btn-dl-comp2').addEventListener('click', () => {
    exportComp2CSV();
    closeModal();
  });

  document.getElementById('btn-dl-resumo').addEventListener('click', () => {
    exportResumoCSV();
    closeModal();
  });

  document.getElementById('btn-copy-transfer').addEventListener('click', async () => {
    await copyTransferToClipboard();
    const fb = document.getElementById('copy-feedback');
    fb.classList.add('show');
    setTimeout(() => fb.classList.remove('show'), 2500);
  });
}