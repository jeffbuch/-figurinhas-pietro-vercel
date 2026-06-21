const STATUS_OWNED = '✅ Tenho';
const STATUS_MISSING = '❌ Falta';

const state = {
  stickers: [],
  filtered: [],
  filter: 'all',
  query: '',
  tradeMode: false,
  tradeFavorites: new Set(JSON.parse(localStorage.getItem('tradeFavorites') || '[]')),
  loading: false
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
    PAR: '🇵🇾',
    POL: '🇵🇱',
    POR: '🇵🇹',
    QAT: '🇶🇦',
    RSA: '🇿🇦',
    SCO: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
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

async function loadData() {
  try {
    state.loading = true;

    const resultCount = $('resultCount');
    if (resultCount) resultCount.textContent = 'Carregando...';

    const data = await apiFetch('/api/getData');

    state.stickers = data.stickers || [];

    localStorage.setItem('stickersCache', JSON.stringify(state.stickers));

    applyFilters();

    showToast('Dados atualizados');
  } catch (err) {
    console.error(err);

    const cached = localStorage.getItem('stickersCache');

    if (cached) {
      state.stickers = JSON.parse(cached);
      applyFilters();
      showToast('Usando dados salvos offline');
    } else {
      const resultCount = $('resultCount');
      if (resultCount) resultCount.textContent = 'Erro ao carregar dados';
      showToast(err.message);
    }
  } finally {
    state.loading = false;
  }
}

function applyFilters() {
  const query = normalize(state.query).toLowerCase();

  state.filtered = state.stickers.filter((sticker) => {
    const haystack = [
      sticker.grupo,
      sticker.pais,
      sticker.sigla,
      sticker.numero,
      sticker.codigo,
      sticker.status,
      sticker.observacoes
    ]
      .map(normalize)
      .join(' ')
      .toLowerCase();

    const matchesQuery = !query || haystack.includes(query);

    let matchesFilter = true;

    if (state.filter === 'missing') {
      matchesFilter = !isOwned(sticker);
    }

    if (state.filter === 'owned') {
      matchesFilter = isOwned(sticker);
    }

    if (state.filter === 'repeated') {
      matchesFilter = repeatedCount(sticker) > 0;
    }

    if (state.filter === 'trade') {
      matchesFilter = state.tradeFavorites.has(normalizeCode(sticker.codigo));
    }

    return matchesQuery && matchesFilter;
  });

  renderAll();
}

function renderAll() {
  renderSummary();
  renderStickers();
  renderTradePanel();
  renderGroupProgress();
}

function renderSummary() {
  const total = state.stickers.length;
  const owned = state.stickers.filter(isOwned).length;
  const missing = Math.max(total - owned, 0);
  const repeated = state.stickers.reduce((sum, sticker) => {
    return sum + repeatedCount(sticker);
  }, 0);

  const percent = total ? Math.round((owned / total) * 100) : 0;

  if ($('statTotal')) $('statTotal').textContent = total;
  if ($('statOwned')) $('statOwned').textContent = owned;
  if ($('statMissing')) $('statMissing').textContent = missing;
  if ($('statRepeated')) $('statRepeated').textContent = repeated;

  if ($('progressPercent')) $('progressPercent').textContent = `${percent}%`;
  if ($('progressText')) $('progressText').textContent = `${owned} de ${total} figurinhas`;
  if ($('progressBar')) $('progressBar').style.width = `${percent}%`;
}

function renderStickers() {
  const grid = $('stickersGrid');
  const resultCount = $('resultCount');

  if (!grid) return;

  if (resultCount) {
    resultCount.textContent = `${state.filtered.length} resultado(s)`;
  }

  grid.innerHTML = '';

  if (!state.filtered.length) {
    grid.innerHTML = `
      <div class="panel">
        <h2>Nenhuma figurinha encontrada</h2>
        <p>Tente buscar por código, país ou grupo.</p>
      </div>
    `;

    return;
  }

  const frag = document.createDocumentFragment();

  for (const sticker of state.filtered) {
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
          <span>${repeats} repetida(s)</span>
          <button data-action="repeat-plus" data-code="${escapeHtml(code)}" type="button">+</button>
        </div>
      </div>
    `;

    frag.appendChild(card);
  }

  grid.appendChild(frag);
}

function renderTradePanel() {
  const panel = $('tradePanel');
  const list = $('tradeList');

  if (!panel || !list) return;

  panel.classList.toggle('hidden', !state.tradeMode);

  list.innerHTML = '';

  const favorites = [...state.tradeFavorites]
    .map((code) => state.stickers.find((sticker) => normalizeCode(sticker.codigo) === code))
    .filter(Boolean);

  if (!favorites.length) {
    list.innerHTML = `<p class="meta">Nenhuma figurinha favoritada para troca ainda.</p>`;
    return;
  }

  for (const sticker of favorites) {
    const code = normalizeCode(sticker.codigo);

    const item = document.createElement('div');
    item.className = 'mini-item';

    item.innerHTML = `
      <strong>${escapeHtml(code)} — ${escapeHtml(sticker.pais)}</strong>

      <button class="ghost-btn" data-action="trade-remove" data-code="${escapeHtml(code)}" type="button">
        Remover
      </button>
    `;

    list.appendChild(item);
  }
}

function renderGroupProgress() {
  const wrap = $('groupProgress');

  if (!wrap) return;

  wrap.innerHTML = '';
  wrap.className = 'country-progress-grid';

  const groups = new Map();

  for (const sticker of state.stickers) {
    const pais = normalize(sticker.pais) || 'Sem seção';
    const sigla = normalize(sticker.sigla) || '';
    const grupo = normalize(sticker.grupo) || 'Sem grupo';

    const key = `${pais}||${sigla}||${grupo}`;

    if (!groups.has(key)) {
      groups.set(key, {
        pais,
        sigla,
        grupo,
        total: 0,
        owned: 0,
        repeated: 0
      });
    }

    const item = groups.get(key);

    item.total += 1;

    if (isOwned(sticker)) {
      item.owned += 1;
    }

    item.repeated += repeatedCount(sticker);
  }

  const items = [...groups.values()].sort((a, b) => {
    const groupCompare = a.grupo.localeCompare(b.grupo, 'pt-BR');
    if (groupCompare !== 0) return groupCompare;

    return a.pais.localeCompare(b.pais, 'pt-BR');
  });

  for (const item of items) {
    const missing = Math.max(item.total - item.owned, 0);
    const percent = item.total ? Math.round((item.owned / item.total) * 100) : 0;

    let ringClass = 'high';

    if (percent < 40) {
      ringClass = 'low';
    } else if (percent < 70) {
      ringClass = 'mid';
    }

    const card = document.createElement('article');
    card.className = 'country-progress-card';

    card.innerHTML = `
      <div class="country-card-head">
        <div class="country-card-title">
          <span class="country-flag">${countryFlag(item.sigla)}</span>

          <div>
            <h3>${escapeHtml(item.pais)}</h3>
            <p>${escapeHtml(item.grupo)}${item.sigla ? ` • ${escapeHtml(item.sigla)}` : ''}</p>
          </div>
        </div>

        <span class="country-percent-pill">${percent}% completo</span>
      </div>

      <div class="country-card-body">
        <div class="country-ring ${ringClass}" style="--progress:${percent}">
          <span>${percent}%</span>
        </div>

        <div class="country-stats">
          <strong>${item.owned}<small> / ${item.total}</small></strong>
          <span>${missing} faltam</span>
          <span>${item.repeated} repetidas</span>
        </div>
      </div>
    `;

    wrap.appendChild(card);
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

function handleGridClick(event) {
  const btn = event.target.closest('button[data-action]');

  if (!btn) return;

  const action = btn.dataset.action;
  const code = btn.dataset.code;
  const sticker = findSticker(code);

  if (!sticker) return;

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

function setupEvents() {
  const refreshBtn = $('refreshBtn');
  const searchInput = $('searchInput');
  const tradeBtn = $('tradeBtn');
  const clearTradeBtn = $('clearTradeBtn');
  const confirmTradeBtn = $('confirmTradeBtn');
  const stickersGrid = $('stickersGrid');
  const tradeList = $('tradeList');

  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadData);
  }

  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      state.query = event.target.value;
      applyFilters();
    });
  }

  document.querySelectorAll('.pill[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pill[data-filter]').forEach((item) => {
        item.classList.remove('active');
      });

      btn.classList.add('active');

      state.filter = btn.dataset.filter;

      if (state.filter === 'trade') {
        state.tradeMode = true;
      }

      applyFilters();
    });
  });

  if (tradeBtn) {
    tradeBtn.addEventListener('click', () => {
      state.tradeMode = !state.tradeMode;
      renderTradePanel();
    });
  }

  if (clearTradeBtn) {
    clearTradeBtn.addEventListener('click', () => {
      state.tradeFavorites.clear();
      saveTradeFavorites();
      renderAll();
    });
  }

  if (confirmTradeBtn) {
    confirmTradeBtn.addEventListener('click', confirmTrade);
  }

  if (stickersGrid) {
    stickersGrid.addEventListener('click', handleGridClick);
  }

  if (tradeList) {
    tradeList.addEventListener('click', handleGridClick);
  }

  window.addEventListener('scanner:code', (event) => {
    const code = normalizeCode(event.detail.code);
    const sticker = findSticker(code);
    const result = $('scannerResult');

    if (!result) return;

    if (!sticker) {
      result.innerHTML = `
        <strong>${escapeHtml(code)}</strong><br>
        Código não encontrado na planilha.
      `;

      return;
    }

    const favorited = state.tradeFavorites.has(code);

    result.innerHTML = `
      <strong>${escapeHtml(code)} — ${escapeHtml(sticker.pais)}</strong><br>

      Status: ${statusLabel(sticker)} ${favorited ? '• ⭐ Favoritada' : ''}

      <div class="scanner-result-actions">
        <button class="primary-btn" data-scan-own="${escapeHtml(code)}" type="button">
          Marcar como Tenho
        </button>

        <button class="secondary-btn" data-scan-fav="${escapeHtml(code)}" type="button">
          ${favorited ? 'Remover da troca' : 'Favoritar troca'}
        </button>
      </div>
    `;

    const ownBtn = result.querySelector('[data-scan-own]');
    const favBtn = result.querySelector('[data-scan-fav]');

    if (ownBtn) {
      ownBtn.addEventListener('click', () => {
        updateStickerLocalAndRemote(code, {
          status: STATUS_OWNED
        });
      });
    }

    if (favBtn) {
      favBtn.addEventListener('click', () => {
        if (state.tradeFavorites.has(code)) {
          state.tradeFavorites.delete(code);
        } else {
          state.tradeFavorites.add(code);
        }

        saveTradeFavorites();
        renderAll();

        window.dispatchEvent(
          new CustomEvent('scanner:code', {
            detail: { code }
          })
        );
      });
    }
  });
}

setupEvents();
loadData();
