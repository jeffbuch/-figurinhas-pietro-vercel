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

const countryFlag = (sigla = '') => {
  const map = {
    ARG:'🇦🇷', BRA:'🇧🇷', USA:'🇺🇸', MEX:'🇲🇽', CAN:'🇨🇦', FRA:'🇫🇷', GER:'🇩🇪',
    ESP:'🇪🇸', POR:'🇵🇹', ENG:'🏴', ITA:'🇮🇹', URU:'🇺🇾', COL:'🇨🇴', CHI:'🇨🇱',
    JPN:'🇯🇵', KOR:'🇰🇷', AUS:'🇦🇺', MAR:'🇲🇦', SEN:'🇸🇳', GHA:'🇬🇭',
    FIFA:'🏆', CC:'🥤', COC:'🥤'
  };
  return map[String(sigla).toUpperCase()] || '⚽';
};

const normalize = (v) => String(v ?? '').trim();
const normalizeCode = (v) => normalize(v).toUpperCase().replace(/\s+/g, '');

function isOwned(sticker) {
  return normalize(sticker.status).toLowerCase() === 'tenho';
}

function repeatedCount(sticker) {
  const n = Number(sticker.repetidas || 0);
  return Number.isFinite(n) ? n : 0;
}

function saveTradeFavorites() {
  localStorage.setItem('tradeFavorites', JSON.stringify([...state.tradeFavorites]));
}

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add('hidden'), 2400);
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
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
    $('resultCount').textContent = 'Carregando...';
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
      $('resultCount').textContent = 'Erro ao carregar dados';
      showToast(err.message);
    }
  } finally {
    state.loading = false;
  }
}

