// LowTierSite - Native Application Controller
import {
  initServiceWorker,
  getAllCachedGames,
  deleteGameCache,
  clearAllCaches,
  slugifyGame,
  formatBytes,
} from './cacheManager.js';
import { downloadGameToCache } from './githubDownloader.js';
import {
  launchGameInPlayer,
  reloadActiveGame,
  setGameResolution,
  toggleFullscreen,
  destroyActiveGame,
  RESOLUTION_PRESETS,
} from './gamePlayer.js';

// Application State
let allGames = [];
let cachedGamesMap = new Map();
let searchQuery = '';
let selectedGenre = 'All';
let activeDownloadingGame = null;
let downloadAbortController = null;
let activePlayingMeta = null;

// DOM Elements
const searchInput = document.getElementById('search-games-input');
const sortDropdownBtn = document.getElementById('genre-sort-dropdown-btn');
const sortDropdownMenu = document.getElementById('genre-dropdown-menu');
const genreItemsContainer = document.getElementById('genre-items-container');
const cacheManagerBtn = document.getElementById('open-cache-manager-btn');
const cacheCountBadge = document.getElementById('cache-count-badge');
const testersBtn = document.getElementById('open-testers-btn');

const gameGrid = document.getElementById('game-grid');
const emptyState = document.getElementById('empty-state');
const clearSearchBtn = document.getElementById('clear-search-btn');

// Download Modal Elements
const downloadModal = document.getElementById('download-modal');
const downloadCloseBtn = document.getElementById('download-close-btn');
const downloadCancelBtn = document.getElementById('download-cancel-btn');
const downloadThumb = document.getElementById('download-thumb');
const downloadTitle = document.getElementById('download-title');
const downloadGenre = document.getElementById('download-genre');
const downloadProgressBar = document.getElementById('download-progress-bar');
const downloadStatusText = document.getElementById('download-status-text');
const downloadPercentText = document.getElementById('download-percent-text');

// Cache Manager Modal Elements
const cacheModal = document.getElementById('cache-modal');
const cacheModalCloseBtn = document.getElementById('cache-modal-close-btn');
const cacheModalFooterClose = document.getElementById('cache-modal-footer-close');
const cacheTotalGames = document.getElementById('cache-total-games');
const cacheTotalSize = document.getElementById('cache-total-size');
const cachedListContainer = document.getElementById('cached-list-container');
const clearAllCachesBtn = document.getElementById('clear-all-caches-btn');

// Testers Modal Elements
const testersModal = document.getElementById('testers-modal');
const testersModalCloseBtn = document.getElementById('testers-modal-close-btn');
const testersModalFooterClose = document.getElementById('testers-modal-footer-close');

// Game Player Elements
const playerOverlay = document.getElementById('player-overlay');
const playerBackBtn = document.getElementById('player-back-btn');
const playerGameTitle = document.getElementById('player-game-title');
const playerCacheBadge = document.getElementById('player-cache-badge');
const resolutionSelect = document.getElementById('resolution-select');
const playerReloadBtn = document.getElementById('player-reload-btn');
const playerFullscreenBtn = document.getElementById('player-fullscreen-btn');
const playerViewport = document.getElementById('player-viewport');
const gameSpinner = document.getElementById('game-spinner');

// Initialize Application
async function initApp() {
  initServiceWorker();
  populateResolutionOptions();
  setupEventListeners();

  await loadGamesMetadata();
  await refreshCacheStatus();
}

// Populate Resolution Options
function populateResolutionOptions() {
  if (!resolutionSelect) return;
  resolutionSelect.innerHTML = '';
  RESOLUTION_PRESETS.forEach((preset) => {
    const opt = document.createElement('option');
    opt.value = preset.id;
    opt.textContent = preset.label;
    resolutionSelect.appendChild(opt);
  });
}

// Load GameMetadata.json
async function loadGamesMetadata() {
  try {
    let data = null;
    const resp = await fetch('/GameMetadata.json');
    if (resp.ok) {
      data = await resp.json();
    } else {
      const apiResp = await fetch('/api/games');
      if (apiResp.ok) {
        data = await apiResp.json();
      }
    }

    if (Array.isArray(data)) {
      // Sort games alphabetically A to Z
      allGames = [...data].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' })
      );
      buildGenreDropdown();
      renderGames();
    }
  } catch (err) {
    console.error('Failed to load games metadata:', err);
  }
}

