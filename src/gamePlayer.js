// LowTierSite - Native Game Player Controller
import { parseGitHubRepoUrl, getGameFiles } from './cacheManager.js';

let activeIframe = null;
let activeObjectUrl = null;

export const RESOLUTION_PRESETS = [
  { id: 'auto', label: 'Auto (Screen Scale)' },
  { id: '1080p', label: '1080p (Full HD)', width: 1920, height: 1080 },
  { id: '900p', label: '900p (HD+)', width: 1600, height: 900 },
  { id: '720p', label: '720p (HD - Best for Big Games)', width: 1280, height: 720 },
  { id: '540p', label: '540p (qHD - FPS Boost)', width: 960, height: 540 },
  { id: '480p', label: '480p (SD - Smooth)', width: 854, height: 480 },
  { id: '360p', label: '360p (nHD - Low-spec)', width: 640, height: 360 },
];

export async function launchGameInPlayer(meta, containerEl, spinnerEl) {
  // Clean up any prior running game session
  destroyActiveGame();

  if (spinnerEl) spinnerEl.style.display = 'flex';

  const iframe = document.createElement('iframe');
  iframe.className = 'game-iframe';
  iframe.id = 'active-game-frame';
  iframe.setAttribute('allowfullscreen', 'true');
  iframe.setAttribute(
    'allow',
    'autoplay; fullscreen; gamepad; focus-without-user-activation *; clipboard-read; clipboard-write; cross-origin-isolated'
  );

  activeIframe = iframe;

  // Determine game entry point URL
  const { id: gameId, entryPoint = 'index.html', repo = '' } = meta;
  const parsed = parseGitHubRepoUrl(repo);

  // 1. Try Virtual URL served by Service Worker
  const virtualUrl = `/game-virtual/${gameId}/${entryPoint}`;

  let swReady = false;
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    try {
      const swTest = await fetch(virtualUrl, { method: 'HEAD' });
      if (swTest.ok) {
        swReady = true;
      }
    } catch (e) {
      // fallback to blob loader
    }
  }

  if (swReady) {
    iframe.src = virtualUrl;
  } else {
    // 2. Service worker not ready or fallback: build dynamic blob HTML runtime
    try {
      const filesMap = await getGameFiles(gameId);
      const entryFile = filesMap.get(entryPoint) || filesMap.get('index.html');

      if (entryFile) {
        let htmlText = await entryFile.blob.text();

        // Inject <base> tag to resolve any relative assets
        const baseHref = parsed ? parsed.baseHref : `/game-virtual/${gameId}/`;
        if (!htmlText.includes('<base')) {
          htmlText = htmlText.replace('<head>', `<head><base href="${baseHref}">`);
        }

        const blob = new Blob([htmlText], { type: 'text/html' });
        activeObjectUrl = URL.createObjectURL(blob);
        iframe.src = activeObjectUrl;
      } else {
        // Direct virtual fallback
        iframe.src = virtualUrl;
      }
    } catch (err) {
      console.warn('Blob fallback note:', err);
      iframe.src = virtualUrl;
    }
  }

  iframe.onload = () => {
    if (spinnerEl) {
      setTimeout(() => {
        spinnerEl.style.display = 'none';
      }, 500);
    }
  };

  containerEl.innerHTML = '';
  containerEl.appendChild(iframe);
}

export function reloadActiveGame() {
  if (activeIframe) {
    const currentSrc = activeIframe.src;
    activeIframe.src = 'about:blank';
    setTimeout(() => {
      if (activeIframe) activeIframe.src = currentSrc;
    }, 50);
  }
}

export function setGameResolution(resId, viewportEl) {
  if (!activeIframe || !viewportEl) return;
  const preset = RESOLUTION_PRESETS.find((p) => p.id === resId);
  if (!preset || preset.id === 'auto') {
    activeIframe.style.width = '100%';
    activeIframe.style.height = '100%';
    activeIframe.style.maxWidth = '100%';
    activeIframe.style.maxHeight = '100%';
  } else if (preset.width && preset.height) {
    activeIframe.style.width = `${preset.width}px`;
    activeIframe.style.height = `${preset.height}px`;
    activeIframe.style.maxWidth = '100%';
    activeIframe.style.maxHeight = '100%';
  }
}

export function toggleFullscreen(targetEl) {
  if (!document.fullscreenElement) {
    if (targetEl && targetEl.requestFullscreen) {
      targetEl.requestFullscreen().catch(() => {});
    } else if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }
}

export function destroyActiveGame() {
  if (activeIframe) {
    activeIframe.src = 'about:blank';
    if (activeIframe.parentNode) {
      activeIframe.parentNode.removeChild(activeIframe);
    }
    activeIframe = null;
  }
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
}
