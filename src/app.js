const API_GET_DATA = '/api/getData';
const API_UPDATE_STICKER = '/api/updateSticker';
const API_UPDATE_MANY = '/api/updateMany';

const STATUS_OWNED = '✅ Tenho';
const STATUS_MISSING = '❌ Falta';

const STORAGE_TRADE_KEY = 'figurinhas-pietro-trade-list';

const state = {
  stickers: [],
  filtered: [],
  currentView: 'home',
  trade: new Set(),
  selectedScanCode: null,
  loading: false,
  wakeLock: null,
  scrollAssistReady: false,
};

const viewMap = {
  home: 'viewHome',
  countries: 'viewCountries',
  stickers: 'viewStickers',
  trade: 'viewTrade',
  scan: 'viewScan',
  summary: 'viewSummary',
};

const countryFlags = {
  ARG: '🇦🇷',
  BRA: '🇧🇷',
  USA: '🇺🇸',
  MEX: '🇲🇽',
  CAN: '🇨🇦',
  FRA: '🇫🇷',
  GER: '🇩🇪',
  ESP: '🇪🇸',
  ENG: '🏴',
  ITA: '🇮🇹',
  POR: '🇵🇹',
  NED: '🇳🇱',
  BEL: '🇧🇪',
  CRO: '🇭🇷',
  URU: '🇺🇾',
  COL: '🇨🇴',
  ECU: '🇪🇨',
  CHI: '🇨🇱',
  PER: '🇵🇪',
  JPN: '🇯🇵',
  KOR: '🇰🇷',
  AUS: '🇦🇺',
  MAR: '🇲🇦',
  SEN: '🇸🇳',
  GHA: '🇬🇭',
  NGR: '🇳🇬',
  FIFA: '🏆',
  FWC: '🏆',
  CC: '🥤',
};

document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
  loadTradeFromStorage();
  setupWakeLock();
  bindEvents();
  setupSortOptionLabels();
  setupScrollAssist();
  fetchData();
}


function setupSortOptionLabels() {
  const sortFilter = getEl('sortFilter');
  if (!sortFilter) return;

  const countryOption = sortFilter.querySelector('option[value="country"]');
  if (countryOption) {
    countryOption.textContent = 'Alfabética';
  }
}

function setupWakeLock() {
  requestWakeLock();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      requestWakeLock();
    }
  });
}

async function requestWakeLock() {
  try {
    if (!('wakeLock' in navigator)) return;
    if (document.visibilityState !== 'visible') return;
    if (state.wakeLock) return;

    state.wakeLock = await navigator.wakeLock.request('screen');

    state.wakeLock.addEventListener('release', () => {
      state.wakeLock = null;
    });
  } catch (error) {
    console.warn('Wake Lock não disponível neste navegador/sistema.', error);
  }
}

function bindEvents() {
  document.addEventListener('click', handleGlobalClick);

  on('searchInput', 'input', applyFilters);
  on('groupFilter', 'change', applyFilters);
  on('statusFilter', 'change', applyFilters);
  on('sortFilter', 'change', applyFilters);

  on('syncBtn', 'click', () => fetchData());
  on('summarySyncBtn', 'click', () => fetchData());
  on('scanSyncBtn', 'click', () => fetchData());

  on('clearFiltersBtn', 'click', () => {
    resetFilters();
    applyFilters();
  });

  on('confirmTradeBtn', 'click', confirmTrade);
  on('clearTradeBtn', 'click', clearTrade);

  on('scanManualCodeBtn', 'click', () => {
    const value = getEl('scanManualCodeInput')?.value || '';
    handleManualScan(value);
  });

  on('manualCodeBtn', 'click', () => {
    const value = getEl('manualCodeInput')?.value || '';
    handleManualScan(value);
  });

  on('scanManualCodeInput', 'keydown', (event) => {
    if (event.key === 'Enter') handleManualScan(event.target.value);
  });

  on('manualCodeInput', 'keydown', (event) => {
    if (event.key === 'Enter') handleManualScan(event.target.value);
  });

  on('scanMarkOwnedBtn', 'click', () => {
    if (state.selectedScanCode) {
      updateStickerStatus(state.selectedScanCode, STATUS_OWNED);
    }
  });

  on('scanAddTradeBtn', 'click', () => {
    if (state.selectedScanCode) {
      toggleTrade(state.selectedScanCode);
    }
  });

  on('exportCsvBtn', 'click', exportCsv);

  on('clearLocalBtn', 'click', () => {
    localStorage.removeItem(STORAGE_TRADE_KEY);
    state.trade.clear();
    renderAll();
    showToast('Dados locais limpos.');
  });

  on('stopCameraBtnAlt', 'click', () => {
    getEl('stopCameraBtn')?.click();
  });

  window.addEventListener('scanner:code', (event) => {
    const code = event.detail?.code || event.detail || '';
    navigateTo('scan');
    handleManualScan(code);
  });
}