// Refresh Cached Games status from IndexedDB
async function refreshCacheStatus() {
  try {
    const list = await getAllCachedGames();
    cachedGamesMap = new Map();
    let totalBytes = 0;
    for (const item of list) {
      cachedGamesMap.set(item.id, item);
      totalBytes += item.totalBytes || 0;
    }

    // Update Cache badge in header
    if (cacheCountBadge) {
      if (cachedGamesMap.size > 0) {
        cacheCountBadge.textContent = `${cachedGamesMap.size} (${formatBytes(totalBytes)})`;
        cacheCountBadge.style.display = 'inline-block';
      } else {
        cacheCountBadge.textContent = '0';
        cacheCountBadge.style.display = 'none';
      }
    }

    renderGames();
  } catch (err) {
    console.error('Failed to read cached games:', err);
  }
}

// Build Genre Dropdown
function buildGenreDropdown() {
  if (!genreItemsContainer) return;
  const genres = new Set();
  for (const g of allGames) {
    if (g.genre) genres.add(g.genre);
  }
  const sortedGenres = ['All', ...Array.from(genres).sort()];

  genreItemsContainer.innerHTML = '';
  sortedGenres.forEach((genre) => {
    const btn = document.createElement('button');
    btn.className = `dropdown-item ${selectedGenre === genre ? 'selected' : ''}`;
    btn.textContent = genre;
    btn.onclick = () => {
      selectedGenre = genre;
      sortDropdownMenu.classList.remove('open');
      updateSortButtonState();
      buildGenreDropdown();
      renderGames();
    };
    genreItemsContainer.appendChild(btn);
  });
}

function updateSortButtonState() {
  if (!sortDropdownBtn) return;
  if (selectedGenre !== 'All') {
    sortDropdownBtn.classList.add('active');
    sortDropdownBtn.title = `Filtered by: ${selectedGenre}`;
  } else {
    sortDropdownBtn.classList.remove('active');
    sortDropdownBtn.title = 'Filter by genre';
  }
}

// Filter Games
function getFilteredGames() {
  const query = searchQuery.trim().toLowerCase();
  const genre = selectedGenre.toLowerCase();

  return allGames.filter((g) => {
    const matchesSearch = !query || (g.name || '').toLowerCase().includes(query);
    const matchesGenre = selectedGenre === 'All' || (g.genre || '').toLowerCase() === genre;
    return matchesSearch && matchesGenre;
  });
}

// Render Games Grid
function renderGames() {
  if (!gameGrid) return;
  const filtered = getFilteredGames();

  if (filtered.length === 0) {
    gameGrid.innerHTML = '';
    gameGrid.style.display = 'none';
    if (emptyState) emptyState.style.display = 'flex';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  gameGrid.style.display = 'grid';
  gameGrid.innerHTML = '';

  filtered.forEach((game) => {
    const gameId = slugifyGame(game.name);
    const cachedMeta = cachedGamesMap.get(gameId);
    const isCached = !!cachedMeta;

    let daysRemaining = null;
    if (cachedMeta) {
      const ms = cachedMeta.expiresAt - Date.now();
      daysRemaining = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
    }

    const card = document.createElement('div');
    card.className = 'game-card';
    card.id = `card-${gameId}`;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    card.innerHTML = `
      <div class="card-thumb-wrapper">
        <img 
          src="${game.thumbnail || ''}" 
          alt="${game.name}" 
          class="card-thumb" 
          loading="lazy"
          onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'300\\' height=\\'300\\' fill=\\'%23121214\\'><rect width=\\'100%\\' height=\\'100%\\'/><text x=\\'50%\\' y=\\'50%\\' fill=\\'%23666666\\' font-family=\\'sans-serif\\' font-size=\\'13\\' text-anchor=\\'middle\\' dominant-baseline=\\'middle\\'>${encodeURIComponent(game.name)}</text></svg>'"
        />
        <div class="badge-overlay">
          <span class="badge-tag">${game.badge || 'Low'}</span>
          ${isCached ? `<span class="badge-tag cached">${daysRemaining}d left</span>` : ''}
        </div>
      </div>
      
      <!-- Resting subtle title preview -->
      <div class="card-title-preview">
        <span>${game.name}</span>
      </div>

      <!-- Floating controls on hover / touch -->
      <div class="card-overlay" id="overlay-${gameId}">
        <div class="card-overlay-meta">
          <h3 class="card-overlay-title" title="${game.name}">${game.name}</h3>
          <span class="card-overlay-genre">${game.genre || 'Game'}</span>
        </div>
        <div class="card-overlay-actions">
          <button class="btn-card-action ${isCached ? 'play' : ''}" id="action-btn-${gameId}" aria-label="${isCached ? 'Play ' + game.name : 'Download ' + game.name}">
            ${
              isCached
                ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg><span>Play</span>`
                : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span>Download</span>`
            }
          </button>
          ${
            isCached
              ? `<button class="btn-card-trash" id="del-btn-${gameId}" title="Delete cached game" aria-label="Delete cache">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>`
              : ''
          }
        </div>
      </div>
    `;

    // Click anywhere on card (or press Enter) to Play or Download
    const triggerCardAction = () => {
      if (isCached) {
        launchGame(cachedMeta);
      } else {
        startDownload(game);
      }
    };

    card.onclick = (e) => {
      // Ignore if user clicked the trash button
      if (e.target.closest(`#del-btn-${gameId}`)) return;
      triggerCardAction();
    };

    card.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        triggerCardAction();
      }
    };

    // Action button inside overlay
    const actionBtn = card.querySelector(`#action-btn-${gameId}`);
    if (actionBtn) {
      actionBtn.onclick = (e) => {
        e.stopPropagation();
        triggerCardAction();
      };
    }

    // Delete cache button handler
    const delBtn = card.querySelector(`#del-btn-${gameId}`);
    if (delBtn) {
      delBtn.onclick = async (e) => {
        e.stopPropagation();
        await deleteGameCache(gameId);
        await refreshCacheStatus();
      };
    }

    gameGrid.appendChild(card);
  });
}

