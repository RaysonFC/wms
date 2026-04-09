/* ============================================================
   WMS ANALÍTICO — wms_config.js  [v2.2]
   Constantes globais e mapeamento de colunas
   ============================================================ */

const PAGE_SIZE  = 50;
const CRITICAL   = 200;
const WARN_MULT  = 1.5;

const BLOCKED_ARMAZ_RAW = new Set([
  '0','2','8','20','21','22','23','24','25','26','27','29',
  '30','32','33','200','300','1001','9999',
  'ABAS','AMOS','HOLD','IMPO','INVE','LOJA','MTNL','PERD','PROD','QUAL','TEMP','TRAN','VENC',
]);

/** Remove zeros à esquerda de cd_centro_armaz ex: '0028' → '28' */
function normalizeArmaz(v) {
  const s = String(v ?? '').trim().toUpperCase();
  if (/^\d+$/.test(s)) return String(parseInt(s, 10));
  return s;
}

/** Remove zeros à esquerda de cd_unidade_de_negocio ex: '001' → '1', '006' → '6' */
function normalizeCd(v) {
  const s = String(v ?? '').trim();
  if (/^\d+$/.test(s)) return String(parseInt(s, 10));
  return s;
}

/**
 * CDs participantes de transferência.
 * Apenas 1, 3, 6, 7 são válidos — CD 2 e demais são bloqueados.
 */
const ALLOWED_CDS = new Set(['1', '3', '6', '7']);

function isCdBlocked(v) {
  return !ALLOWED_CDS.has(normalizeCd(v));
}

function isArmazBlocked(v) {
  return BLOCKED_ARMAZ_RAW.has(normalizeArmaz(v));
}

function isValidTransferPair(orig, dest) {
  const oArm = normalizeArmaz(orig.armaz);
  const dArm = normalizeArmaz(dest.armaz);
  const oCd  = normalizeCd(orig.cd);
  const dCd  = normalizeCd(dest.cd);

  // Bloqueia CDs fora da lista permitida (ex: CD 2, CD 4, CD 5...)
  if (isCdBlocked(orig.cd) || isCdBlocked(dest.cd)) return false;

  // Bloqueia armazéns de destino proibidos
  if (isArmazBlocked(dest.armaz)) return false;

  // Mesmo CD + armazém → sem sentido
  if (oCd === dCd && oArm === dArm) return false;

  if (oArm === '1') return true;
  if (oArm === '8') return dCd === '1';

  if (oArm === '28') {
    if (dArm !== '28') return false;
    return (oCd === '1' && dCd === '6') || (oCd === '6' && dCd === '1');
  }

  return false;
}

let ZERO_STOCK_DATA = [];

const COL_MAP = {
  cd_material:     ['cd_material','cdmaterial','codigo','code','material','cod_material'],
  desc_material:   ['descmaterial','desc_material','descricao','description','nome','desc'],
  cd:              ['cd_unidade_de_n','cd_unidade_de_negocio','cd_unidade','unidade_de_negocio','unidade_negocio','cd'],
  cd_centro_armaz: ['cd_centro_armaz','cdcentroarmaz','centro_armazenagem','centro_armaz','armazem_local','local_armaz','armaz'],
  saldo:           ['saldo','qtd','quantidade','stock','quantity','balance'],
  disponivel:      ['disponivel','disponível','disp','available','stock_disponivel'],
  desc_armaz:      ['descarmaz','desc_armaz','descricao_armaz','desc_armazem','descricaoarmaz'],
  devolver:        ['devolver','qtd_devolver','return','retorno'],
};

let WMS_DATA      = [];
let TRANSFER_DATA = [];

const state = {
  estoque:  { sort: { col: null, dir: 1 }, page: 1 },
  transfer: { sort: { col: 'prioridade',  dir: 1 }, page: 1 },
  comp1:    { sort: { col: null, dir: 1 }, page: 1 },
  comp2:    { sort: { col: null, dir: 1 }, page: 1 },
};
