const STATUS_OWNED = '✅ Tenho';
const STATUS_MISSING = '❌ Falta';

const state = {
  stickers: [],
  filtered: [],
  view: 'home',
  query: '',
  groupFilter: 'all',
  statusFilter: 'all',
  sortFilter: 'album',
  countryFilter: 'all',
  summaryTab: 'album',
  selectedCountryKey: '',
  tradeFavorites: new Set(JSON.parse(localStorage.getItem('tradeFavorites') || '[]')),
  loading: false,
  autoSync: true,
  autoSyncTimer: null
};

const $ = (id) => document.getElementById(id);

const normalize = (value) => String(value ?? '').trim();

const normalizeCode = (value) =>
  normalize(value).toUpperCase().replace(/\s+/g, '');

function escapeHtml(value) {
  return normalize(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function makeCountryKey(pais, sigla, grupo) {
  return `${normalize(pais)}||${normalize(sigla)}||${normalize(grupo)}`;
}

function getStickerCountryKey(sticker) {
  return makeCountryKey(sticker.pais, sticker.sigla, sticker.grupo);
}

const countryFlag = (sigla = '') => {
  const code = normalize(sigla).toUpperCase();

  const map = {
    FWC: '🏆',
    FIFA: '🏆',
    CC: '🥤',
    COC: '🥤',

    ARG: '🇦🇷',
    AUS: '🇦🇺',
    BEL: '🇧🇪',
    BIH: '🇧🇦',
    BRA: '🇧🇷',
    CAN: '🇨🇦',
    CHI: '🇨🇱',
    CIV: '🇨🇮',
    COL: '🇨🇴',
    CRC: '🇨🇷',
    CRO: '🇭🇷',
    CUW: '🇨🇼',
    CZE: '🇨🇿',
    DEN: '🇩🇰',
    ECU: '🇪🇨',
    ENG: '🏴',
    ESP: '🇪🇸',
    FRA: '🇫🇷',
    GER: '🇩🇪',
    GHA: '🇬🇭',
    HAI: '🇭🇹',
    ITA: '🇮🇹',
    JPN: '🇯🇵',
    KOR: '🇰🇷',
    MAR: '🇲🇦',
    MEX: '🇲🇽',
    NED: '🇳🇱',
    NZL: '🇳🇿',
    PAR: '🇵🇾',
    POL: '🇵🇱',
    POR: '🇵🇹',
    QAT: '🇶🇦',
    KSA: '🇸🇦',
    RSA: '🇿🇦',
    SCO: '🏴',
    SEN: '🇸🇳',
    SRB: '🇷🇸',
    SUI: '🇨🇭',
    TUR: '🇹🇷',
    URU: '🇺🇾',
    USA: '🇺🇸'
  };

  return map[code] || '⚽';
};

function isOwned(sticker) {
  const status = normalize(sticker.status).toLowerCase();
  return status.includes('tenho') || status.includes('✅');
}

function statusLabel(sticker) {
  return isOwned(sticker) ? STATUS_OWNED : STATUS_MISSING;
}

function repeatedCount(sticker) {
  const raw = String(sticker?.repetidas ?? '0').replace(',', '.');
  const number = Number(raw);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function saveTradeFavorites() {
  localStorage.setItem('tradeFavorites', JSON.stringify([...state.tradeFavorites]));
}

function showToast(message) {
  const toast = $('toast');

  if (!toast) return;

  toast.textContent = message;
  toast.classList.remove('hidden');

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 2400);
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json'
    },
    ...options
  });

  const text = await res.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }

  if (!res.ok) {
    throw new Error(data?.error || `Erro ${res.status}`);
  }

  return data;
}

function updateLastUpdated() {
  const el = $('lastUpdatedText');

  if (!el) return;

  const time = new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  el.textContent = `Atualizado ${time}`;
}

function updatePendingCount() {
  const pendingText = '0 pendentes';

  if ($('pendingCount')) $('pendingCount').textContent = pendingText;
}

function updateTradeCount() {
  const count = state.tradeFavorites.size;

  if ($('tradeCount')) $('tradeCount').textContent = count;
  if ($('tradeScreenCount')) {
    $('tradeScreenCount').textContent = `${count} ${count === 1 ? 'na troca' : 'na troca'}`;
  }
}

function startAutoSync() {
  stopAutoSync();

  if (!state.autoSync) return;

  state.autoSyncTimer = setInterval(() => {
    if (!state.loading) {
      loadData({ silent: true });
    }
  }, 5 * 60 * 1000);
}