// Download Modal Workflow
function startDownload(game) {
  activeDownloadingGame = game;
  downloadAbortController = new AbortController();

  if (downloadModal) {
    downloadThumb.src = game.thumbnail || '';
    downloadTitle.textContent = game.name;
    downloadGenre.textContent = `${game.genre || 'Web Game'} • ${game.badge || 'Low Tier'}`;
    downloadProgressBar.style.width = '0%';
    downloadStatusText.textContent = 'Initializing download...';
    downloadPercentText.textContent = '0%';
    downloadModal.classList.add('open');
  }

  downloadGameToCache(
    game.name,
    game.repo,
    (progress) => {
      if (downloadProgressBar) {
        downloadProgressBar.style.width = `${progress.percentage}%`;
      }
      if (downloadPercentText) {
        downloadPercentText.textContent = `${progress.percentage}%`;
      }
      if (downloadStatusText) {
        if (progress.phase === 'inspecting') {
          downloadStatusText.textContent = 'Querying game manifest...';
        } else if (progress.phase === 'downloading') {
          const loadedStr = formatBytes(progress.bytesDownloaded);
          const totalStr = formatBytes(progress.totalBytes);
          downloadStatusText.textContent = `Downloading ${progress.filesDone}/${progress.totalFiles} files (${loadedStr} / ${totalStr})`;
        } else if (progress.phase === 'caching') {
          downloadStatusText.textContent = 'Writing to 30-day offline browser storage...';
        } else if (progress.phase === 'complete') {
          downloadStatusText.textContent = 'Download ready! Launching game...';
        }
      }
    },
    downloadAbortController.signal
  )
    .then(async (meta) => {
      await refreshCacheStatus();
      setTimeout(() => {
        closeDownloadModal();
        launchGame(meta);
      }, 400);
    })
    .catch((err) => {
      if (err.message === 'Download cancelled') {
        closeDownloadModal();
      } else {
        alert(`Download failed: ${err.message || 'Unknown network error'}`);
        closeDownloadModal();
      }
    });
}

function cancelDownload() {
  if (downloadAbortController) {
    downloadAbortController.abort();
    downloadAbortController = null;
  }
  closeDownloadModal();
}

function closeDownloadModal() {
  if (downloadModal) downloadModal.classList.remove('open');
  activeDownloadingGame = null;
}

// Launch Game in Player
function launchGame(meta) {
  activePlayingMeta = meta;
  if (!playerOverlay) return;

  playerGameTitle.textContent = meta.name || 'Game';

  const ms = (meta.expiresAt || 0) - Date.now();
  const days = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  playerCacheBadge.textContent = `${days}d cached`;

  if (resolutionSelect) resolutionSelect.value = 'auto';

  playerOverlay.classList.add('open');
  launchGameInPlayer(meta, playerViewport, gameSpinner);
}

function closePlayer() {
  if (playerOverlay) playerOverlay.classList.remove('open');
  destroyActiveGame();
  activePlayingMeta = null;
  refreshCacheStatus();
}

