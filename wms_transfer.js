/* ============================================================
   WMS ANALÍTICO — wms_transfer.js  [v3.0]
   Algoritmo de sugestões de transferência
   REGRA: usa exclusivamente DISPONIVEL como fonte de saldo.
   DISPONIVEL = 0 é tratado como sem estoque (nunca substitui por SALDO).
   ============================================================ */

function buildTransferSuggestions() {

  /* ── Passo 1: Agrupa DISPONÍVEL por (material + cd + armaz) ── */
  const grouped = {};

  WMS_DATA.forEach(r => {
    const key = `${r.cd_material}|||${normalizeCd(r.cd)}|||${normalizeArmaz(r.cd_centro_armaz)}`;

    if (!grouped[key]) {
      grouped[key] = {
        cd_material:     r.cd_material,
        desc_material:   r.desc_material,
        cd:              normalizeCd(r.cd),
        armaz:           normalizeArmaz(r.cd_centro_armaz),
        saldo:           0,
        disponivel:      0,
      };
    }

    grouped[key].saldo      += Math.round(Number(r.saldo) || 0);
    grouped[key].disponivel += Math.round(getDisponivel(r));
  });

  const entries = Object.values(grouped);

  /* ── Passo 2: Separa destinos e origens candidatas ── */

  const destinations = entries.filter(e =>
    !isArmazBlocked(e.armaz) && e.disponivel < CRITICAL
  );

  const origins = entries.filter(e => {
    const arm = normalizeArmaz(e.armaz);
    if (!['1','8','28'].includes(arm)) return false;
    // disponivel precisa ser positivo E ter excedente acima do crítico
    if (e.disponivel <= 0) return false;
    return (e.disponivel - CRITICAL) > 0;
  });

  /* ── Passo 3: Detecta itens sem estoque disponível ── */
  ZERO_STOCK_DATA = [];

  entries.forEach(e => {
    const arm = normalizeArmaz(e.armaz);
    if (['1','8','28'].includes(arm) && e.disponivel <= 0) {
      ZERO_STOCK_DATA.push({
        cd_material:   e.cd_material,
        desc_material: e.desc_material,
        cd:            e.cd,
        armaz:         e.armaz,
        saldo:         e.saldo,
        disponivel:    e.disponivel,
      });
    }
  });

  /* ── Passo 4: Gera sugestões ── */
  const suggestions = [];

  destinations.forEach(dest => {

    const validOrigins = origins.filter(orig =>
      orig.cd_material === dest.cd_material &&
      isValidTransferPair(
        { cd: orig.cd, armaz: orig.armaz },
        { cd: dest.cd, armaz: dest.armaz }
      )
    );

    if (validOrigins.length === 0) return;

    validOrigins.sort((a, b) => b.disponivel - a.disponivel);
    const orig = validOrigins[0];

    const need  = CRITICAL - dest.disponivel;
    const avail = orig.disponivel - CRITICAL;
    const qty   = Math.ceil(Math.min(need, avail));

    if (qty <= 0) return;

    const pct = dest.disponivel / CRITICAL;

    const priority =
      dest.disponivel <= 0 || pct < 0.5 ? 'URGENTE' :
      pct < 0.75                        ? 'ALTO'    :
                                          'NORMAL';

    suggestions.push({
      cd_material:        dest.cd_material,
      desc_material:      dest.desc_material,

      cd_destino:         dest.cd,
      armaz_destino:      dest.armaz,
      saldo_destino:      dest.saldo,
      disponivel_destino: dest.disponivel,

      cd_origem:          orig.cd,
      armaz_origem:       orig.armaz,
      saldo_origem:       orig.saldo,
      disponivel_origem:  orig.disponivel,

      qtd_sugerida:       qty,
      prioridade:         priority,
    });
  });

  /* ── Passo 5: Ordenação ── */
  suggestions.sort((a, b) => {
    const po = priorityOrder(a.prioridade) - priorityOrder(b.prioridade);
    if (po !== 0) return po;
    return a.disponivel_destino - b.disponivel_destino;
  });

  return suggestions;
}

/* ============================================================
   Itens sem estoque consolidado
   ============================================================ */
function buildNoStockItems() {

  const matSaldo = {};

  WMS_DATA.forEach(r => {
    const arm = normalizeArmaz(r.cd_centro_armaz);
    if (!['1','8','28'].includes(arm)) return;

    if (!matSaldo[r.cd_material]) {
      matSaldo[r.cd_material] = {
        desc: r.desc_material,
        total: 0,
        disponivel: 0
      };
    }

    matSaldo[r.cd_material].total += Number(r.saldo) || 0;
    matSaldo[r.cd_material].disponivel += Number(getDisponivel(r)) || 0;
  });

  return Object.entries(matSaldo)
    .filter(([, v]) => v.disponivel <= 0)
    .map(([mat, v]) => ({
      cd_material: mat,
      desc_material: v.desc,
      saldo_total: v.total,
      disponivel_total: v.disponivel
    }));
}