function stopAutoSync() {
  if (state.autoSyncTimer) {
    clearInterval(state.autoSyncTimer);
    state.autoSyncTimer = null;
  }
}

async function loadData(options = {}) {
  try {
    state.loading = true;

    const resultCount = $('resultCount');

    if (resultCount && !options.silent) {
      resultCount.textContent = 'Carregando...';
    }

    const data = await apiFetch('/api/getData');

    state.stickers = data.stickers || [];

    localStorage.setItem('stickersCache', JSON.stringify(state.stickers));

    populateFilters();
    applyFilters();
    updateLastUpdated();
    updatePendingCount();

    if (!options.silent) {
      showToast('Dados atualizados');
    }
  } catch (err) {
    console.error(err);

    const cached = localStorage.getItem('stickersCache');

    if (cached) {
      state.stickers = JSON.parse(cached);
      populateFilters();
      applyFilters();

      if (!options.silent) {
        showToast('Usando dados salvos offline');
      }
    } else {
      const resultCount = $('resultCount');

      if (resultCount) {
        resultCount.textContent = 'Erro ao carregar dados';
      }

      showToast(err.message);
    }
  } finally {
    state.loading = false;
  }
}

function populateFilters() {
  populateGroupFilter();
  populateSearchSuggestions();
}

function populateGroupFilter() {
  const select = $('groupFilter');

  if (!select) return;

  const current = state.groupFilter;

  const groups = [...new Set(
    state.stickers
      .map((sticker) => normalize(sticker.grupo))
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  select.innerHTML = `<option value="all">Todos os grupos</option>`;

  for (const group of groups) {
    const option = document.createElement('option');
    option.value = group;
    option.textContent = group;
    select.appendChild(option);
  }

  if (current !== 'all' && groups.includes(current)) {
    select.value = current;
  } else {
    select.value = 'all';
    state.groupFilter = 'all';
  }
}

function populateSearchSuggestions() {
  const list = $('searchSuggestions');

  if (!list) return;

  const suggestions = new Set();

  for (const sticker of state.stickers) {
    const code = normalizeCode(sticker.codigo);
    const pais = normalize(sticker.pais);
    const sigla = normalize(sticker.sigla);
    const grupo = normalize(sticker.grupo);

    if (code) suggestions.add(code);
    if (pais) suggestions.add(pais);
    if (sigla) suggestions.add(sigla);
    if (grupo) suggestions.add(grupo);
  }

  list.innerHTML = '';

  [...suggestions].slice(0, 700).forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    list.appendChild(option);
  });
}

function setStatusFilter(value) {
  state.statusFilter = value;

  if ($('statusFilter')) {
    $('statusFilter').value = value;
  }

  document.querySelectorAll('.pill[data-filter]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.filter === value);
  });
}

function resetHomeFilters() {
  state.query = '';
  state.groupFilter = 'all';
  state.statusFilter = 'all';
  state.sortFilter = 'album';
  state.countryFilter = 'all';
  state.selectedCountryKey = '';

  if ($('searchInput')) $('searchInput').value = '';
  if ($('groupFilter')) $('groupFilter').value = 'all';
  if ($('statusFilter')) $('statusFilter').value = 'all';
  if ($('sortFilter')) $('sortFilter').value = 'album';

  setStatusFilter('all');

  document.querySelectorAll('[data-country-filter]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.countryFilter === 'all');
  });

  applyFilters();
}

