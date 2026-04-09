/* ============================================================
   WMS ANALÍTICO — wms.transfer.js
   Algoritmo de sugestões de transferência.

   REGRAS DE PAR VÁLIDO (isValidTransferPair):
   ┌──────────────┬────────────────────────────────────────────────────┐
   │ ARM 1 orig   │ Qualquer destino não bloqueado                     │
   │ ARM 8 orig   │ Somente destino com cd_unidade_de_n = "1"          │
   │ ARM 28 orig  │ SOMENTE CD 1 ARM 28 ↔ CD 6 ARM 28                 │
   │ Outros       │ Bloqueado — nunca origem                           │
   └──────────────┴────────────────────────────────────────────────────┘

   CÁLCULO DA QUANTIDADE:
   - need  = 200 − saldo_destino
   - avail = saldo_origem − 200  (excedente real; doador nunca fica abaixo de 200)
   - qty   = ceil( MIN(need, avail) )
   ============================================================ */

function buildTransferSuggestions() {

  /* ── Passo 1: Agrupa saldo por (material + cd + armaz) ── */
  const grouped = {};
  WMS_DATA.forEach(r => {
    const key = `${r.cd_material}|||${normalizeCd(r.cd)}|||${normalizeArmaz(r.cd_centro_armaz)}`;
    if (!grouped[key]) {
      grouped[key] = {
        cd_material:     r.cd_material,
        desc_material:   r.desc_material,
        cd:              normalizeCd(r.cd),
        armaz:           normalizeArmaz(r.cd_centro_armaz),
        saldo: 0,
      };
    }
    grouped[key].saldo += r.saldo;
  });

  const entries = Object.values(grouped);

  /* ── Passo 2: Separa destinos e origens candidatas ── */

  // Destinos: não bloqueados com saldo crítico
  const destinations = entries.filter(e =>
    !isArmazBlocked(e.armaz) && e.saldo < CRITICAL
  );

  // Origens candidatas: ARM 1, 8 ou 28 com saldo > 0 e excedente real
  const origins = entries.filter(e => {
    const arm = normalizeArmaz(e.armaz);
    if (!['1','8','28'].includes(arm)) return false;
    if (e.saldo <= 0) return false;
    return (e.saldo - CRITICAL) > 0; // tem excedente
  });

  /* ── Passo 3: Detecta itens sem saldo nas origens elegíveis ── */
  ZERO_STOCK_DATA = [];
  entries.forEach(e => {
    const arm = normalizeArmaz(e.armaz);
    if (['1','8','28'].includes(arm) && e.saldo <= 0) {
      ZERO_STOCK_DATA.push({
        cd_material:     e.cd_material,
        desc_material:   e.desc_material,
        cd:              e.cd,
        cd_centro_armaz: e.armaz,
        saldo:           e.saldo,
      });
    }
  });

  /* ── Passo 4: Gera sugestões cruzando destinos × origens ── */
  const suggestions = [];

  destinations.forEach(dest => {
    // Filtra origens válidas para este destino
    const validOrigins = origins.filter(orig =>
      orig.cd_material === dest.cd_material &&
      isValidTransferPair(
        { cd: orig.cd, armaz: orig.armaz },
        { cd: dest.cd, armaz: dest.armaz }
      )
    );

    if (validOrigins.length === 0) return;

    // Melhor doador = maior excedente
    validOrigins.sort((a, b) => b.saldo - a.saldo);
    const orig = validOrigins[0];

    const need  = CRITICAL - dest.saldo;
    const avail = orig.saldo - CRITICAL;
    const qty   = Math.ceil(Math.min(need, avail));
    if (qty <= 0) return;

    const pct      = dest.saldo / CRITICAL;
    const priority = dest.saldo <= 0 || pct < 0.5 ? 'URGENTE'
                   : pct < 0.75                    ? 'ALTO'
                   :                                 'NORMAL';

    suggestions.push({
      cd_material:   dest.cd_material,
      desc_material: dest.desc_material,
      cd_destino:    dest.cd,
      armaz_destino: dest.armaz,
      saldo_destino: dest.saldo,
      cd_origem:     orig.cd,
      armaz_origem:  orig.armaz,
      saldo_origem:  orig.saldo,
      qtd_sugerida:  qty,
      prioridade:    priority,
    });
  });

  /* ── Passo 5: Ordena por prioridade → menor saldo destino ── */
  suggestions.sort((a, b) => {
    const po = priorityOrder(a.prioridade) - priorityOrder(b.prioridade);
    if (po !== 0) return po;
    return a.saldo_destino - b.saldo_destino;
  });

  return suggestions;
}

function buildNoStockItems() {
  const matSaldo = {};
  WMS_DATA.forEach(r => {
    const arm = normalizeArmaz(r.cd_centro_armaz);
    if (!['1','8','28'].includes(arm)) return;
    if (!matSaldo[r.cd_material]) matSaldo[r.cd_material] = { desc: r.desc_material, total: 0 };
    matSaldo[r.cd_material].total += r.saldo;
  });
  return Object.entries(matSaldo)
    .filter(([, v]) => v.total <= 0)
    .map(([mat, v]) => ({ cd_material: mat, desc_material: v.desc, saldo_total: v.total }));
}