function handleGlobalClick(event) {
  const navButton = event.target.closest('[data-nav]');

  if (navButton) {
    const target = navButton.dataset.nav;

    if (target === 'home') {
      resetFilters();
      applyFilters();
    }

    navigateTo(target);
    return;
  }

  const countryCard = event.target.closest('[data-country-search]');

  if (countryCard) {
    const value = countryCard.dataset.countrySearch || '';
    setValue('searchInput', value);
    navigateTo('stickers');
    applyFilters();
    return;
  }

  const actionButton = event.target.closest('[data-action]');
  if (!actionButton) return;

  const action = actionButton.dataset.action;
  const code = actionButton.dataset.code;

  if (!code) return;

  if (action === 'toggle-owned') {
    const sticker = findSticker(code);
    if (!sticker) return;

    const nextStatus = isOwned(sticker) ? STATUS_MISSING : STATUS_OWNED;
    updateStickerStatus(code, nextStatus);
  }

  if (action === 'repeat-plus') {
    changeRepeated(code, 1);
  }

  if (action === 'repeat-minus') {
    changeRepeated(code, -1);
  }

  if (action === 'trade-toggle') {
    toggleTrade(code);
  }

  if (action === 'trade-remove') {
    state.trade.delete(code);
    saveTradeToStorage();
    renderAll();
  }

  if (action === 'scan-this') {
    navigateTo('scan');
    handleManualScan(code);
  }
}

