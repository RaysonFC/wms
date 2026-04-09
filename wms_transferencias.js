/* ============================================================
   WMS ANALÍTICO — wms.transferencias.js
   Aba "Transferências" — filtros, render, ordenação e sem estoque
   Regra: somente cd_centro_armaz ∈ {1, 21, 28} participam.
   ============================================================ */

/* ---- Estado separado para sem estoque ---- */
const stateNoStock = { page: 1 };

/* ---- Filtros da tabela principal ---- */
function getTransferFiltered() {
  const produto  = document.getElementById('filter-t-produto').value.toLowerCase().trim();
  const dest     = document.getElementById('filter-t-dest').value;
  const priority = document.getElementById('filter-t-priority').value;

  return TRANSFER_DATA.filter(r => {
    if (produto  && !r.cd_material.toLowerCase().includes(produto)
                 && !r.desc_material.toLowerCase().includes(produto)) return false;
    if (dest     && r.cd_destino !== dest)                            return false;
    if (priority && r.prioridade !== priority)                        return false;
    return true;
  });
}

/* ---- Render tabela principal de sugestões ---- */
function renderTransfer() {
  const filtered = sortData(getTransferFiltered(), state.transfer.sort.col, state.transfer.sort.dir);
  const start    = (state.transfer.page - 1) * PAGE_SIZE;
  const page     = filtered.slice(start, start + PAGE_SIZE);
  const tbody    = document.getElementById('tbody-transfer');

  tbody.innerHTML = filtered.length === 0
    ? '<tr><td colspan="11" class="empty-state"><p>Nenhuma sugestão de transferência para os filtros selecionados.</p></td></tr>'
    : page.map(r => {
        const rowCls  = r.prioridade === 'URGENTE' ? 'row-critical'
                      : r.prioridade === 'ALTO'    ? 'row-warn'
                      :                              'row-transfer';
        const origCls = cdClass(r.cd_origem);
        const destCls = cdClass(r.cd_destino);
        return `<tr class="${rowCls}">
          <td><code style="font-family:var(--mono);font-size:11px;color:var(--accent)">${r.cd_material}</code></td>
          <td title="${r.desc_material}">${r.desc_material}</td>
          <td class="td-num">${fmtNum(r.saldo_destino)}</td>
          <td>${cdBadge(r.cd_destino)}</td>
          <td style="font-family:var(--mono);font-size:11px;color:var(--text-muted)">ARM ${r.armaz_destino}</td>
          <td>
            <div class="flow-arrow">
              <span class="cd-badge ${origCls}">CD ${r.cd_origem}</span>
              <span class="flow-icon">→</span>
              <span class="cd-badge ${destCls}">CD ${r.cd_destino}</span>
            </div>
          </td>
          <td>${cdBadge(r.cd_origem)}</td>
          <td style="font-family:var(--mono);font-size:11px;color:var(--text-muted)">ARM ${r.armaz_origem}</td>
          <td class="td-num">${fmtNum(r.saldo_origem)}</td>
          <td class="td-num">
            <span class="transfer-badge">⇄ ${r.qtd_sugerida.toLocaleString('pt-BR')}</span>
          </td>
          <td>${priorityBadge(r.prioridade)}</td>
        </tr>`;
      }).join('');

  renderPagination('pagination-transfer', filtered.length, state.transfer.page,
    p => { state.transfer.page = p; renderTransfer(); }
  );
  updateSortHeaders('table-transfer', state.transfer.sort);
}

/* ---- Render seção "Sem Estoque / Sem Transferência Possível" ---- */
function renderNoStock() {
  const tbody = document.getElementById('tbody-nostock');
  if (!tbody) return;

  const search = (document.getElementById('filter-t-produto').value || '').toLowerCase().trim();
  const data   = ZERO_STOCK_DATA.filter(r =>
    !search ||
    r.cd_material.toLowerCase().includes(search) ||
    r.desc_material.toLowerCase().includes(search)
  );

  const counter = document.getElementById('nostock-count');
  if (counter) counter.textContent = data.length;

  const start = (stateNoStock.page - 1) * PAGE_SIZE;
  const pg    = data.slice(start, start + PAGE_SIZE);

  tbody.innerHTML = pg.length === 0
    ? '<tr><td colspan="5" class="empty-state"><p>Nenhum item sem estoque nos armazéns elegíveis.</p></td></tr>'
    : pg.map(r => `<tr class="row-critical">
        <td><code style="font-family:var(--mono);font-size:11px;color:var(--danger)">${r.cd_material}</code></td>
        <td title="${r.desc_material}">${r.desc_material}</td>
        <td>${cdBadge(r.cd)}</td>
        <td style="font-family:var(--mono);font-size:12px;color:var(--text-muted)">ARM ${r.cd_centro_armaz}</td>
        <td class="td-num"><span class="val-critical">${r.saldo.toLocaleString('pt-BR')}</span></td>
      </tr>`).join('');

  renderPagination('pagination-nostock', data.length, stateNoStock.page,
    p => { stateNoStock.page = p; renderNoStock(); }
  );
}

/* ---- Init ---- */
function initTransfer() {
  ['filter-t-produto', 'filter-t-dest', 'filter-t-priority'].forEach(id => {
    document.getElementById(id).addEventListener('input',  () => {
      state.transfer.page = 1;
      stateNoStock.page   = 1;
      renderTransfer();
      renderNoStock();
    });
    document.getElementById(id).addEventListener('change', () => {
      state.transfer.page = 1;
      stateNoStock.page   = 1;
      renderTransfer();
      renderNoStock();
    });
  });

  document.getElementById('clear-t-filters').addEventListener('click', () => {
    ['filter-t-produto', 'filter-t-dest', 'filter-t-priority'].forEach(id => {
      document.getElementById(id).value = '';
    });
    state.transfer.page = 1;
    stateNoStock.page   = 1;
    renderTransfer();
    renderNoStock();
  });

  const toggleBtn      = document.getElementById('toggle-nostock');
  const noStockSection = document.getElementById('nostock-section');
  if (toggleBtn && noStockSection) {
    toggleBtn.addEventListener('click', () => {
      const hidden = noStockSection.style.display === 'none';
      noStockSection.style.display = hidden ? 'flex' : 'none';
      toggleBtn.textContent = hidden ? '▲ Ocultar Sem Estoque' : '▼ Ver Itens Sem Estoque';
      if (hidden) renderNoStock();
    });
  }

  document.querySelectorAll('#table-transfer th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      state.transfer.sort = { col, dir: state.transfer.sort.col === col ? state.transfer.sort.dir * -1 : 1 };
      state.transfer.page = 1;
      renderTransfer();
    });
  });

  renderTransfer();
  renderNoStock();
}
