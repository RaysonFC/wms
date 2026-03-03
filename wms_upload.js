/* ============================================================
   WMS ANALÍTICO — wms_upload.js  [v2.0]
   Upload de Excel/CSV com drag-drop e validação melhorada.
   Usa SheetJS (xlsx) para parsing.
   ============================================================ */

(function () {
  'use strict';

  const uploadCard   = document.getElementById('upload-card');
  const fileInput    = document.getElementById('file-input');
  const progressBar  = document.getElementById('upload-progress');
  const progressFill = document.getElementById('upload-fill');
  const progressLbl  = document.getElementById('upload-label');
  const errorBox     = document.getElementById('upload-error');

  /* ── Clique para abrir seletor ── */
  uploadCard.addEventListener('click', e => {
    if (e.target === fileInput) return;
    fileInput.click();
  });

  /* ── Drag & drop ── */
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

  /* ── Processamento ── */
  function setProgress(pct, msg) {
    progressBar.style.display = 'block';
    progressFill.style.width  = pct + '%';
    progressLbl.textContent   = msg;
  }

  function showError(msg) {
    errorBox.textContent   = '⚠ ' + msg;
    errorBox.style.display = 'block';
    progressBar.style.display = 'none';
  }

  function clearError() {
    errorBox.style.display = 'none';
  }

  function processFile(file) {
    clearError();

    const name = file.name.toLowerCase();
    const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.xlsm');
    const isCSV   = name.endsWith('.csv');

    if (!isExcel && !isCSV) {
      showError(`Formato não suportado: "${file.name}". Use .xlsx, .xls ou .csv.`);
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

        const sheetName = workbook.SheetNames[0];
        const sheet     = workbook.Sheets[sheetName];

        setProgress(75, 'Mapeando colunas...');

        const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        if (!raw.length) { showError('Planilha vazia.'); return; }

        const headers = raw[0].map(h => String(h ?? ''));
        const dataRows = raw.slice(1).filter(r => r.some(c => c !== ''));

        /* ── Mapeamento de colunas ── */
        const idxMap = {};
        for (const [field, aliases] of Object.entries(COL_MAP)) {
          idxMap[field] = findCol(headers, aliases);
        }

        /* Validação: campos obrigatórios */
        const required = ['cd_material', 'cd', 'saldo'];
        const missing  = required.filter(f => idxMap[f] === -1);
        if (missing.length) {
          showError(`Colunas obrigatórias não encontradas: ${missing.join(', ')}.\nVerifique se os cabeçalhos estão corretos.`);
          return;
        }

        setProgress(90, 'Construindo dataset...');

        WMS_DATA = dataRows
          .map(row => ({
            cd_material:     String(row[idxMap.cd_material]     ?? '').trim(),
            desc_material:   String(row[idxMap.desc_material]   ?? '').trim(),
            cd:              String(row[idxMap.cd]              ?? '').trim(),
            cd_centro_armaz: String(row[idxMap.cd_centro_armaz] ?? '').trim(),
            saldo:           num(row[idxMap.saldo]),
            desc_armaz:      idxMap.desc_armaz   !== -1 ? String(row[idxMap.desc_armaz]   ?? '').trim() : '',
            devolver:        idxMap.devolver      !== -1 ? num(row[idxMap.devolver])                    : null,
          }))
          .filter(r => r.cd_material && !r.cd_material.startsWith('900'));

        if (!WMS_DATA.length) {
          showError('Nenhum dado válido encontrado na planilha. Verifique o formato.');
          return;
        }

        const blocked900 = dataRows.length - WMS_DATA.length - dataRows.filter(r => !String(r[idxMap.cd_material] ?? '').trim()).length;
        const blockedMsg = blocked900 > 0 ? ` · ${blocked900.toLocaleString('pt-BR')} cód. 900* ignorados` : '';
        setProgress(100, `✔ ${WMS_DATA.length.toLocaleString('pt-BR')} registros carregados${blockedMsg}`);

        /* Gera sugestões de transferência */
        TRANSFER_DATA = buildTransferSuggestions();

        setTimeout(() => launchApp(file.name), 400);

      } catch (err) {
        console.error(err);
        showError('Erro ao processar o arquivo: ' + err.message);
      }
    };

    reader.onerror = () => showError('Falha ao ler o arquivo.');

    if (isCSV) {
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.readAsArrayBuffer(file);
    }
  }

})();