async function fetchData() {
  try {
    state.loading = true;
    showToast('Sincronizando...');

    const response = await fetch(API_GET_DATA, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Erro na API: ${response.status}`);
    }

    const json = await response.json();
    const rows = extractRows(json);

    state.stickers = rows
      .map((row, index) => normalizeSticker(row, index))
      .filter((sticker) => sticker.code);

    buildGroupFilter();
    buildSearchSuggestions();
    applyFilters();

    showToast('Dados atualizados.');
  } catch (error) {
    console.error(error);
    showToast('Erro ao buscar dados. Veja o Console.');
  } finally {
    state.loading = false;
  }
}

function extractRows(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.data)) return json.data;
  if (Array.isArray(json.rows)) return json.rows;
  if (Array.isArray(json.stickers)) return json.stickers;
  if (Array.isArray(json.items)) return json.items;
  return [];
}

function normalizeSticker(row, index) {
  const safeRow = Array.isArray(row) ? rowArrayToObject(row) : row || {};

  const group = pick(safeRow, ['Grupo', 'grupo', 'group']);
  const country = pick(safeRow, ['País/Seção', 'Pais/Seção', 'Pais', 'País', 'pais', 'country', 'section']);
  const sigla = pick(safeRow, ['Sigla', 'sigla', 'abbr']);
  const number = pick(safeRow, ['Número', 'Numero', 'numero', 'number']);
  const code = normalizeCode(pick(safeRow, ['Código', 'Codigo', 'codigo', 'code'])) || normalizeCode(`${sigla}${number}`);
  const status = pick(safeRow, ['Status', 'status']) || STATUS_MISSING;
  const repeated = toNumber(pick(safeRow, ['Repetidas', 'repetidas', 'Repeated', 'repeated']));
  const observations = pick(safeRow, ['Observações', 'Observacoes', 'observacoes', 'observations', 'obs']);

  return {
    id: code || `STICKER-${index}`,
    index,
    rowNumber: toNumber(pick(safeRow, ['rowNumber', '_rowNumber', 'row', 'linha'])) || index + 2,
    group: normalize(group),
    country: normalize(country),
    sigla: normalize(sigla).toUpperCase(),
    number: normalize(number),
    code,
    status: normalize(status),
    repeated,
    observations: normalize(observations),
    raw: safeRow,
  };
}

function rowArrayToObject(row) {
  const headers = [
    'Grupo',
    'País/Seção',
    'Sigla',
    'Número',
    'Código',
    'Status',
    'Repetidas',
    'Observações',
  ];

  return headers.reduce((object, header, index) => {
    object[header] = row[index] ?? '';
    return object;
  }, {});
}

function applyFilters() {
  const search = normalizeForSearch(getValue('searchInput'));
  const selectedGroup = getValue('groupFilter') || 'all';
  const selectedStatus = getValue('statusFilter') || 'all';

  state.filtered = state.stickers.filter((sticker) => {
    const searchBlob = normalizeForSearch(
      [
        sticker.code,
        sticker.country,
        sticker.sigla,
        sticker.group,
        displayGroupName(sticker.group),
        sticker.number,
        sticker.observations,
      ].join(' ')
    );

    const matchesSearch = !search || searchBlob.includes(search);
    const matchesGroup = selectedGroup === 'all' || sticker.group === selectedGroup;

    const matchesStatus =
      selectedStatus === 'all' ||
      (selectedStatus === 'owned' && isOwned(sticker)) ||
      (selectedStatus === 'missing' && !isOwned(sticker)) ||
      (selectedStatus === 'repeated' && repeatedCount(sticker) > 0);

    return matchesSearch && matchesGroup && matchesStatus;
  });

  sortFiltered();
  renderAll();
}

function sortFiltered() {
  const sort = getValue('sortFilter') || 'album';

  state.filtered.sort((a, b) => {
    if (sort === 'country') {
      return `${a.country} ${a.number}`.localeCompare(`${b.country} ${b.number}`, 'pt-BR');
    }

    return a.index - b.index;
  });
}

function navigateTo(view) {
  if (!viewMap[view]) return;

  state.currentView = view;

  document.querySelectorAll('.view').forEach((element) => {
    element.classList.remove('active-view');
  });

  getEl(viewMap[view])?.classList.add('active-view');

  document.querySelectorAll('[data-nav]').forEach((button) => {
    button.classList.toggle('active', button.dataset.nav === view);
  });

  renderAll();

  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  });
}

function renderAll() {
  renderStats();
  renderHomeCountries();
  renderCountriesPage();
  renderStickers();
  renderTrade();
  renderSummary();
  updateScanActions();
  refreshScrollAssist();
}

function renderStats() {
  const total = state.stickers.length;
  const owned = state.stickers.filter(isOwned).length;
  const missing = Math.max(total - owned, 0);
  const repeated = state.stickers.reduce((sum, sticker) => sum + repeatedCount(sticker), 0);
  const percent = total ? Math.round((owned / total) * 100) : 0;

  setText('summaryTotalCount', total);
  setText('summaryOwnedCount', owned);
  setText('summaryMissingCount', missing);
  setText('summaryRepeatedCount', repeated);

  setText('summaryProgressPercent', `${percent}%`);
  setText('summaryProgressText', `${owned} de ${total} figurinhas marcadas como tenho.`);

  setProgress('summaryProgressBar', percent);
}

function renderHomeCountries() {
  const sections = getSections(state.filtered);
  setText('homeResultCount', `${sections.length} seções`);
  renderCountryCards('homeCountriesGrid', sections);
}

function renderCountriesPage() {
  const sections = getSections(state.filtered);
  setText('countriesResultCount', `${sections.length} seções`);
  renderCountryCards('countriesGrid', sections);
}

function renderCountryCards(targetId, sections) {
  const target = getEl(targetId);
  if (!target) return;

  if (!sections.length) {
    target.innerHTML = emptyMessage('Nenhum país/seção encontrado.');
    return;
  }

  target.innerHTML = sections
    .map((section) => {
      const percent = section.total ? Math.round((section.owned / section.total) * 100) : 0;
      const flag = getFlag(section.sigla, section.country);

      return `
        <article class="country-card" data-country-search="${escapeAttr(section.country || section.sigla)}">
          <div class="country-top">
            <div class="country-flag">${flag}</div>
            <div>
              <h3>${escapeHtml(section.country || 'Sem país/seção')}</h3>
              <p>${escapeHtml(displayGroupName(section.group) || 'Sem grupo')} • ${escapeHtml(section.sigla || '-')}</p>
            </div>
          </div>

          <div class="country-progress-row">
            <strong>${percent}%</strong>
            <span>${section.owned}/${section.total}</span>
          </div>

          <div class="progress-track small">
            <div class="progress-bar" style="width:${percent}%; background:${percentColor(percent)}"></div>
          </div>

          <div class="country-meta">
            <span>Faltam <strong>${section.missing}</strong></span>
            <span>Repetidas <strong>${section.repeated}</strong></span>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderStickers() {
  const target = getEl('stickersGrid');
  if (!target) return;

  const stickers = state.filtered.length || hasActiveFilter() ? state.filtered : state.stickers;

  setText('resultCount', `${stickers.length} figurinhas`);

  if (!stickers.length) {
    target.innerHTML = emptyMessage('Nenhuma figurinha encontrada.');
    return;
  }

  target.innerHTML = stickers.map(renderStickerCard).join('');
}

function renderStickerCard(sticker) {
  const owned = isOwned(sticker);
  const repeated = repeatedCount(sticker);
  const isTrade = state.trade.has(sticker.code);
  const flag = getFlag(sticker.sigla, sticker.country);

  return `
    <article class="sticker-card ${owned ? 'owned' : 'missing'} ${isTrade ? 'trade-selected' : ''}">
      <div class="sticker-head">
        <div>
          <strong class="sticker-code">${escapeHtml(sticker.code)}</strong>
          <p>${flag} ${escapeHtml(sticker.country || 'Sem país')}</p>
        </div>

        <button
          class="status-pill ${owned ? 'is-owned' : 'is-missing'}"
          type="button"
          data-action="toggle-owned"
          data-code="${escapeAttr(sticker.code)}"
        >
          ${owned ? STATUS_OWNED : STATUS_MISSING}
        </button>
      </div>

      <div class="sticker-info">
        <span>Grupo <strong>${escapeHtml(displayGroupName(sticker.group) || '-')}</strong></span>
        <span>Sigla <strong>${escapeHtml(sticker.sigla || '-')}</strong></span>
      </div>

      <div class="repeat-control">
        <span>Repetidas</span>

        <div>
          <button type="button" data-action="repeat-minus" data-code="${escapeAttr(sticker.code)}">−</button>
          <strong>${repeated}</strong>
          <button type="button" data-action="repeat-plus" data-code="${escapeAttr(sticker.code)}">+</button>
        </div>
      </div>

      <div class="sticker-actions">
        <button
          class="${isTrade ? 'secondary-btn active-trade' : 'secondary-btn'}"
          type="button"
          data-action="trade-toggle"
          data-code="${escapeAttr(sticker.code)}"
        >
          ${isTrade ? '★ Na troca' : '☆ Favoritar'}
        </button>

        <button
          class="ghost-btn"
          type="button"
          data-action="scan-this"
          data-code="${escapeAttr(sticker.code)}"
        >
          Ver
        </button>
      </div>
    </article>
  `;
}

function renderTrade() {
  const target = getEl('tradeList');
  if (!target) return;

  const items = [...state.trade]
    .map((code) => findSticker(code))
    .filter(Boolean);

  setText('tradeCount', `${items.length} selecionadas`);

  if (!items.length) {
    target.innerHTML = emptyMessage('Nenhuma figurinha favoritada para troca.');
    return;
  }

  target.innerHTML = items
    .map((sticker) => {
      const flag = getFlag(sticker.sigla, sticker.country);

      return `
        <article class="trade-item">
          <div>
            <strong>${escapeHtml(sticker.code)}</strong>
            <p>${flag} ${escapeHtml(sticker.country)} • ${escapeHtml(displayGroupName(sticker.group))}</p>
          </div>

          <button
            class="ghost-btn compact"
            type="button"
            data-action="trade-remove"
            data-code="${escapeAttr(sticker.code)}"
          >
            Remover
          </button>
        </article>
      `;
    })
    .join('');
}

function renderSummary() {
  renderGroupProgress();

  const sections = getSections(state.stickers);

  const mostMissing = [...sections].sort((a, b) => b.missing - a.missing).slice(0, 8);
  const mostOwned = [...sections].sort((a, b) => b.owned - a.owned).slice(0, 8);
  const completed = sections.filter((section) => section.total > 0 && section.owned === section.total);
  const topRepeated = [...state.stickers]
    .filter((sticker) => repeatedCount(sticker) > 0)
    .sort((a, b) => repeatedCount(b) - repeatedCount(a))
    .slice(0, 10);

  renderMiniList(
    'rankMostMissing',
    mostMissing.map((item) => ({
      title: item.country,
      value: `${item.missing} faltam`,
      meta: `${item.owned}/${item.total}`,
    })),
    'Nenhuma seção encontrada.'
  );

  renderMiniList(
    'rankMostOwned',
    mostOwned.map((item) => ({
      title: item.country,
      value: `${item.owned} tenho`,
      meta: `${item.owned}/${item.total}`,
    })),
    'Nenhuma seção encontrada.'
  );

  renderMiniList(
    'rankCompleted',
    completed.map((item) => ({
      title: item.country,
      value: 'Completo',
      meta: `${item.total}/${item.total}`,
    })),
    'Nenhuma seção completa ainda.'
  );

  renderMiniList(
    'rankTopRepeated',
    topRepeated.map((item) => ({
      title: item.code,
      value: `${repeatedCount(item)} repetidas`,
      meta: item.country,
    })),
    'Nenhuma repetida cadastrada.'
  );
}

function renderGroupProgress() {
  const target = getEl('groupProgress');
  if (!target) return;

  const groups = new Map();

  state.stickers.forEach((sticker) => {
    const key = sticker.group || 'Sem grupo';

    if (!groups.has(key)) {
      groups.set(key, {
        group: key,
        total: 0,
        owned: 0,
      });
    }

    const item = groups.get(key);
    item.total += 1;
    if (isOwned(sticker)) item.owned += 1;
  });

  const items = [...groups.values()].sort((a, b) => sortGroups(a.group, b.group));

  if (!items.length) {
    target.innerHTML = emptyMessage('Nenhum grupo encontrado.');
    return;
  }

  target.innerHTML = items
    .map((item) => {
      const percent = item.total ? Math.round((item.owned / item.total) * 100) : 0;

      return `
        <article class="group-row">
          <div>
            <strong>${escapeHtml(displayGroupName(item.group))}</strong>
            <span>${item.owned}/${item.total}</span>
          </div>

          <div class="progress-track small">
            <div class="progress-bar" style="width:${percent}%; background:${percentColor(percent)}"></div>
          </div>

          <b>${percent}%</b>
        </article>
      `;
    })
    .join('');
}

function renderMiniList(targetId, items, emptyText) {
  const target = getEl(targetId);
  if (!target) return;

  if (!items.length) {
    target.innerHTML = emptyMessage(emptyText);
    return;
  }

  target.innerHTML = items
    .map(
      (item) => `
        <div class="mini-item">
          <div>
            <strong>${escapeHtml(item.title || '-')}</strong>
            <span>${escapeHtml(item.meta || '')}</span>
          </div>

          <b>${escapeHtml(item.value || '')}</b>
        </div>
      `
    )
    .join('');
}

async function updateStickerStatus(code, status) {
  const sticker = findSticker(code);
  if (!sticker) return;

  const previous = sticker.status;
  sticker.status = status;

  renderAll();

  try {
    await sendStickerUpdate(sticker);
    showToast(`${sticker.code} atualizado.`);
  } catch (error) {
    console.error(error);
    sticker.status = previous;
    renderAll();
    showToast('Erro ao atualizar status.');
  }
}

async function changeRepeated(code, amount) {
  const sticker = findSticker(code);
  if (!sticker) return;

  const previous = sticker.repeated;
  sticker.repeated = Math.max(0, repeatedCount(sticker) + amount);

  renderAll();

  try {
    await sendStickerUpdate(sticker);
    showToast(`${sticker.code} atualizado.`);
  } catch (error) {
    console.error(error);
    sticker.repeated = previous;
    renderAll();
    showToast('Erro ao atualizar repetidas.');
  }
}

async function sendStickerUpdate(sticker) {
  const payload = {
    code: sticker.code,
    codigo: sticker.code,
    Código: sticker.code,
    status: sticker.status,
    Status: sticker.status,
    repeated: repeatedCount(sticker),
    repetidas: repeatedCount(sticker),
    Repetidas: repeatedCount(sticker),
    rowNumber: sticker.rowNumber,
    row: sticker.rowNumber,
  };

  const response = await fetch(API_UPDATE_STICKER, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Erro updateSticker: ${response.status}`);
  }

  return response.json().catch(() => ({}));
}

async function confirmTrade() {
  const items = [...state.trade]
    .map((code) => findSticker(code))
    .filter(Boolean);

  if (!items.length) {
    showToast('Nenhuma figurinha na troca.');
    return;
  }

  const previous = items.map((item) => ({
    code: item.code,
    status: item.status,
  }));

  items.forEach((item) => {
    item.status = STATUS_OWNED;
  });

  renderAll();

  try {
    if (items.length === 1) {
      await sendStickerUpdate(items[0]);
    } else {
      const updates = items.map((sticker) => ({
        code: sticker.code,
        codigo: sticker.code,
        Código: sticker.code,
        status: STATUS_OWNED,
        Status: STATUS_OWNED,
        repeated: repeatedCount(sticker),
        repetidas: repeatedCount(sticker),
        Repetidas: repeatedCount(sticker),
        rowNumber: sticker.rowNumber,
        row: sticker.rowNumber,
      }));

      await sendManyUpdate(updates);
    }

    state.trade.clear();
    saveTradeToStorage();
    renderAll();

    showToast('Troca efetivada.');
  } catch (error) {
    console.warn('updateMany falhou. Tentando atualizar uma por uma...', error);

    try {
      for (const sticker of items) {
        await sendStickerUpdate(sticker);
      }

      state.trade.clear();
      saveTradeToStorage();
      renderAll();

      showToast('Troca efetivada.');
    } catch (fallbackError) {
      console.error(fallbackError);

      previous.forEach((item) => {
        const sticker = findSticker(item.code);
        if (sticker) sticker.status = item.status;
      });

      renderAll();
      showToast('Erro ao efetivar troca.');
    }
  }
}

async function sendManyUpdate(updates) {
  const payloads = [
    { updates },
    { stickers: updates },
    updates,
  ];

  let lastError = null;

  for (const payload of payloads) {
    try {
      const response = await fetch(API_UPDATE_MANY, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        return response.json().catch(() => ({}));
      }

      lastError = new Error(`Erro updateMany: ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Erro updateMany.');
}

function clearTrade() {
  state.trade.clear();
  saveTradeToStorage();
  renderAll();
  showToast('Lista de troca limpa.');
}

function toggleTrade(code) {
  if (state.trade.has(code)) {
    state.trade.delete(code);
    showToast(`${code} removida da troca.`);
  } else {
    state.trade.add(code);
    showToast(`${code} adicionada na troca.`);
  }

  saveTradeToStorage();
  renderAll();
}

function handleManualScan(value) {
  const code = normalizeCode(value);

  if (!code) {
    showToast('Digite um código.');
    return;
  }

  const sticker = findSticker(code);

  state.selectedScanCode = sticker?.code || code;

  renderScannerResult(sticker, code);
  updateScanActions();

  if (getEl('scannerResult')) {
    getEl('scannerResult').textContent = sticker
      ? `${sticker.code} encontrada.`
      : `${code} não encontrada.`;
  }
}

function renderScannerResult(sticker, searchedCode) {
  const target = getEl('scannerResultPage');
  if (!target) return;

  if (!sticker) {
    target.innerHTML = `
      <div class="scan-not-found">
        <strong>${escapeHtml(searchedCode)}</strong>
        <p>Código não encontrado na planilha.</p>
      </div>
    `;
    return;
  }

  const owned = isOwned(sticker);
  const flag = getFlag(sticker.sigla, sticker.country);

  target.innerHTML = `
    <article class="scan-card">
      <div>
        <strong>${escapeHtml(sticker.code)}</strong>
        <p>${flag} ${escapeHtml(sticker.country)} • ${escapeHtml(displayGroupName(sticker.group))}</p>
      </div>

      <span class="${owned ? 'status-ok' : 'status-missing'}">
        ${owned ? STATUS_OWNED : STATUS_MISSING}
      </span>
    </article>
  `;
}

function updateScanActions() {
  const actions = getEl('scannerResultActions');
  if (!actions) return;

  const sticker = findSticker(state.selectedScanCode);
  actions.classList.toggle('hidden', !sticker);
}

function exportCsv() {
  if (!state.stickers.length) {
    showToast('Nenhum dado para exportar.');
    return;
  }

  const headers = ['Grupo', 'País/Seção', 'Sigla', 'Número', 'Código', 'Status', 'Repetidas', 'Observações'];

  const rows = state.stickers.map((sticker) => [
    displayGroupName(sticker.group),
    sticker.country,
    sticker.sigla,
    sticker.number,
    sticker.code,
    sticker.status,
    repeatedCount(sticker),
    sticker.observations,
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map(csvEscape).join(','))
    .join('\n');

  const blob = new Blob([csv], {
    type: 'text/csv;charset=utf-8;',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = 'figurinhas-pietro.csv';
  link.click();

  URL.revokeObjectURL(url);
}

function getSections(stickers) {
  const map = new Map();

  stickers.forEach((sticker) => {
    const key = `${sticker.country || 'Sem país'}|${sticker.sigla || ''}`;

    if (!map.has(key)) {
      map.set(key, {
        country: sticker.country || 'Sem país',
        sigla: sticker.sigla || '',
        group: sticker.group || '',
        total: 0,
        owned: 0,
        missing: 0,
        repeated: 0,
        firstIndex: sticker.index,
      });
    }

    const item = map.get(key);

    item.total += 1;
    item.owned += isOwned(sticker) ? 1 : 0;
    item.repeated += repeatedCount(sticker);
    item.firstIndex = Math.min(item.firstIndex, sticker.index);
  });

  const sections = [...map.values()].map((section) => ({
    ...section,
    missing: Math.max(section.total - section.owned, 0),
    percent: section.total ? Math.round((section.owned / section.total) * 100) : 0,
  }));

  const sort = getValue('sortFilter') || 'album';

  if (sort === 'country') {
    return sections.sort((a, b) => a.country.localeCompare(b.country, 'pt-BR'));
  }

  if (sort === 'percent') {
    return sections.sort((a, b) => b.percent - a.percent);
  }

  if (sort === 'missing') {
    return sections.sort((a, b) => b.missing - a.missing);
  }

  return sections.sort((a, b) => a.firstIndex - b.firstIndex);
}

function buildGroupFilter() {
  const select = getEl('groupFilter');
  if (!select) return;

  const currentValue = select.value || 'all';

  const groups = [...new Set(state.stickers.map((sticker) => sticker.group).filter(Boolean))]
    .sort(sortGroups);

  select.innerHTML = `
    <option value="all">Todos os grupos</option>
    ${groups
      .map((group) => `<option value="${escapeAttr(group)}">${escapeHtml(displayGroupName(group))}</option>`)
      .join('')}
  `;

  select.value = groups.includes(currentValue) ? currentValue : 'all';
}

function buildSearchSuggestions() {
  const list = getEl('searchSuggestions');
  if (!list) return;

  const values = new Set();

  state.stickers.forEach((sticker) => {
    if (sticker.code) values.add(sticker.code);
    if (sticker.country) values.add(sticker.country);
    if (sticker.sigla) values.add(sticker.sigla);
    if (sticker.group) values.add(sticker.group);
    if (displayGroupName(sticker.group)) values.add(displayGroupName(sticker.group));
  });

  list.innerHTML = [...values]
    .slice(0, 500)
    .map((value) => `<option value="${escapeAttr(value)}"></option>`)
    .join('');
}

function resetFilters() {
  setValue('searchInput', '');
  setValue('groupFilter', 'all');
  setValue('statusFilter', 'all');
  setValue('sortFilter', 'album');
}

function hasActiveFilter() {
  return (
    Boolean(getValue('searchInput')) ||
    getValue('groupFilter') !== 'all' ||
    getValue('statusFilter') !== 'all'
  );
}

function loadTradeFromStorage() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_TRADE_KEY) || '[]');
    state.trade = new Set(Array.isArray(saved) ? saved : []);
  } catch {
    state.trade = new Set();
  }
}

function saveTradeToStorage() {
  localStorage.setItem(STORAGE_TRADE_KEY, JSON.stringify([...state.trade]));
}

function findSticker(code) {
  const normalized = normalizeCode(code);
  return state.stickers.find((sticker) => normalizeCode(sticker.code) === normalized);
}

function isOwned(sticker) {
  const status = normalize(sticker?.status).toLowerCase();
  return status.includes('tenho') || status.includes('✅');
}

function repeatedCount(sticker) {
  return toNumber(sticker?.repeated);
}

function displayGroupName(group) {
  const value = normalize(group);
  const key = normalizeForSearch(value);

  if (key === 'inicial') return 'FWC';
  if (key === 'fwc') return 'FWC';
  if (key === 'cc') return 'Coca Cola';
  if (key === 'cocacola' || key === 'coca cola') return 'Coca Cola';

  return value;
}

function sortGroups(a, b) {
  const rankA = groupRank(a);
  const rankB = groupRank(b);

  if (rankA !== rankB) return rankA - rankB;

  return displayGroupName(a).localeCompare(displayGroupName(b), 'pt-BR');
}

function groupRank(group) {
  const name = normalizeForSearch(displayGroupName(group)).replace(/\s+/g, '');

  if (name === 'fwc' || name === 'inicial') return -1000;
  if (name === 'cc' || name === 'cocacola') return 1000;

  return 0;
}


function setupScrollAssist() {
  if (state.scrollAssistReady) return;
  if (document.querySelector('.scroll-assist')) return;

  const assist = document.createElement('div');
  assist.className = 'scroll-assist';
  assist.innerHTML = `
    <div class="scroll-assist-track" aria-hidden="true">
      <div class="scroll-assist-thumb"></div>
    </div>
  `;

  document.body.appendChild(assist);

  const track = assist.querySelector('.scroll-assist-track');
  const thumb = assist.querySelector('.scroll-assist-thumb');

  if (!track || !thumb) return;

  state.scrollAssistReady = true;

  let isDragging = false;
  let hideTimer = null;
  let dragOffset = 0;

  const getPointerY = (event) => {
    if (event.touches && event.touches.length) return event.touches[0].clientY;
    if (event.changedTouches && event.changedTouches.length) return event.changedTouches[0].clientY;
    return event.clientY;
  };

  const getMaxScroll = () => {
    const documentHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );

    return Math.max(documentHeight - window.innerHeight, 0);
  };

  const getMetrics = () => {
    const rect = track.getBoundingClientRect();
    const documentHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      1
    );
    const maxScroll = getMaxScroll();
    const thumbHeight = Math.max(
      72,
      Math.min(rect.height, (window.innerHeight / documentHeight) * rect.height)
    );
    const movableHeight = Math.max(rect.height - thumbHeight, 1);

    return {
      rect,
      maxScroll,
      thumbHeight,
      movableHeight,
    };
  };

  const showScrollAssist = () => {
    assist.classList.add('is-active');

    window.clearTimeout(hideTimer);

    if (!isDragging) {
      hideTimer = window.setTimeout(() => {
        assist.classList.remove('is-active');
      }, 1400);
    }
  };

  const updateScrollAssist = (expand = false) => {
    const maxScroll = getMaxScroll();

    if (maxScroll <= 8) {
      assist.classList.add('hidden');
      return;
    }

    assist.classList.remove('hidden');

    const { thumbHeight, movableHeight } = getMetrics();
    const top = (window.scrollY / maxScroll) * movableHeight;

    thumb.style.height = `${thumbHeight}px`;
    thumb.style.transform = `translate3d(0, ${top}px, 0)`;

    if (expand) showScrollAssist();
  };

  const scrollFromPointer = (clientY, centerThumb = false) => {
    const { rect, maxScroll, thumbHeight, movableHeight } = getMetrics();
    const offset = centerThumb ? thumbHeight / 2 : dragOffset;
    const ratio = clampNumber((clientY - rect.top - offset) / movableHeight, 0, 1);

    window.scrollTo({
      top: ratio * maxScroll,
      behavior: 'auto',
    });
  };

  const startDrag = (event) => {
    if (getMaxScroll() <= 8) return;

    isDragging = true;
    assist.classList.add('is-active', 'is-dragging');

    const clientY = getPointerY(event);
    const { rect, maxScroll, thumbHeight, movableHeight } = getMetrics();
    const currentThumbTop = rect.top + (window.scrollY / Math.max(maxScroll, 1)) * movableHeight;
    const isInsideThumb = clientY >= currentThumbTop && clientY <= currentThumbTop + thumbHeight;

    dragOffset = isInsideThumb ? clientY - currentThumbTop : thumbHeight / 2;
    scrollFromPointer(clientY, !isInsideThumb);
    updateScrollAssist(true);

    event.preventDefault();
    event.stopPropagation();
  };

  const moveDrag = (event) => {
    if (!isDragging) return;

    scrollFromPointer(getPointerY(event));
    updateScrollAssist(true);

    event.preventDefault();
    event.stopPropagation();
  };

  const endDrag = () => {
    if (!isDragging) return;

    isDragging = false;
    assist.classList.remove('is-dragging');
    showScrollAssist();
  };

  track.addEventListener('touchstart', startDrag, { passive: false });
  window.addEventListener('touchmove', moveDrag, { passive: false });
  window.addEventListener('touchend', endDrag, { passive: true });
  window.addEventListener('touchcancel', endDrag, { passive: true });

  track.addEventListener('mousedown', startDrag);
  window.addEventListener('mousemove', moveDrag);
  window.addEventListener('mouseup', endDrag);

  window.addEventListener(
    'scroll',
    () => {
      window.requestAnimationFrame(() => updateScrollAssist(true));
    },
    { passive: true }
  );

  window.addEventListener(
    'resize',
    () => {
      window.requestAnimationFrame(() => updateScrollAssist(false));
    },
    { passive: true }
  );

  window.refreshScrollAssist = () => updateScrollAssist(false);

  window.setTimeout(() => updateScrollAssist(false), 120);
}

function refreshScrollAssist() {
  if (typeof window.refreshScrollAssist !== 'function') return;

  window.requestAnimationFrame(() => {
    window.refreshScrollAssist();
    window.setTimeout(window.refreshScrollAssist, 80);
  });
}

function getFlag(sigla, country) {
  const key = normalize(sigla).toUpperCase();

  if (countryFlags[key]) return countryFlags[key];

  const text = normalize(country).toLowerCase();

  if (text.includes('brasil')) return '🇧🇷';
  if (text.includes('argentina')) return '🇦🇷';
  if (text.includes('estados unidos') || text.includes('usa')) return '🇺🇸';
  if (text.includes('méxico') || text.includes('mexico')) return '🇲🇽';
  if (text.includes('canadá') || text.includes('canada')) return '🇨🇦';
  if (text.includes('fifa')) return '🏆';
  if (text.includes('coca')) return '🥤';

  return '🏳️';
}

function setProgress(id, percent) {
  const element = getEl(id);
  if (!element) return;

  element.style.width = `${percent}%`;
  element.style.background = percentColor(percent);
}

function percentColor(percent) {
  const value = clampNumber(percent, 0, 100);

  const red = {
    r: 255,
    g: 93,
    b: 87,
  };

  const yellow = {
    r: 255,
    g: 209,
    b: 90,
  };

  const green = {
    r: 50,
    g: 217,
    b: 115,
  };

  if (value <= 50) {
    const amount = value / 50;
    return rgbToCss(interpolateColor(red, yellow, amount));
  }

  const amount = (value - 50) / 50;
  return rgbToCss(interpolateColor(yellow, green, amount));
}

function interpolateColor(start, end, amount) {
  return {
    r: Math.round(start.r + (end.r - start.r) * amount),
    g: Math.round(start.g + (end.g - start.g) * amount),
    b: Math.round(start.b + (end.b - start.b) * amount),
  };
}

function rgbToCss(color) {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

function pick(object, keys) {
  if (!object) return '';

  for (const key of keys) {
    if (object[key] !== undefined && object[key] !== null) {
      return object[key];
    }
  }

  const normalizedKeys = Object.keys(object);

  for (const wantedKey of keys) {
    const foundKey = normalizedKeys.find(
      (key) => normalizeKey(key) === normalizeKey(wantedKey)
    );

    if (foundKey) return object[foundKey];
  }

  return '';
}

function normalize(value) {
  return String(value ?? '').trim();
}

function normalizeCode(value) {
  return normalize(value)
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

function normalizeForSearch(value) {
  return normalize(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKey(value) {
  return normalizeForSearch(value).replace(/[^a-z0-9]/g, '');
}

function toNumber(value) {
  const number = Number(String(value ?? '0').replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(Number(value) || 0, min), max);
}

function getEl(id) {
  return document.getElementById(id);
}

function getValue(id) {
  return getEl(id)?.value ?? '';
}

function setValue(id, value) {
  const element = getEl(id);
  if (element) element.value = value;
}

function setText(id, value) {
  const element = getEl(id);
  if (element) element.textContent = value;
}

function on(id, eventName, handler) {
  const element = getEl(id);
  if (element) element.addEventListener(eventName, handler);
}

function showToast(message) {
  const toast = getEl('toast');

  if (!toast) {
    console.log(message);
    return;
  }

  toast.textContent = message;
  toast.classList.remove('hidden');

  window.clearTimeout(showToast.timeout);

  showToast.timeout = window.setTimeout(() => {
    toast.classList.add('hidden');
  }, 2400);
}

function emptyMessage(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function csvEscape(value) {
  const text = normalize(value).replace(/"/g, '""');
  return `"${text}"`;
}

function escapeHtml(value) {
  return normalize(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}
