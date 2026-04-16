/* ============================================================
   WMS ANALÍTICO — wms_comp2.js  [v2.2]
   Aba "CD 1 × 6 — ARM 28" — usando DISPONÍVEL (correto)
   ============================================================ */

let comp2All = [];

function buildComp2Data() {
  const map = {};

  WMS_DATA
    .filter(r => {
      const cd  = normalizeCd(r.cd);
      const arm = normalizeArmaz(r.cd_centro_armaz);
      return ['1','6'].includes(cd) && arm === '28';
    })
    .forEach(r => {
      const cd = normalizeCd(r.cd);

      if (!map[r.cd_material]) {
        map[r.cd_material] = {
          cd_material:   r.cd_material,
          desc_material: r.desc_material,
          v_cd1: null,
          v_cd6: null,
        };
      }

      const key = 'v_cd' + cd;

      if (map[r.cd_material][key] === null) {
        map[r.cd_material][key] = 0;
      }

      // ✅ CORREÇÃO PRINCIPAL (ANTES ERA r.saldo)
      map[r.cd_material][key] += getDisponivel(r);
    });

  return Object.values(map).map(r => ({
    ...r,
    total: (r.v_cd1 ?? 0) + (r.v_cd6 ?? 0),
  }));
}

function getComp2Filtered(all) {
  const produto = document.getElementById('filter-c2-produto').value.toLowerCase().trim();
  const saldo   = document.getElementById('filter-c2-saldo').value;

  return all.filter(r => {
    if (
      produto &&
      !r.cd_material.toLowerCase().includes(produto) &&
      !r.desc_material.toLowerCase().includes(produto)
    ) return false;

    const hasCrit = [r.v_cd1, r.v_cd6].some(v => v !== null && v < CRITICAL);

    if (saldo === 'critico' && !hasCrit) return false;
    if (saldo === 'normal'  &&  hasCrit) return false;

    return true;
  });
}

function buildComp2TransferHint(r) {
  const cds      = [['1', r.v_cd1], ['6', r.v_cd6]];
  const critical = cds.filter(([, v]) => v !== null && v < CRITICAL);
  const donors   = cds.filter(([, v]) => v !== null && (v - CRITICAL) > 0);

  if (critical.length === 0 || donors.length === 0) {
    return '<span class="transfer-none">—</span>';
  }

  const [fromCd, fromV] = donors.sort((a, b) => b[1] - a[1])[0];
  const [toCd,   toV]   = critical.sort((a, b) => a[1] - b[1])[0];

  const avail = fromV - CRITICAL;
  if (avail <= 0) return '<span class="transfer-none">Sem excedente</span>';

  const qty = Math.ceil(Math.min(CRITICAL - toV, avail));
  if (qty <= 0) return '<span class="transfer-none">—</span>';

  return `
    <div class="flow-arrow">
      <span class="cd-badge ${cdClass(fromCd)}">CD${fromCd}</span>
      <span class="flow-icon">→</span>
      <span class="cd-badge ${cdClass(toCd)}">CD${toCd}</span>
      <span class="transfer-badge">⇄ ${qty.toLocaleString('pt-BR')}</span>
    </div>
  `;
}

function renderComp2() {
  const filtered = sortData(
    getComp2Filtered(comp2All),
    state.comp2.sort.col,
    state.comp2.sort.dir
  );

  const start = (state.comp2.page - 1) * PAGE_SIZE;
  const page  = filtered.slice(start, start + PAGE_SIZE);
  const tbody = document.getElementById('tbody-comp2');

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          <p>Nenhum resultado encontrado.</p>
        </td>
      </tr>`;
  } else {
    tbody.innerHTML = page.map(r => {
      const hasCrit = [r.v_cd1, r.v_cd6].some(v => v !== null && v < CRITICAL);
      const cls = hasCrit ? 'row-critical' : '';

      return `
        <tr class="${cls}">
          <td><code style="font-family:var(--mono);font-size:11px;color:var(--accent)">
            ${r.cd_material || '—'}
          </code></td>

          <td title="${r.desc_material}">
            ${r.desc_material || '—'}
          </td>

          <td class="td-num">${fmtNum(r.v_cd1)}</td>
          <td class="td-num">${fmtNum(r.v_cd6)}</td>

          <td class="td-num" style="font-family:var(--mono);font-size:12px">
            ${fmt(r.total, false)}
          </td>

          <td>${buildComp2TransferHint(r)}</td>
        </tr>
      `;
    }).join('');
  }

  renderPagination(
    'pagination-comp2',
    filtered.length,
    state.comp2.page,
    p => { state.comp2.page = p; renderComp2(); }
  );

  updateSortHeaders('table-comp2', state.comp2.sort);
}

function initComp2() {
  comp2All = buildComp2Data();

  ['filter-c2-produto', 'filter-c2-saldo'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      state.comp2.page = 1;
      renderComp2();
    });

    document.getElementById(id).addEventListener('change', () => {
      state.comp2.page = 1;
      renderComp2();
    });
  });

  document.getElementById('clear-c2-filters').addEventListener('click', () => {
    ['filter-c2-produto', 'filter-c2-saldo'].forEach(id => {
      document.getElementById(id).value = '';
    });

    state.comp2.page = 1;
    renderComp2();
  });

  document.querySelectorAll('#table-comp2 th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;

      state.comp2.sort = {
        col,
        dir: state.comp2.sort.col === col ? state.comp2.sort.dir * -1 : 1
      };

      state.comp2.page = 1;
      renderComp2();
    });
  });

  renderComp2();
}