// Cache Manager Modal Workflow
function openCacheManagerModal() {
  if (!cacheModal) return;

  const cachedArray = Array.from(cachedGamesMap.values());
  let totalBytes = 0;
  cachedArray.forEach((c) => (totalBytes += c.totalBytes || 0));

  if (cacheTotalGames) cacheTotalGames.textContent = `${cachedArray.length} games`;
  if (cacheTotalSize) cacheTotalSize.textContent = formatBytes(totalBytes);

  if (cachedListContainer) {
    cachedListContainer.innerHTML = '';
    if (cachedArray.length === 0) {
      cachedListContainer.innerHTML = `
        <div style="text-align: center; padding: 24px; color: #71717a; font-size: 13px;">
          No games currently stored in browser cache.
        </div>
      `;
    } else {
      cachedArray.forEach((meta) => {
        const ms = meta.expiresAt - Date.now();
        const days = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
        const item = document.createElement('div');
        item.className = 'cached-game-item';
        item.innerHTML = `
          <div class="cached-game-left">
            <span class="cached-game-title">${meta.name}</span>
            <span class="cached-game-sub">${formatBytes(meta.totalBytes)} • ${meta.filesCount} files • ${days} days remaining</span>
          </div>
          <div class="cached-game-actions">
            <button class="btn-small-play" id="play-cache-${meta.id}">Play</button>
            <button class="btn-small-del" id="del-cache-${meta.id}">Delete</button>
          </div>
        `;

        item.querySelector(`#play-cache-${meta.id}`).onclick = () => {
          closeCacheManagerModal();
          launchGame(meta);
        };

        item.querySelector(`#del-cache-${meta.id}`).onclick = async () => {
          await deleteGameCache(meta.id);
          await refreshCacheStatus();
          openCacheManagerModal();
        };

        cachedListContainer.appendChild(item);
      });
    }
  }

  cacheModal.classList.add('open');
}

function closeCacheManagerModal() {
  if (cacheModal) cacheModal.classList.remove('open');
}

// Testers Modal Workflow
function openTestersModal() {
  if (testersModal) testersModal.classList.add('open');
}

function closeTestersModal() {
  if (testersModal) testersModal.classList.remove('open');
}

// Global Event Listeners
function setupEventListeners() {
  // Live Search
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderGames();
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      searchQuery = '';
      selectedGenre = 'All';
      if (searchInput) searchInput.value = '';
      updateSortButtonState();
      buildGenreDropdown();
      renderGames();
    });
  }

  // Genre Sort Dropdown toggle
  if (sortDropdownBtn) {
    sortDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      sortDropdownMenu.classList.toggle('open');
    });
  }

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (sortDropdownMenu && !sortDropdownMenu.contains(e.target) && e.target !== sortDropdownBtn) {
      sortDropdownMenu.classList.remove('open');
    }
  });

  // Open Modals
  if (cacheManagerBtn) cacheManagerBtn.addEventListener('click', openCacheManagerModal);
  if (testersBtn) testersBtn.addEventListener('click', openTestersModal);

  // Close Modals
  if (downloadCloseBtn) downloadCloseBtn.addEventListener('click', cancelDownload);
  if (downloadCancelBtn) downloadCancelBtn.addEventListener('click', cancelDownload);

  if (cacheModalCloseBtn) cacheModalCloseBtn.addEventListener('click', closeCacheManagerModal);
  if (cacheModalFooterClose) cacheModalFooterClose.addEventListener('click', closeCacheManagerModal);

  if (clearAllCachesBtn) {
    clearAllCachesBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to clear all cached games from your browser?')) {
        await clearAllCaches();
        await refreshCacheStatus();
        openCacheManagerModal();
      }
    });
  }

  if (testersModalCloseBtn) testersModalCloseBtn.addEventListener('click', closeTestersModal);
  if (testersModalFooterClose) testersModalFooterClose.addEventListener('click', closeTestersModal);

  // Player controls
  if (playerBackBtn) playerBackBtn.addEventListener('click', closePlayer);
  if (playerReloadBtn) playerReloadBtn.addEventListener('click', reloadActiveGame);
  if (playerFullscreenBtn) {
    playerFullscreenBtn.addEventListener('click', () => toggleFullscreen(playerOverlay));
  }
  if (resolutionSelect) {
    resolutionSelect.addEventListener('change', (e) => {
      setGameResolution(e.target.value, playerViewport);
    });
  }

  // Keyboard shortcut: Escape to exit modals or player
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (playerOverlay && playerOverlay.classList.contains('open')) {
        closePlayer();
      } else if (downloadModal && downloadModal.classList.contains('open')) {
        cancelDownload();
      } else if (cacheModal && cacheModal.classList.contains('open')) {
        closeCacheManagerModal();
      } else if (testersModal && testersModal.classList.contains('open')) {
        closeTestersModal();
      }
    }
  });
}

// Boot
window.addEventListener('DOMContentLoaded', initApp);