function stickerMatchesSearch(sticker, query) {
  if (!query) return true;

  const haystack = [
    sticker.grupo,
    sticker.pais,
    sticker.sigla,
    sticker.numero,
    sticker.codigo,
    sticker.status,
    sticker.repetidas,
    sticker.observacoes
  ]
    .map(normalize)
    .join(' ')
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

function stickerMatchesStatus(sticker, status) {
  if (status === 'missing') return !isOwned(sticker);
  if (status === 'owned') return isOwned(sticker);
  if (status === 'repeated') return repeatedCount(sticker) > 0;
  if (status === 'trade') return state.tradeFavorites.has(normalizeCode(sticker.codigo));
  return true;
}

function getBaseFilteredStickers() {
  const query = normalize(state.query);

  return state.stickers.filter((sticker) => {
    const groupOk =
      state.groupFilter === 'all' ||
      normalize(sticker.grupo) === state.groupFilter;

    return (
      groupOk &&
      stickerMatchesSearch(sticker, query) &&
      stickerMatchesStatus(sticker, state.statusFilter)
    );
  });
}

function getStickerResults() {
  let result = getBaseFilteredStickers();

  if (state.selectedCountryKey) {
    result = result.filter((sticker) => {
      return getStickerCountryKey(sticker) === state.selectedCountryKey;
    });
  }

  return result;
}

function applyFilters() {
  state.filtered = getStickerResults();
  renderAll();
}

function getCountrySummaries(sourceStickers = getBaseFilteredStickers()) {
  const map = new Map();

  sourceStickers.forEach((sticker, index) => {
    const pais = normalize(sticker.pais) || 'Sem seção';
    const sigla = normalize(sticker.sigla) || '';
    const grupo = normalize(sticker.grupo) || 'Sem grupo';
    const key = makeCountryKey(pais, sigla, grupo);

    if (!map.has(key)) {
      map.set(key, {
        key,
        pais,
        sigla,
        grupo,
        total: 0,
        owned: 0,
        missing: 0,
        repeated: 0,
        firstIndex: index
      });
    }

    const item = map.get(key);

    item.total += 1;

    if (isOwned(sticker)) {
      item.owned += 1;
    }

    item.repeated += repeatedCount(sticker);
  });

  const items = [...map.values()].map((item) => ({
    ...item,
    missing: Math.max(item.total - item.owned, 0),
    percent: item.total ? Math.round((item.owned / item.total) * 100) : 0
  }));

  if (state.countryFilter === 'missing') {
    return items.filter((item) => item.missing > 0);
  }

  return sortCountrySummaries(items);
}

function sortCountrySummaries(items) {
  const sorted = [...items];

  if (state.sortFilter === 'country') {
    sorted.sort((a, b) => a.pais.localeCompare(b.pais, 'pt-BR'));
  } else if (state.sortFilter === 'percent') {
    sorted.sort((a, b) => {
      if (b.percent !== a.percent) return b.percent - a.percent;
      return a.pais.localeCompare(b.pais, 'pt-BR');
    });
  } else if (state.sortFilter === 'missing') {
    sorted.sort((a, b) => {
      if (b.missing !== a.missing) return b.missing - a.missing;
      return a.pais.localeCompare(b.pais, 'pt-BR');
    });
  } else {
    sorted.sort((a, b) => a.firstIndex - b.firstIndex);
  }

  return sorted;
}

function renderAll() {
  renderHeaderInfo();
  renderSummary();
  renderHomeCountries();
  renderCountries();
  renderStickers();
  renderTradePanel();
  renderSummaryDetails();
}

function renderHeaderInfo() {
  updatePendingCount();
  updateTradeCount();
}

function renderSummary() {
  const allTotal = state.stickers.length;
  const allOwned = state.stickers.filter(isOwned).length;
  const allMissing = Math.max(allTotal - allOwned, 0);
  const allRepeated = state.stickers.reduce((sum, sticker) => {
    return sum + repeatedCount(sticker);
  }, 0);
  const allPercent = allTotal ? Math.round((allOwned / allTotal) * 100) : 0;

  const sectionStickers = state.selectedCountryKey
    ? state.stickers.filter((sticker) => getStickerCountryKey(sticker) === state.selectedCountryKey)
    : getBaseFilteredStickers();

  const summaryBase = state.summaryTab === 'section' ? sectionStickers : state.stickers;

  const total = summaryBase.length;
  const owned = summaryBase.filter(isOwned).length;
  const missing = Math.max(total - owned, 0);
  const repeated = summaryBase.reduce((sum, sticker) => sum + repeatedCount(sticker), 0);
  const percent = total ? Math.round((owned / total) * 100) : 0;

  if ($('statTotal')) $('statTotal').textContent = total;
  if ($('statOwned')) $('statOwned').textContent = owned;
  if ($('statMissing')) $('statMissing').textContent = missing;
  if ($('statRepeated')) $('statRepeated').textContent = repeated;

  if ($('progressPercent')) $('progressPercent').textContent = `${percent}%`;
  if ($('progressText')) $('progressText').textContent = `${owned} de ${total} figurinhas`;
  if ($('progressBar')) $('progressBar').style.width = `${percent}%`;

  if ($('summaryPercentBadge')) {
    $('summaryPercentBadge').textContent =
      state.summaryTab === 'section'
        ? `${percent}% da seção`
        : `${allPercent}% completo`;
  }

  const filtered = getBaseFilteredStickers();
  const filteredOwned = filtered.filter(isOwned).length;
  const filteredPercent = filtered.length
    ? Math.round((filteredOwned / filtered.length) * 100)
    : 0;

  if ($('currentFilterPercent')) $('currentFilterPercent').textContent = `${filteredPercent}%`;

  const countrySummaries = getCountrySummaries(state.stickers);

  const completed = countrySummaries.filter((item) => item.percent === 100).length;
  const inProgress = countrySummaries.filter((item) => item.percent > 0 && item.percent < 100).length;
  const notStarted = countrySummaries.filter((item) => item.percent === 0).length;

  if ($('completedSectionsCount')) $('completedSectionsCount').textContent = completed;
  if ($('inProgressSectionsCount')) $('inProgressSectionsCount').textContent = inProgress;
  if ($('notStartedSectionsCount')) $('notStartedSectionsCount').textContent = notStarted;
}

function renderHomeCountries() {
  const grid = $('homeCountriesGrid');

  if (!grid) return;

  const items = getCountrySummaries();

  if ($('homeResultText')) {
    $('homeResultText').textContent = `${items.length} seção(ões) encontradas`;
  }

  renderCountryCards(grid, items);
}

function renderCountries() {
  const grid = $('groupProgress');

  if (!grid) return;

  const items = getCountrySummaries();

  if ($('countriesCount')) {
    $('countriesCount').textContent = `${items.length} seção(ões)`;
  }

  renderCountryCards(grid, items);
}

function renderCountryCards(grid, items) {
  grid.innerHTML = '';

  if (!items.length) {
    grid.innerHTML = `
      <div class="empty-state">
        Nenhuma seção encontrada com os filtros atuais.
      </div>
    `;

    return;
  }

  const frag = document.createDocumentFragment();

  for (const item of items) {
    const card = document.createElement('article');
    card.className = `country-card ${item.key === state.selectedCountryKey ? 'selected' : ''}`;
    card.dataset.countryKey = item.key;

    let ringClass = 'high';

    if (item.percent < 40) {
      ringClass = 'low';
    } else if (item.percent < 70) {
      ringClass = 'mid';
    }

    card.innerHTML = `
      <div class="country-card-head">
        <div class="country-card-title">
          <span class="country-flag">${countryFlag(item.sigla)}</span>

          <div>
            <h3>${escapeHtml(item.pais)}</h3>
            <p>${escapeHtml(item.grupo)}${item.sigla ? ` • ${escapeHtml(item.sigla)}` : ''}</p>
          </div>
        </div>

        <span class="country-percent-pill">${item.percent}% completo</span>
      </div>

      <div class="country-card-body">
        <div class="country-ring ${ringClass}" style="--progress:${item.percent}">
          <span>${item.percent}%</span>
        </div>

        <div class="country-stats">
          <strong>${item.owned}<small> / ${item.total}</small></strong>
          <span>${item.missing} faltam</span>
          <span>${item.repeated} repetidas</span>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      state.selectedCountryKey = item.key;
      navigateTo('stickers');
      applyFilters();
    });

    frag.appendChild(card);
  }

  grid.appendChild(frag);
}

function getSelectedCountryName() {
  if (!state.selectedCountryKey) return '';

  const sticker = state.stickers.find((item) => {
    return getStickerCountryKey(item) === state.selectedCountryKey;
  });

  return sticker ? normalize(sticker.pais) : '';
}

function renderStickers() {
  const grid = $('stickersGrid');
  const resultCount = $('resultCount');

  if (!grid) return;

  const stickers = getStickerResults();
  state.filtered = stickers;

  const selectedCountry = getSelectedCountryName();

  if ($('stickersTitle')) {
    $('stickersTitle').textContent = selectedCountry
      ? `Figurinhas — ${selectedCountry}`
      : 'Figurinhas';
  }

  if ($('stickersSubtitle')) {
    if (selectedCountry) {
      $('stickersSubtitle').textContent = 'Figurinhas da seção selecionada.';
    } else if (state.query || state.groupFilter !== 'all' || state.statusFilter !== 'all') {
      $('stickersSubtitle').textContent = 'Resultado da busca atual.';
    } else {
      $('stickersSubtitle').textContent = 'Todas as figurinhas do álbum.';
    }
  }

  if (resultCount) {
    resultCount.textContent = `${stickers.length} resultado(s)`;
  }

  grid.innerHTML = '';

  if (!stickers.length) {
    grid.innerHTML = `
      <div class="empty-state">
        Nenhuma figurinha encontrada com os filtros atuais.
      </div>
    `;

    return;
  }

  const frag = document.createDocumentFragment();

  for (const sticker of stickers) {
    const code = normalizeCode(sticker.codigo);
    const owned = isOwned(sticker);
    const repeats = repeatedCount(sticker);
    const favorited = state.tradeFavorites.has(code);

    const card = document.createElement('article');
    card.className = 'sticker-card';

    card.innerHTML = `
      <div class="sticker-top">
        <span class="code">${escapeHtml(code || '-')}</span>
        <span class="flag">${countryFlag(sticker.sigla)}</span>
      </div>

      <h3>${escapeHtml(sticker.pais) || 'Sem país/seção'}</h3>

      <p class="meta">
        ${escapeHtml(sticker.grupo)} • Nº ${escapeHtml(sticker.numero) || '-'}
      </p>

      <div class="badges">
        <span class="badge ${owned ? 'owned' : 'missing'}">
          ${owned ? STATUS_OWNED : STATUS_MISSING}
        </span>

        ${repeats > 0 ? `<span class="badge repeat">${repeats} repetida(s)</span>` : ''}

        ${favorited ? `<span class="badge repeat">⭐ Troca</span>` : ''}
      </div>

      <div class="card-actions">
        <button class="own-btn" data-action="toggle-owned" data-code="${escapeHtml(code)}" type="button">
          ${owned ? 'Marcar como Falta' : 'Marcar como Tenho'}
        </button>

        <button class="trade-fav-btn" data-action="trade" data-code="${escapeHtml(code)}" type="button" title="Favoritar para troca">
          ${favorited ? '★' : '☆'}
        </button>

        <div class="repeat-control">
          <button data-action="repeat-minus" data-code="${escapeHtml(code)}" type="button">−</button>
          <span>${repeats}</span>
          <button data-action="repeat-plus" data-code="${escapeHtml(code)}" type="button">+</button>
        </div>
      </div>
    `;

    frag.appendChild(card);
  }

  grid.appendChild(frag);
}

function renderTradePanel() {
  const list = $('tradeList');

  if (!list) return;

  const favorites = [...state.tradeFavorites]
    .map((code) => state.stickers.find((sticker) => normalizeCode(sticker.codigo) === code))
    .filter(Boolean);

  updateTradeCount();

  list.innerHTML = '';

  if (!favorites.length) {
    list.innerHTML = `
      <div class="empty-state">
        Nenhuma figurinha favoritada para troca.<br>
        Pesquise figurinhas e toque em Favoritar.
      </div>
    `;

    return;
  }

  const frag = document.createDocumentFragment();

  for (const sticker of favorites) {
    const code = normalizeCode(sticker.codigo);

    const item = document.createElement('div');
    item.className = 'trade-item';

    item.innerHTML = `
      <strong>${countryFlag(sticker.sigla)} ${escapeHtml(code)} • ${escapeHtml(sticker.pais)}</strong>

      <button class="danger-btn" data-action="trade-remove" data-code="${escapeHtml(code)}" type="button">
        Remover
      </button>
    `;

    frag.appendChild(item);
  }

  list.appendChild(frag);
}

function renderSummaryDetails() {
  renderTopRepeated();
  renderMostMissing();
  renderMostOwned();
  renderCompletedSections();
  renderSummaryGroupProgress();
}

function renderTopRepeated() {
  const list = $('topRepeatedList');

  if (!list) return;

  const items = state.stickers
    .filter((sticker) => repeatedCount(sticker) > 0)
    .sort((a, b) => repeatedCount(b) - repeatedCount(a))
    .slice(0, 12);

  renderRankingList(list, items, (sticker) => {
    return {
      left: `${countryFlag(sticker.sigla)} ${normalizeCode(sticker.codigo)} • ${normalize(sticker.pais)}`,
      right: `+${repeatedCount(sticker)}`
    };
  }, 'Nenhuma repetida ainda.');
}

function renderMostMissing() {
  const list = $('mostMissingList');

  if (!list) return;

  const items = getCountrySummaries(state.stickers)
    .filter((item) => item.missing > 0)
    .sort((a, b) => b.missing - a.missing)
    .slice(0, 12);

  renderRankingList(list, items, (item) => {
    return {
      left: `${countryFlag(item.sigla)} ${item.pais}`,
      right: `${item.missing} faltam`
    };
  }, 'Nenhuma seção com faltantes.');
}

function renderMostOwned() {
  const list = $('mostOwnedList');

  if (!list) return;

  const items = getCountrySummaries(state.stickers)
    .filter((item) => item.owned > 0)
    .sort((a, b) => b.owned - a.owned)
    .slice(0, 12);

  renderRankingList(list, items, (item) => {
    return {
      left: `${countryFlag(item.sigla)} ${item.pais}`,
      right: `${item.owned}/${item.total}`
    };
  }, 'Nenhuma figurinha marcada como Tenho.');
}

function renderCompletedSections() {
  const list = $('completedSectionsList');

  if (!list) return;

  const items = getCountrySummaries(state.stickers)
    .filter((item) => item.percent === 100)
    .sort((a, b) => a.pais.localeCompare(b.pais, 'pt-BR'));

  renderRankingList(list, items, (item) => {
    return {
      left: `${countryFlag(item.sigla)} ${item.pais}`,
      right: '100%'
    };
  }, 'Nenhuma seção completa ainda.');
}

function renderRankingList(list, items, mapper, emptyText) {
  list.innerHTML = '';

  if (!items.length) {
    list.innerHTML = `<div class="empty-state">${emptyText}</div>`;
    return;
  }

  const frag = document.createDocumentFragment();

  for (const item of items) {
    const data = mapper(item);

    const row = document.createElement('div');
    row.className = 'ranking-item';

    row.innerHTML = `
      <strong>${escapeHtml(data.left)}</strong>
      <span>${escapeHtml(data.right)}</span>
    `;

    frag.appendChild(row);
  }

  list.appendChild(frag);
}

function renderSummaryGroupProgress() {
  const wrap = $('summaryGroupProgress');

  if (!wrap) return;

  const map = new Map();

  for (const sticker of state.stickers) {
    const group = normalize(sticker.grupo) || 'Sem grupo';

    if (!map.has(group)) {
      map.set(group, { group, total: 0, owned: 0 });
    }

    const item = map.get(group);

    item.total += 1;

    if (isOwned(sticker)) {
      item.owned += 1;
    }
  }

  const items = [...map.values()]
    .map((item) => ({
      ...item,
      percent: item.total ? Math.round((item.owned / item.total) * 100) : 0
    }))
    .sort((a, b) => a.group.localeCompare(b.group, 'pt-BR'));

  wrap.innerHTML = '';

  if (!items.length) {
    wrap.innerHTML = `<div class="empty-state">Nenhum grupo encontrado.</div>`;
    return;
  }

  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'group-bar-row';

    row.innerHTML = `
      <strong>${escapeHtml(item.group)}</strong>

      <div class="group-bar-track">
        <div class="group-bar-fill" style="width:${item.percent}%"></div>
      </div>

      <span>${item.percent}%</span>
    `;

    wrap.appendChild(row);
  }
}

function findSticker(code) {
  const normalized = normalizeCode(code);

  return state.stickers.find((sticker) => {
    return normalizeCode(sticker.codigo) === normalized;
  });
}

async function updateStickerLocalAndRemote(code, changes) {
  const sticker = findSticker(code);

  if (!sticker) {
    showToast(`Código ${code} não encontrado`);
    return;
  }

  const old = { ...sticker };

  Object.assign(sticker, changes);

  renderAll();

  try {
    await apiFetch('/api/updateSticker', {
      method: 'POST',
      body: JSON.stringify({
        codigo: normalizeCode(code),
        ...changes
      })
    });

    localStorage.setItem('stickersCache', JSON.stringify(state.stickers));

    showToast('Planilha atualizada');
  } catch (err) {
    Object.assign(sticker, old);
    renderAll();
    showToast(err.message);
  }
}

async function confirmTrade() {
  const codes = [...state.tradeFavorites];

  if (!codes.length) {
    showToast('Nenhuma figurinha na troca');
    return;
  }

  try {
    await apiFetch('/api/updateMany', {
      method: 'POST',
      body: JSON.stringify({
        codigos: codes,
        status: STATUS_OWNED
      })
    });

    for (const code of codes) {
      const sticker = findSticker(code);

      if (sticker) {
        sticker.status = STATUS_OWNED;
      }
    }

    state.tradeFavorites.clear();

    saveTradeFavorites();

    renderAll();

    showToast('Troca efetivada');
  } catch (err) {
    showToast(err.message);
  }
}

function handleActionClick(event) {
  const btn = event.target.closest('button[data-action]');

  if (!btn) return;

  const action = btn.dataset.action;
  const code = btn.dataset.code;
  const sticker = findSticker(code);

  if (!sticker && action !== 'trade-remove') return;

  if (action === 'toggle-owned') {
    updateStickerLocalAndRemote(code, {
      status: isOwned(sticker) ? STATUS_MISSING : STATUS_OWNED
    });
  }

  if (action === 'repeat-plus') {
    updateStickerLocalAndRemote(code, {
      repetidas: repeatedCount(sticker) + 1
    });
  }

  if (action === 'repeat-minus') {
    updateStickerLocalAndRemote(code, {
      repetidas: Math.max(repeatedCount(sticker) - 1, 0)
    });
  }

  if (action === 'trade') {
    const normalized = normalizeCode(code);

    if (state.tradeFavorites.has(normalized)) {
      state.tradeFavorites.delete(normalized);
    } else {
      state.tradeFavorites.add(normalized);
    }

    saveTradeFavorites();

    renderAll();
  }

  if (action === 'trade-remove') {
    state.tradeFavorites.delete(normalizeCode(code));
    saveTradeFavorites();
    renderAll();
  }
}

function navigateTo(view) {
  state.view = view;

  document.querySelectorAll('.app-view').forEach((el) => {
    const isActive = el.dataset.view === view;
    el.classList.toggle('active', isActive);
    el.classList.toggle('hidden', !isActive);
  });

  document.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.nav === view);
  });

  if (view === 'home') {
    resetHomeFilters();
  }

  if (view === 'countries') {
    state.selectedCountryKey = '';
    applyFilters();
  }

  if (view === 'stickers') {
    renderStickers();
  }

  if (view === 'trade') {
    renderTradePanel();
  }

  if (view === 'summary') {
    renderSummary();
    renderSummaryDetails();
  }

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

function exportCsv() {
  if (!state.stickers.length) {
    showToast('Nenhum dado para exportar');
    return;
  }

  const headers = [
    'Grupo',
    'País/Seção',
    'Sigla',
    'Número',
    'Código',
    'Status',
    'Repetidas',
    'Observações'
  ];

  const rows = state.stickers.map((sticker) => [
    sticker.grupo,
    sticker.pais,
    sticker.sigla,
    sticker.numero,
    sticker.codigo,
    sticker.status,
    sticker.repetidas,
    sticker.observacoes
  ]);

  const csv = [headers, ...rows]
    .map((row) => {
      return row
        .map((cell) => {
          const value = normalize(cell).replaceAll('"', '""');
          return `"${value}"`;
        })
        .join(',');
    })
    .join('\n');

  const blob = new Blob([`\uFEFF${csv}`], {
    type: 'text/csv;charset=utf-8;'
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = 'figurinhas-pietro.csv';
  a.click();

  URL.revokeObjectURL(url);

  showToast('CSV gerado');
}

function clearLocalData() {
  localStorage.removeItem('stickersCache');
  localStorage.removeItem('tradeFavorites');

  state.tradeFavorites.clear();

  renderAll();

  showToast('Dados locais limpos');
}

function renderScannerResult(code, targetId = 'scannerResult') {
  const result = $(targetId);

  if (!result) return;

  const normalizedCode = normalizeCode(code);
  const sticker = findSticker(normalizedCode);

  if (!sticker) {
    result.innerHTML = `
      <strong>${escapeHtml(normalizedCode)}</strong><br>
      Código não encontrado na planilha.
    `;

    return;
  }

  const favorited = state.tradeFavorites.has(normalizedCode);

  result.innerHTML = `
    <strong>${escapeHtml(normalizedCode)} — ${escapeHtml(sticker.pais)}</strong><br>
    Status: ${statusLabel(sticker)} ${favorited ? '• ⭐ Favoritada' : ''}

    <div class="scanner-result-actions">
      <button class="primary-btn" data-scan-own="${escapeHtml(normalizedCode)}" type="button">
        Marcar como Tenho
      </button>

      <button class="secondary-btn" data-scan-fav="${escapeHtml(normalizedCode)}" type="button">
        ${favorited ? 'Remover da troca' : 'Favoritar troca'}
      </button>
    </div>
  `;

  const ownBtn = result.querySelector('[data-scan-own]');
  const favBtn = result.querySelector('[data-scan-fav]');

  if (ownBtn) {
    ownBtn.addEventListener('click', () => {
      updateStickerLocalAndRemote(normalizedCode, {
        status: STATUS_OWNED
      });
    });
  }

  if (favBtn) {
    favBtn.addEventListener('click', () => {
      if (state.tradeFavorites.has(normalizedCode)) {
        state.tradeFavorites.delete(normalizedCode);
      } else {
        state.tradeFavorites.add(normalizedCode);
      }

      saveTradeFavorites();
      renderAll();
      renderScannerResult(normalizedCode, targetId);
    });
  }
}

function setupEvents() {
  const refreshBtn = $('refreshBtn');
  const groupFilter = $('groupFilter');
  const statusFilter = $('statusFilter');
  const sortFilter = $('sortFilter');
  const searchInput = $('searchInput');
  const confirmTradeBtn = $('confirmTradeBtn');
  const clearTradeBtn = $('clearTradeBtn');
  const syncSummaryBtn = $('syncSummaryBtn');
  const exportCsvBtn = $('exportCsvBtn');
  const clearLocalBtn = $('clearLocalBtn');
  const autoSyncToggle = $('autoSyncToggle');
  const openCameraBtn = $('openCameraBtn');
  const readCodeShortcutBtn = $('readCodeShortcutBtn');
  const manualCodeInputPage = $('manualCodeInputPage');
  const manualCodeBtnPage = $('manualCodeBtnPage');

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => loadData());
  }

  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      state.query = event.target.value;
      state.selectedCountryKey = '';
      applyFilters();
    });
  }

  if (groupFilter) {
    groupFilter.addEventListener('change', (event) => {
      state.groupFilter = event.target.value;
      state.selectedCountryKey = '';
      applyFilters();
    });
  }

  if (statusFilter) {
    statusFilter.addEventListener('change', (event) => {
      setStatusFilter(event.target.value);
      state.selectedCountryKey = '';
      applyFilters();
    });
  }

  if (sortFilter) {
    sortFilter.addEventListener('change', (event) => {
      state.sortFilter = event.target.value;
      applyFilters();
    });
  }

  document.querySelectorAll('.pill[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setStatusFilter(btn.dataset.filter);
      state.selectedCountryKey = '';
      applyFilters();
    });
  });

  document.querySelectorAll('[data-country-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.countryFilter = btn.dataset.countryFilter;

      document.querySelectorAll('[data-country-filter]').forEach((item) => {
        item.classList.toggle('active', item.dataset.countryFilter === state.countryFilter);
      });

      applyFilters();
    });
  });

  document.querySelectorAll('[data-summary-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.summaryTab = btn.dataset.summaryTab;

      document.querySelectorAll('[data-summary-tab]').forEach((item) => {
        item.classList.toggle('active', item.dataset.summaryTab === state.summaryTab);
      });

      renderSummary();
    });
  });

  document.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      navigateTo(btn.dataset.nav);
    });
  });

  document.querySelectorAll('[data-filter-shortcut]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setStatusFilter(btn.dataset.filterShortcut);
      state.selectedCountryKey = '';
      navigateTo('stickers');
      applyFilters();
    });
  });

  document.addEventListener('click', handleActionClick);

  if (confirmTradeBtn) {
    confirmTradeBtn.addEventListener('click', confirmTrade);
  }

  if (clearTradeBtn) {
    clearTradeBtn.addEventListener('click', () => {
      state.tradeFavorites.clear();
      saveTradeFavorites();
      renderAll();
      showToast('Troca limpa');
    });
  }

  if (syncSummaryBtn) {
    syncSummaryBtn.addEventListener('click', () => loadData());
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', exportCsv);
  }

  if (clearLocalBtn) {
    clearLocalBtn.addEventListener('click', clearLocalData);
  }

  if (autoSyncToggle) {
    autoSyncToggle.addEventListener('change', (event) => {
      state.autoSync = event.target.checked;

      if (state.autoSync) {
        startAutoSync();
        showToast('Auto-atualizar ligado');
      } else {
        stopAutoSync();
        showToast('Auto-atualizar desligado');
      }
    });
  }

  if (openCameraBtn) {
    openCameraBtn.addEventListener('click', () => {
      $('scannerBtn')?.click();
    });
  }

  if (readCodeShortcutBtn) {
    readCodeShortcutBtn.addEventListener('click', () => {
      const modal = $('scannerModal');

      if (modal?.classList.contains('hidden')) {
        $('scannerBtn')?.click();

        setTimeout(() => {
          $('scanNowBtn')?.click();
        }, 1200);
      } else {
        $('scanNowBtn')?.click();
      }
    });
  }

  if (manualCodeBtnPage) {
    manualCodeBtnPage.addEventListener('click', () => {
      const code = normalizeCode(manualCodeInputPage?.value);

      if (!code) {
        showToast('Digite um código');
        return;
      }

      renderScannerResult(code, 'scannerResultPage');
    });
  }

  if (manualCodeInputPage) {
    manualCodeInputPage.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        manualCodeBtnPage?.click();
      }
    });
  }

  window.addEventListener('scanner:code', (event) => {
    const code = normalizeCode(event.detail?.code);

    if (!code) return;

    renderScannerResult(code, 'scannerResult');
    renderScannerResult(code, 'scannerResultPage');
  });

  window.addEventListener('online', () => {
    showToast('Online');
    loadData({ silent: true });
  });

  window.addEventListener('offline', () => {
    showToast('Offline');
  });
}

setupEvents();
updateLastUpdated();
updatePendingCount();
updateTradeCount();
startAutoSync();
loadData();
