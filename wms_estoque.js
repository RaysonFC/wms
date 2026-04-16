/* ============================================================
   WMS ANALÍTICO — wms_estoque.js  [v3.0]
   Aba "Estoque Geral" — usa DISPONIVEL como fonte principal obrigatória
   ============================================================ */

/* ---- Filtros ---- */
function getEstoqueFiltered() {
  const cd      = document.getElementById('filter-cd').value;
  const armaz   = document.getElementById('filter-armaz').value;
  const produto = document.getElementById('filter-produto').value.toLowerCase().trim();
  const saldo   = document.getElementById('filter-saldo').value;

  return WMS_DATA.filter(r => {
    if (cd     && normalizeCd(r.cd) !== normalizeCd(cd))                                                            return false;
    if (armaz  && normalizeArmaz(r.cd_centro_armaz) !== normalizeArmaz(armaz))                                            return false;
    // Busca por código ou descrição (case-insensitive)
    if (produto) {
      const searchInCode = (r.cd_material || '').toLowerCase().includes(produto);
      const searchInDesc = (r.desc_material || '').toLowerCase().includes(produto);
      if (!searchInCode && !searchInDesc) return false;
    }
    if (saldo === 'critico' && getDisponivel(r) >= CRITICAL)  return false;
    if (saldo === 'normal'  && getDisponivel(r)  < CRITICAL)  return false;
    return true;
  });
}

/* ---- Render ---- */
function renderEstoque() {
  const filtered = sortData(getEstoqueFiltered(), state.estoque.sort.col, state.estoque.sort.dir);
  const start    = (state.estoque.page - 1) * PAGE_SIZE;
  const page     = filtered.slice(start, start + PAGE_SIZE);
  const tbody    = document.getElementById('tbody-estoque');

  /* Cards de resumo - USA DISPONÍVEL */
  const totalDisp  = filtered.reduce((s, r) => s + getDisponivel(r), 0);
  const critCount  = filtered.filter(r => getDisponivel(r) < CRITICAL).length;
  document.getElementById('sc-total').textContent       = filtered.length.toLocaleString('pt-BR');
  document.getElementById('sc-critical').textContent    = critCount.toLocaleString('pt-BR');
  document.getElementById('sc-ok').textContent          = (filtered.length - critCount).toLocaleString('pt-BR');
  document.getElementById('sc-saldo-total').textContent = totalDisp.toLocaleString('pt-BR');
  document.getElementById('estoque-summary').style.display = filtered.length > 0 ? 'flex' : 'none';

  /* Linhas da tabela */
  tbody.innerHTML = filtered.length === 0
    ? '<tr><td colspan="9" class="empty-state"><p>Nenhum resultado encontrado.</p></td></tr>'
    : page.map(r => {
        const disp = getDisponivel(r);
        const saldo = r.saldo || 0;
        const demanda = saldo - disp; // Demanda = Saldo - Disponível
        const rowCls = disp < CRITICAL ? 'row-critical' : disp < CRITICAL * WARN_MULT ? 'row-warn' : '';
        return `<tr class="${rowCls}">
          <td><code style="font-family:var(--mono);font-size:11px;color:var(--accent)">${r.cd_material || '—'}</code></td>
          <td title="${r.desc_material}">${r.desc_material || '—'}</td>
          <td>${cdBadge(r.cd)}</td>
          <td style="font-family:var(--mono);font-size:12px">${r.cd_centro_armaz || '—'}</td>
          <td class="td-num">${fmtNum(saldo)}</td>
          <td class="td-num">${fmtNum(demanda)}</td>
          <td class="td-num">${fmtNum(disp)}</td>
          <td class="td-num">${saldoStatus(disp)}</td>
        </tr>`;
      }).join('');

  renderPagination('pagination-estoque', filtered.length, state.estoque.page,
    p => { state.estoque.page = p; renderEstoque(); }
  );
  updateSortHeaders('table-estoque', state.estoque.sort);
}

/* ---- Init ---- */
function initEstoque() {
  /* Filtros */
  ['filter-cd', 'filter-armaz', 'filter-produto', 'filter-saldo'].forEach(id => {
    document.getElementById(id).addEventListener('input',  () => { state.estoque.page = 1; renderEstoque(); });
    document.getElementById(id).addEventListener('change', () => {
      if (id === 'filter-cd') populateArmazFilter(document.getElementById('filter-cd').value);
      state.estoque.page = 1;
      renderEstoque();
    });
  });

  document.getElementById('clear-filters').addEventListener('click', () => {
    ['filter-cd', 'filter-armaz', 'filter-produto', 'filter-saldo'].forEach(id => {
      document.getElementById(id).value = '';
    });
    populateArmazFilter();
    state.estoque.page = 1;
    renderEstoque();
  });

  /* Ordenação */
  document.querySelectorAll('#table-estoque th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      state.estoque.sort = { col, dir: state.estoque.sort.col === col ? state.estoque.sort.dir * -1 : 1 };
      state.estoque.page = 1;
      renderEstoque();
    });
  });

  renderEstoque();
}