function applyFilters() {
  const q = normalize(state.query).toLowerCase();

  state.filtered = state.stickers.filter((s) => {
    const haystack = [
      s.grupo,
      s.pais,
      s.sigla,
      s.numero,
      s.codigo,
      s.status,
      s.observacoes
    ].map(normalize).join(' ').toLowerCase();

    const matchesQuery = !q || haystack.includes(q);

    let matchesFilter = true;
    if (state.filter === 'missing') matchesFilter = !isOwned(s);
    if (state.filter === 'owned') matchesFilter = isOwned(s);
    if (state.filter === 'repeated') matchesFilter = repeatedCount(s) > 0;
    if (state.filter === 'trade') matchesFilter = state.tradeFavorites.has(normalizeCode(s.codigo));

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
  const repeated = state.stickers.reduce((sum, s) => sum + repeatedCount(s), 0);
  const percent = total ? Math.round((owned / total) * 100) : 0;

  $('statTotal').textContent = total;
  $('statOwned').textContent = owned;
  $('statMissing').textContent = missing;
  $('statRepeated').textContent = repeated;
  $('progressPercent').textContent = `${percent}%`;
  $('progressText').textContent = `${owned} de ${total} figurinhas`;
  $('progressBar').style.width = `${percent}%`;
}

function renderStickers() {
  const grid = $('stickersGrid');
  $('resultCount').textContent = `${state.filtered.length} resultado(s)`;
  grid.innerHTML = '';

  if (!state.filtered.length) {
    grid.innerHTML = `<div class="panel"><h2>Nenhuma figurinha encontrada</h2><p>Tente buscar por código, país ou grupo.</p></div>`;
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
        <span class="code">${code || '-'}</span>
        <span class="flag">${countryFlag(sticker.sigla)}</span>
      </div>
      <h3>${normalize(sticker.pais) || 'Sem país/seção'}</h3>
      <p class="meta">${normalize(sticker.grupo)} • Nº ${normalize(sticker.numero) || '-'}</p>

      <div class="badges">
        <span class="badge ${owned ? 'owned' : 'missing'}">${owned ? 'Tenho' : 'Falta'}</span>
        ${repeats > 0 ? `<span class="badge repeat">${repeats} repetida(s)</span>` : ''}
        ${favorited ? `<span class="badge repeat">⭐ Troca</span>` : ''}
      </div>

      <div class="card-actions">
        <button class="own-btn" data-action="toggle-owned" data-code="${code}">
          ${owned ? 'Marcar como Falta' : 'Marcar como Tenho'}
        </button>
        <button class="trade-fav-btn" data-action="trade" data-code="${code}" title="Favoritar para troca">
          ${favorited ? '★' : '☆'}
        </button>
        <div class="repeat-control">
          <button data-action="repeat-minus" data-code="${code}">−</button>
          <span>${repeats} repetida(s)</span>
          <button data-action="repeat-plus" data-code="${code}">+</button>
        </div>
      </div>
    `;

    frag.appendChild(card);
  }

  grid.appendChild(frag);
}

function renderTradePanel() {
  const panel = $('tradePanel');
  panel.classList.toggle('hidden', !state.tradeMode);

  const list = $('tradeList');
  list.innerHTML = '';

  const favorites = [...state.tradeFavorites]
    .map(code => state.stickers.find(s => normalizeCode(s.codigo) === code))
    .filter(Boolean);

  if (!favorites.length) {
    list.innerHTML = `<p class="meta">Nenhuma figurinha favoritada para troca ainda.</p>`;
    return;
  }

  for (const sticker of favorites) {
    const item = document.createElement('div');
    item.className = 'mini-item';
    item.innerHTML = `
      <strong>${normalizeCode(sticker.codigo)} — ${normalize(sticker.pais)}</strong>
      <button class="ghost-btn" data-action="trade-remove" data-code="${normalizeCode(sticker.codigo)}">Remover</button>
    `;
    list.appendChild(item);
  }
}

function renderGroupProgress() {
  const wrap = $('groupProgress');
  wrap.innerHTML = '';

  const groups = new Map();

  for (const s of state.stickers) {
    const key = normalize(s.grupo) || 'Sem grupo';
    if (!groups.has(key)) groups.set(key, { total: 0, owned: 0 });
    const g = groups.get(key);
    g.total++;
    if (isOwned(s)) g.owned++;
  }

  const sorted = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  for (const [group, data] of sorted) {
    const percent = data.total ? Math.round((data.owned / data.total) * 100) : 0;
    const row = document.createElement('div');
    row.className = 'group-row';
    row.innerHTML = `
      <strong>${group}</strong>
      <span>${percent}%</span>
      <div class="group-progress-track">
        <div class="group-progress-bar" style="width:${percent}%"></div>
      </div>
    `;
    wrap.appendChild(row);
  }
}

function findSticker(code) {
  const normalized = normalizeCode(code);
  return state.stickers.find(s => normalizeCode(s.codigo) === normalized);
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
      body: JSON.stringify({ codigo: normalizeCode(code), ...changes })
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
      body: JSON.stringify({ codigos: codes, status: 'Tenho' })
    });

    for (const code of codes) {
      const sticker = findSticker(code);
      if (sticker) sticker.status = 'Tenho';
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
    updateStickerLocalAndRemote(code, { status: isOwned(sticker) ? 'Falta' : 'Tenho' });
  }

  if (action === 'repeat-plus') {
    updateStickerLocalAndRemote(code, { repetidas: repeatedCount(sticker) + 1 });
  }

  if (action === 'repeat-minus') {
    updateStickerLocalAndRemote(code, { repetidas: Math.max(repeatedCount(sticker) - 1, 0) });
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
  $('refreshBtn').addEventListener('click', loadData);

  $('searchInput').addEventListener('input', (event) => {
    state.query = event.target.value;
    applyFilters();
  });

  document.querySelectorAll('.pill[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pill[data-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filter = btn.dataset.filter;
      if (state.filter === 'trade') state.tradeMode = true;
      applyFilters();
    });
  });

  $('tradeBtn').addEventListener('click', () => {
    state.tradeMode = !state.tradeMode;
    renderTradePanel();
  });

  $('clearTradeBtn').addEventListener('click', () => {
    state.tradeFavorites.clear();
    saveTradeFavorites();
    renderAll();
  });

  $('confirmTradeBtn').addEventListener('click', confirmTrade);
  $('stickersGrid').addEventListener('click', handleGridClick);
  $('tradeList').addEventListener('click', handleGridClick);

  window.addEventListener('scanner:code', (event) => {
    const code = normalizeCode(event.detail.code);
    const sticker = findSticker(code);
    const result = $('scannerResult');

    if (!sticker) {
      result.innerHTML = `<strong>${code}</strong><br>Código não encontrado na planilha.`;
      return;
    }

    const favorited = state.tradeFavorites.has(code);
    result.innerHTML = `
      <strong>${code} — ${normalize(sticker.pais)}</strong><br>
      Status: ${isOwned(sticker) ? 'Tenho' : 'Falta'} ${favorited ? '• ⭐ Favoritada' : ''}
      <div class="scanner-result-actions">
        <button class="primary-btn" data-scan-own="${code}">Marcar como Tenho</button>
        <button class="secondary-btn" data-scan-fav="${code}">${favorited ? 'Remover da troca' : 'Favoritar troca'}</button>
      </div>
    `;

    result.querySelector('[data-scan-own]').addEventListener('click', () => {
      updateStickerLocalAndRemote(code, { status: 'Tenho' });
    });

    result.querySelector('[data-scan-fav]').addEventListener('click', () => {
      if (state.tradeFavorites.has(code)) state.tradeFavorites.delete(code);
      else state.tradeFavorites.add(code);
      saveTradeFavorites();
      renderAll();
      window.dispatchEvent(new CustomEvent('scanner:code', { detail: { code } }));
    });
  });
}

setupEvents();
loadData();
