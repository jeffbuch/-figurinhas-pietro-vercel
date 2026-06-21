<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />

    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, viewport-fit=cover"
    />

    <meta name="theme-color" content="#061528" />
    <meta name="description" content="Controle de Figurinhas Copa 2026 — Pietro" />

    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Figurinhas Pietro" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

    <title>Figurinhas Pietro — Copa 2026</title>

    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="stylesheet" href="/src/style.css" />

    <script
      src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"
      defer
    ></script>

    <script type="module" src="/src/scanner.js"></script>
    <script type="module" src="/src/app.js"></script>
  </head>

  <body>
    <main id="app" class="app-shell">
      <header class="app-header">
        <div class="header-title">
          <h1>Controle de Figurinhas</h1>
          <p>Copa 2026 — versão mobile com sincronização no Google Sheets.</p>
        </div>

        <div class="sync-row" aria-label="Status da sincronização">
          <div class="sync-pill">
            <span class="sync-dot"></span>
            <strong id="lastUpdatedText">Atualizado</strong>
          </div>

          <div class="sync-pill">
            <strong id="pendingCount">0 pendentes</strong>
          </div>

          <label class="auto-sync">
            <input id="autoSyncToggle" type="checkbox" checked />
            <span>auto-atualizar</span>
          </label>
        </div>

        <div class="top-actions" aria-label="Ações principais">
          <button class="top-action" type="button" data-nav="home">
            <span>⌂</span>
            <strong>Home</strong>
          </button>

          <button id="refreshBtn" class="top-action top-action-primary" type="button">
            <span>↻</span>
            <strong>Atualizar</strong>
          </button>

          <button class="top-action top-action-warning" type="button" data-filter-shortcut="repeated">
            <span>⇄</span>
            <strong>Repetidas</strong>
          </button>

          <button id="tradeBtn" class="top-action" type="button" data-nav="trade">
            <span>☆</span>
            <strong>Troca</strong>
            <em id="tradeCount">0</em>
          </button>

          <button id="scannerBtn" class="top-action" type="button">
            <span>▣</span>
            <strong>Escanear</strong>
          </button>
        </div>
      </header>

      <!-- HOME -->
      <section id="viewHome" class="app-view active" data-view="home">
        <section class="control-panel">
          <div class="search-field">
            <span>⌕</span>

            <input
              id="searchInput"
              type="search"
              placeholder="Buscar código, país, sigla, grupo..."
              autocomplete="off"
              list="searchSuggestions"
            />

            <datalist id="searchSuggestions"></datalist>
          </div>

          <div class="filter-grid">
            <label class="select-field">
              <span>Grupo</span>

              <select id="groupFilter">
                <option value="all">Todos os grupos</option>
              </select>
            </label>

            <label class="select-field">
              <span>Status</span>

              <select id="statusFilter">
                <option value="all">Todos</option>
                <option value="missing">Faltantes</option>
                <option value="owned">Tenho</option>
                <option value="repeated">Repetidas</option>
              </select>
            </label>

            <label class="select-field">
              <span>Ordem</span>

              <select id="sortFilter">
                <option value="album">Ordem do álbum</option>
                <option value="country">País / Seção</option>
                <option value="percent">Percentual completo</option>
                <option value="missing">Mais faltantes</option>
              </select>
            </label>
          </div>

          <div class="quick-actions" aria-label="Filtros rápidos">
            <button class="pill active" type="button" data-filter="all">Todas</button>
            <button class="pill" type="button" data-filter="missing">Faltantes</button>
            <button class="pill" type="button" data-filter="owned">Tenho</button>
            <button class="pill" type="button" data-filter="repeated">Repetidas</button>
            <button class="pill" type="button" data-filter="trade">Troca</button>
          </div>
        </section>

        <section class="home-overview">
          <div class="section-head">
            <div>
              <h2>Seleções e seções especiais</h2>
              <p id="homeResultText">Resultado geral do álbum</p>
            </div>

            <div class="section-actions">
              <button class="mini-pill active" type="button" data-country-filter="all">
                Tudo
              </button>

              <button class="mini-pill" type="button" data-country-filter="missing">
                Só com faltantes
              </button>
            </div>
          </div>

          <div id="homeCountriesGrid" class="country-grid"></div>
        </section>
      </section>

      <!-- PAÍSES -->
      <section id="viewCountries" class="app-view hidden" data-view="countries">
        <section class="screen-panel">
          <div class="screen-head">
            <div>
              <h2>Países e seções</h2>
              <p>Resumo por seleção, seção especial, FIFA e Coca-Cola.</p>
            </div>

            <span id="countriesCount" class="screen-badge">0 seções</span>
          </div>

          <div class="section-actions">
            <button class="mini-pill active" type="button" data-country-filter="all">
              Tudo
            </button>

            <button class="mini-pill" type="button" data-country-filter="missing">
              Só com faltantes
            </button>
          </div>

          <div id="groupProgress" class="country-grid"></div>
        </section>
      </section>

      <!-- FIGURINHAS -->
      <section id="viewStickers" class="app-view hidden" data-view="stickers">
        <section class="screen-panel">
          <div class="screen-head">
            <div>
              <h2 id="stickersTitle">Figurinhas</h2>
              <p id="stickersSubtitle">Resultado da busca atual.</p>
            </div>

            <span id="resultCount" class="screen-badge">Carregando...</span>
          </div>

          <div id="stickersGrid" class="stickers-grid"></div>
        </section>
      </section>

      <!-- TROCA -->
      <section id="viewTrade" class="app-view hidden" data-view="trade">
        <section id="tradePanel" class="screen-panel">
          <div class="screen-head">
            <div>
              <h2>Modo troca</h2>
              <p>
                Favorite as figurinhas durante a busca. Quando a troca acontecer,
                efetive para marcar todas como Tenho.
              </p>
            </div>

            <span id="tradeScreenCount" class="screen-badge">0 na troca</span>
          </div>

          <div class="trade-actions">
            <button id="confirmTradeBtn" class="primary-btn" type="button">
              ✓ Efetivar troca
            </button>

            <button id="clearTradeBtn" class="danger-btn" type="button">
              🗑 Limpar troca
            </button>
          </div>

          <div id="tradeList" class="trade-list"></div>
        </section>

        <section class="info-card">
          <p>
            No modo troca, você favorita várias figurinhas enquanto pesquisa.
            Depois, se a troca der certo, clique em <strong>Efetivar troca</strong>
            para marcar todas como <strong>✅ Tenho</strong>.
          </p>
        </section>
      </section>

      <!-- SCAN -->
      <section id="viewScan" class="app-view hidden" data-view="scan">
        <section class="screen-panel">
          <div class="screen-head">
            <div>
              <h2>Escanear figurinha</h2>
              <p>
                Mire a câmera no código do topo direito, como ARG4, BRA12,
                FIFA3 ou CC1. Depois confirme o resultado.
              </p>
            </div>
          </div>

          <div class="scanner-page-actions">
            <button id="openCameraBtn" class="primary-btn" type="button">
              📷 Abrir câmera
            </button>

            <button id="readCodeShortcutBtn" class="secondary-btn" type="button">
              ⛶ Ler código
            </button>
          </div>

          <div class="manual-code-page">
            <label for="manualCodeInputPage">Digitar código manualmente</label>

            <div>
              <input
                id="manualCodeInputPage"
                type="text"
                placeholder="ARG4, BRA12, CC1..."
                autocomplete="off"
              />

              <button id="manualCodeBtnPage" class="secondary-btn" type="button">
                Buscar
              </button>
            </div>
          </div>

          <div id="scannerResultPage" class="scanner-result"></div>
        </section>
      </section>

      <!-- RESUMO -->
      <section id="viewSummary" class="app-view hidden" data-view="summary">
        <section class="summary-hero screen-panel">
          <div class="screen-head">
            <div>
              <h2>Resumo do álbum</h2>
              <p>Estatísticas, gráficos e atalhos do álbum inteiro.</p>
            </div>

            <span id="summaryPercentBadge" class="screen-badge">0% completo</span>
          </div>

          <div class="summary-tabs">
            <button class="mini-pill active" type="button" data-summary-tab="album">
              Resumo do álbum
            </button>

            <button class="mini-pill" type="button" data-summary-tab="section">
              Resumo da seção
            </button>
          </div>

          <div class="summary-grid">
            <div class="summary-stat stat-total">
              <span>▤</span>
              <strong id="statTotal">0</strong>
              <small>Total do álbum</small>
            </div>

            <div class="summary-stat stat-repeated">
              <span>⇄</span>
              <strong id="statRepeated">0</strong>
              <small>Repetidas</small>
            </div>

            <div class="summary-stat stat-owned">
              <span>✓</span>
              <strong id="statOwned">0</strong>
              <small>Tenho</small>
            </div>

            <div class="summary-stat stat-missing">
              <span>×</span>
              <strong id="statMissing">0</strong>
              <small>Faltam</small>
            </div>
          </div>

          <div class="progress-box">
            <div class="progress-head">
              <h3>Progresso geral</h3>
              <strong id="progressPercent">0%</strong>
            </div>

            <p id="progressText">0 de 0 figurinhas</p>

            <div class="progress-track">
              <div id="progressBar" class="progress-bar"></div>
            </div>
          </div>
        </section>

        <section class="screen-panel">
          <div class="panel-title">
            <h3>Gráficos e estatísticas</h3>
          </div>

          <div class="insight-grid">
            <div class="insight-card">
              <small>Completos</small>
              <strong id="completedSectionsCount">0</strong>
            </div>

            <div class="insight-card">
              <small>Em andamento</small>
              <strong id="inProgressSectionsCount">0</strong>
            </div>

            <div class="insight-card">
              <small>Sem iniciar</small>
              <strong id="notStartedSectionsCount">0</strong>
            </div>

            <div class="insight-card">
              <small>Filtro atual</small>
              <strong id="currentFilterPercent">0%</strong>
            </div>
          </div>
        </section>

        <section class="screen-panel">
          <div class="panel-title">
            <h3>Repetidas principais</h3>
          </div>

          <div id="topRepeatedList" class="ranking-list"></div>
        </section>

        <section class="screen-panel">
          <div class="panel-title">
            <h3>Países / seções que mais faltam</h3>
          </div>

          <div id="mostMissingList" class="ranking-list"></div>
        </section>

        <section class="screen-panel">
          <div class="panel-title">
            <h3>Países / seções que mais tenho</h3>
          </div>

          <div id="mostOwnedList" class="ranking-list"></div>
        </section>

        <section class="screen-panel">
          <div class="panel-title">
            <h3>Seções completas</h3>
          </div>

          <div id="completedSectionsList" class="ranking-list"></div>
        </section>

        <section class="screen-panel">
          <div class="panel-title">
            <h3>Progresso por grupo</h3>
          </div>

          <div id="summaryGroupProgress" class="group-bars"></div>
        </section>

        <section class="screen-panel summary-tools">
          <div class="panel-title">
            <h3>Ferramentas do resumo</h3>
          </div>

          <button id="syncSummaryBtn" class="secondary-btn" type="button">
            ☁ Sincronizar
          </button>

          <button id="exportCsvBtn" class="secondary-btn" type="button">
            ▤ CSV
          </button>

          <button id="clearLocalBtn" class="danger-btn" type="button">
            🗑 Limpar local
          </button>
        </section>
      </section>

      <footer class="app-notes">
        <p>
          No celular, abra o link do Web App no Safari/Chrome e use
          “Adicionar à Tela de Início” para ficar com cara de app.
        </p>

        <p>
          As alterações são salvas primeiro no aparelho e, quando online,
          gravadas na aba <strong>Controle</strong> da planilha.
        </p>
      </footer>
    </main>

    <!-- MODAL DO SCANNER - compatível com src/scanner.js -->
    <section id="scannerModal" class="modal hidden" aria-hidden="true">
      <div class="modal-card">
        <div class="modal-head">
          <div>
            <h2>Scanner</h2>
            <p>Aponte para o código no topo direito da figurinha.</p>
          </div>

          <button id="closeScannerBtn" class="icon-btn" type="button" aria-label="Fechar">
            ×
          </button>
        </div>

        <div class="camera-box">
          <video id="cameraVideo" autoplay playsinline muted></video>

          <div class="scan-frame">
            <span>Código</span>
          </div>

          <canvas id="scanCanvas" class="hidden"></canvas>
        </div>

        <div class="scanner-actions">
          <button id="scanNowBtn" class="primary-btn" type="button">
            Ler código
          </button>

          <button id="stopCameraBtn" class="secondary-btn" type="button">
            Parar câmera
          </button>
        </div>

        <div class="manual-code">
          <input
            id="manualCodeInput"
            type="text"
            placeholder="Digite ARG4, BRA12, CC1..."
            autocomplete="off"
          />

          <button id="manualCodeBtn" class="secondary-btn" type="button">
            Buscar
          </button>
        </div>

        <div id="scannerResult" class="scanner-result"></div>
      </div>
    </section>

    <!-- MENU INFERIOR -->
    <nav class="bottom-nav" aria-label="Menu principal">
      <button class="bottom-nav-item active" type="button" data-nav="home">
        <span>⌂</span>
        <strong>Home</strong>
      </button>

      <button class="bottom-nav-item" type="button" data-nav="countries">
        <span>▦</span>
        <strong>Países</strong>
      </button>

      <button class="bottom-nav-item" type="button" data-nav="stickers">
        <span>▤</span>
        <strong>Figurinhas</strong>
      </button>

      <button class="bottom-nav-item" type="button" data-nav="trade">
        <span>☆</span>
        <strong>Troca</strong>
      </button>

      <button class="bottom-nav-item" type="button" data-nav="scan">
        <span>▣</span>
        <strong>Scan</strong>
      </button>

      <button class="bottom-nav-item" type="button" data-nav="summary">
        <span>▥</span>
        <strong>Resumo</strong>
      </button>
    </nav>

    <div id="toast" class="toast hidden"></div>
  </body>
</html>
