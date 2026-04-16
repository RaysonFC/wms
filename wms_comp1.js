/* ============================================================
   WMS ANALÍTICO — wms_comp1.js  [v2.2 FIX]
   Agora usando DISPONIVEL corretamente
   ============================================================ */

let comp1All = [];

function buildComp1Data() {
  const map = {};

  WMS_DATA
    .filter(r => {
      const cd  = normalizeCd(r.cd);
      const arm = normalizeArmaz(r.cd_centro_armaz);
      return ['1','3','7'].includes(cd) && arm === '1';
    })
    .forEach(r => {
      const cd = normalizeCd(r.cd);

      if (!map[r.cd_material]) {
        map[r.cd_material] = {
          cd_material:   r.cd_material,
          desc_material: r.desc_material,
          v_cd1: null,
          v_cd3: null,
          v_cd7: null,
        };
      }

      const key = 'v_cd' + cd;

      if (map[r.cd_material][key] === null) {
        map[r.cd_material][key] = 0;
      }

      /* 🔥 AQUI FOI CORRIGIDO */
      map[r.cd_material][key] += getDisponivel(r);
    });

  return Object.values(map).map(r => ({
    ...r,
    total: (r.v_cd1 ?? 0) + (r.v_cd3 ?? 0) + (r.v_cd7 ?? 0),
  }));
}

function getComp1Filtered(all) {
  const produto = document.getElementById('filter-c1-produto').value.toLowerCase().trim();
  const saldo   = document.getElementById('filter-c1-saldo').value;

  return all.filter(r => {
    if (produto &&
        !r.cd_material.toLowerCase().includes(produto) &&
        !r.desc_material.toLowerCase().includes(produto)) return false;

    const hasCrit = [r.v_cd1, r.v_cd3, r.v_cd7].some(v => v !== null && v < CRITICAL);

    if (saldo === 'critico' && !hasCrit) return false;
    if (saldo === 'normal'  &&  hasCrit) return false;

    return true;
  });
}

function buildComp1TransferHint(r) {
  const cds      = [['1', r.v_cd1], ['3', r.v_cd3], ['7', r.v_cd7]];
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

function renderComp1() {
  const filtered = sortData(
    getComp1Filtered(comp1All),
    state.comp1.sort.col,
    state.comp1.sort.dir
  );

  const start = (state.comp1.page - 1) * PAGE_SIZE;
  const page  = filtered.slice(start, start + PAGE_SIZE);
  const tbody = document.getElementById('tbody-comp1');

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <p>Nenhum resultado encontrado.</p>
        </td>
      </tr>
    `;
  } else {
    tbody.innerHTML = page.map(r => {
      const hasCrit = [r.v_cd1, r.v_cd3, r.v_cd7].some(v => v !== null && v < CRITICAL);
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
          <td class="td-num">${fmtNum(r.v_cd3)}</td>
          <td class="td-num">${fmtNum(r.v_cd7)}</td>

          <td class="td-num" style="font-family:var(--mono);font-size:12px">
            ${fmt(r.total, false)}
          </td>

          <td>${buildComp1TransferHint(r)}</td>
        </tr>
      `;
    }).join('');
  }

  renderPagination(
    'pagination-comp1',
    filtered.length,
    state.comp1.page,
    p => {
      state.comp1.page = p;
      renderComp1();
    }
  );

  updateSortHeaders('table-comp1', state.comp1.sort);
}

function initComp1() {
  comp1All = buildComp1Data();

  ['filter-c1-produto', 'filter-c1-saldo'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      state.comp1.page = 1;
      renderComp1();
    });

    document.getElementById(id).addEventListener('change', () => {
      state.comp1.page = 1;
      renderComp1();
    });
  });

  document.getElementById('clear-c1-filters').addEventListener('click', () => {
    ['filter-c1-produto', 'filter-c1-saldo'].forEach(id => {
      document.getElementById(id).value = '';
    });
    state.comp1.page = 1;
    renderComp1();
  });

  document.querySelectorAll('#table-comp1 th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      state.comp1.sort = {
        col,
        dir: state.comp1.sort.col === col ? state.comp1.sort.dir * -1 : 1
      };
      state.comp1.page = 1;
      renderComp1();
    });
  });

  renderComp1();
}