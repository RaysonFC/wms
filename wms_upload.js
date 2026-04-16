/* ============================================================
   WMS ANALÍTICO — wms_upload.js  [v3.1]
   DISPONIVEL é a fonte principal obrigatória.
   Fallback para SALDO apenas se coluna DISPONIVEL não existir na planilha.
   DISPONIVEL = 0 é valor legítimo (nunca substitui por SALDO).
   ============================================================ */

(function () {
  'use strict';

  const uploadCard   = document.getElementById('upload-card');
  const fileInput    = document.getElementById('file-input');
  const progressBar  = document.getElementById('upload-progress');
  const progressFill = document.getElementById('upload-fill');
  const progressLbl  = document.getElementById('upload-label');
  const errorBox     = document.getElementById('upload-error');

  // Click handler movido para baixo com File System Access API (capture:true)

  ['dragenter', 'dragover'].forEach(ev =>
    uploadCard.addEventListener(ev, e => {
      e.preventDefault();
      uploadCard.classList.add('dragover');
    })
  );

  ['dragleave', 'dragend', 'drop'].forEach(ev =>
    uploadCard.addEventListener(ev, e => {
      e.preventDefault();
      uploadCard.classList.remove('dragover');
    })
  );

  uploadCard.addEventListener('drop', e => {
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  });

  fileInput.addEventListener('change', e => {
    if (e.target.files[0]) processFile(e.target.files[0]);
    fileInput.value = '';
  });

  // Sobrescreve o clique do upload-card para usar File System Access API
  // quando disponível — assim obtém handle real do arquivo no disco
  uploadCard.addEventListener('click', async (e) => {
    if (e.target === fileInput) return;
    // Tenta usar File System Access API (Chrome/Edge)
    if (window.showOpenFilePicker) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{
            description: 'Planilhas',
            accept: {
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
              'application/vnd.ms-excel': ['.xls', '.xlsm'],
              'text/csv': ['.csv'],
            }
          }],
          multiple: false
        });
        window._fileHandle = handle;
        const file = await handle.getFile();
        processFile(file);
        return;
      } catch(e) {
        // Usuário cancelou ou API não disponível → fallback para input normal
        if (e.name !== 'AbortError') fileInput.click();
      }
    } else {
      fileInput.click();
    }
  }, true); // capture=true para interceptar antes do listener anterior

  // ── File System Access API: guarda handle real do arquivo no disco ──
  // Isso permite reler o arquivo ATUALIZADO do disco (não a cópia em memória)
  window._fileHandle = null;

  window.reloadLastFile = async function() {
    // Se tem handle da File System Access API → relê do disco (pega versão atual)
    if (window._fileHandle) {
      try {
        const file = await window._fileHandle.getFile();
        processFile(file);
        return;
      } catch(e) {
        console.warn('Handle expirado, usando cópia em memória:', e);
      }
    }
    // Fallback: cópia em memória (versão do momento do drag)
    if (window._lastFile) processFile(window._lastFile);
  };

  function setProgress(pct, msg) {
    progressBar.style.display = 'block';
    progressFill.style.width  = pct + '%';
    progressLbl.textContent   = msg;
  }

  function showError(msg) {
    errorBox.textContent      = '⚠ ' + msg;
    errorBox.style.display    = 'block';
    progressBar.style.display = 'none';
  }

  function clearError() {
    errorBox.style.display = 'none';
  }

  /*
   * FUNÇÃO NUM ROBUSTA
   * Quantidades de estoque são sempre inteiras → Math.round em tudo.
   * Elimina imprecisões de ponto flutuante do Excel
   * (ex: 24772.000000001 → 24772).
   *
   * Suporta:
   *  - number JS nativo do Excel  → Math.round direto
   *  - string BR "24.772,421"     → converte e arredonda
   *  - string US "24772.421"      → converte e arredonda
   */
  function num(v) {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return isNaN(v) ? 0 : Math.round(v);
    const s = String(v).trim();
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s))
      return Math.round(parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0);
    if (/^\d+(,\d+)?$/.test(s))
      return Math.round(parseFloat(s.replace(',', '.')) || 0);
    return Math.round(parseFloat(s) || 0);
  }

  function processFile(file) {
    clearError();

    const name    = file.name.toLowerCase();
    const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.xlsm');
    const isCSV   = name.endsWith('.csv');

    if (!isExcel && !isCSV) {
      showError(`Formato não suportado: "${file.name}"`);
      return;
    }

    setProgress(20, 'Lendo arquivo...');

    const reader = new FileReader();

    reader.onload = e => {
      try {
        setProgress(50, 'Processando planilha...');

        let workbook;
        if (isCSV) {
          workbook = XLSX.read(e.target.result, { type: 'string', raw: false });
        } else {
          workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        }

        const TARGET_SHEET = 'AVM_ESTOQUE_Unidade';
        const sheetName =
          workbook.SheetNames.find(n =>
            n.trim().toLowerCase() === TARGET_SHEET.toLowerCase()
          ) || workbook.SheetNames[0];

        console.log('📄 Aba usada:', sheetName);

        const sheet    = workbook.Sheets[sheetName];
        const raw      = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (!raw.length) {
          showError('Planilha vazia.');
          return;
        }

        const headers  = raw[0].map(h => String(h ?? '').trim().toLowerCase());
        const dataRows = raw.slice(1).filter(r => r.some(c => c !== ''));

        /* DETECÇÃO FLEXÍVEL DE COLUNAS */
        const idx = {
          cd_material:     headers.findIndex(h => h.includes('material')),
          desc_material:   headers.findIndex(h => h.includes('descr')),
          cd:              headers.findIndex(h => h === 'cd' || h.includes('unidade')),
          cd_centro_armaz: headers.findIndex(h => h.includes('armaz') && !h.includes('desc')),
          saldo:           headers.findIndex(h => h.includes('saldo')),
          disponivel:      headers.findIndex(h => h.includes('dispon')),
          desc_armaz:      headers.findIndex(h => h.includes('desc') && h.includes('armaz')),
          devolver:        headers.findIndex(h => h.includes('devolver') || h.includes('retorno')),
        };

        console.log('🔎 Índices:', idx);

        if (idx.cd_material === -1 || idx.cd === -1 || idx.saldo === -1) {
          showError('Colunas básicas não encontradas (material, cd, saldo)');
          return;
        }

        const temDisponivel = idx.disponivel !== -1;
        console.log('📊 Coluna DISPONIVEL encontrada:', temDisponivel);

        setProgress(90, 'Construindo dataset...');

        WMS_DATA = dataRows.map(row => {
          const saldo = num(row[idx.saldo]);

          /*
           * REGRA PRINCIPAL: DISPONIVEL é obrigatório.
           * - Coluna existe → usa sempre, mesmo que seja 0.
           *   DISPONIVEL = 0 significa sem estoque (não é erro).
           * - Coluna NÃO existe → fallback para SALDO.
           * NUNCA substitui DISPONIVEL=0 por SALDO.
           */
          const disponivel = temDisponivel
            ? num(row[idx.disponivel])     // inteiro — Math.round elimina float do Excel
            : saldo;

          return {
            cd_material:     String(row[idx.cd_material]     ?? '').trim(),
            desc_material:   String(row[idx.desc_material]   ?? '').trim(),
            cd:              String(row[idx.cd]              ?? '').trim(),
            cd_centro_armaz: String(row[idx.cd_centro_armaz] ?? '').trim(),
            saldo,
            disponivel,
            desc_armaz: idx.desc_armaz !== -1
              ? String(row[idx.desc_armaz] ?? '').trim()
              : '',
            devolver: idx.devolver !== -1
              ? num(row[idx.devolver])
              : null,
          };
        });

        console.log('✅ Exemplo carregado:', WMS_DATA[0]);
        setProgress(100, `✔ ${WMS_DATA.length} registros carregados`);

        TRANSFER_DATA = buildTransferSuggestions();

        window._lastFile = file; // guarda referência para o botão Recarregar
        setTimeout(() => launchApp(file.name), 300);

      } catch (err) {
        console.error(err);
        showError('Erro: ' + err.message);
      }
    };

    reader.onerror = () => showError('Erro ao ler arquivo.');

    if (isCSV) {
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.readAsArrayBuffer(file);
    }
  }

})();