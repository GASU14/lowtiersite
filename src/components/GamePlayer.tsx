import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  RotateCcw,
  Maximize2,
  Minimize2,
  Loader2,
  Smartphone,
  Monitor,
  Tv,
  Check,
  Sliders,
  Scroll,
} from 'lucide-react';
import { CachedGameMeta, AspectRatioMode } from '../types';
import { parseGitHubRepoUrl } from '../utils/cacheManager';

export type GameResolution = 'auto' | '1080p' | '900p' | '720p' | '540p' | '480p' | '360p';

export interface ResolutionConfig {
  id: GameResolution;
  label: string;
  sub: string;
  width?: number;
  height?: number;
}

export const RESOLUTION_PRESETS: ResolutionConfig[] = [
  { id: 'auto', label: 'Auto', sub: 'Native Screen Scale' },
  { id: '1080p', label: '1080p', sub: '1920×1080 Full HD', width: 1920, height: 1080 },
  { id: '900p', label: '900p', sub: '1600×900 HD+', width: 1600, height: 900 },
  { id: '720p', label: '720p', sub: '1280×720 HD (Recommended for big games)', width: 1280, height: 720 },
  { id: '540p', label: '540p', sub: '960×540 qHD (FPS Boost for laggy games)', width: 960, height: 540 },
  { id: '480p', label: '480p', sub: '854×480 SD (Smooth performance)', width: 854, height: 480 },
  { id: '360p', label: '360p', sub: '640×360 nHD (Low-spec boost)', width: 640, height: 360 },
];

interface GamePlayerProps {
  meta: CachedGameMeta;
  onBack: () => void;
  daysRemaining?: number;
}

function getRuntimeIsolationCSS(allowScroll: boolean) {
  return `
  * {
    scrollbar-width: ${allowScroll ? 'thin' : 'none'} !important;
    -ms-overflow-style: ${allowScroll ? 'auto' : 'none'} !important;
    box-sizing: border-box !important;
  }
  *::-webkit-scrollbar {
    display: ${allowScroll ? 'block' : 'none'} !important;
    width: ${allowScroll ? '6px' : '0'} !important;
    height: ${allowScroll ? '6px' : '0'} !important;
  }
  *::-webkit-scrollbar-thumb {
    background: #555555 !important;
    border-radius: 3px !important;
  }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    height: ${allowScroll ? 'auto' : '100%'} !important;
    min-height: 100% !important;
    overflow: ${allowScroll ? 'auto' : 'hidden'} !important;
    background-color: #000 !important;
    display: block !important;
  }
  #unity-container, #game-container, #gameContainer, .webgl-content {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100% !important;
    height: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    display: block !important;
    background: #000 !important;
    z-index: 1 !important;
  }
  #unity-canvas, #canvas, #MMFCanvas, canvas {
    width: 100% !important;
    height: 100% !important;
    max-width: 100% !important;
    max-height: 100% !important;
    object-fit: fill !important;
    display: block !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #000 !important;
  }
  #unity-loading-bar {
    position: absolute !important;
    left: 50% !important;
    top: 50% !important;
    transform: translate(-50%, -50%) !important;
    z-index: 10 !important;
  }
`;
}

function buildGameRuntimeHTML(rawHtml: string, baseHref: string, allowScroll: boolean = false): string {
  let finalHtml = rawHtml;

  // Sanitize blocked CDN domains (e.g. genizy on jsDelivr)
  finalHtml = finalHtml.replace(/https:\/\/cdn\.jsdelivr\.net\/gh\/genizy\/web-port@[^\/]+\/ultrakill\/?/gi, baseHref);

  // Fix EmulatorJS case mismatches and ROM casing
  finalHtml = finalHtml.replace(/games\/Pokemon_Emerald\.gba/gi, 'games/pokemon_emerald.gba');
  // Disarm cross-origin service worker registration that fails in iframes
  finalHtml = finalHtml.replace(/<script\s+src=["'][^"']*coi-serviceworker\.js["'][^>]*><\/script>/gi, '<!-- coi-serviceworker disarmed in iframe -->');

  // Replace or inject <base href="...">
  const baseTag = `<base href="${baseHref}">`;
  if (/<base\s+[^>]*>/i.test(finalHtml)) {
    finalHtml = finalHtml.replace(/<base\s+[^>]*>/gi, baseTag);
  } else if (/<head[^>]*>/i.test(finalHtml)) {
    finalHtml = finalHtml.replace(/<head[^>]*>/i, `$& \n  ${baseTag}`);
  } else {
    finalHtml = baseTag + '\n' + finalHtml;
  }

  // Runtime patch script: Fixes Unity WebGL URL constructor, disarms teardown errors, handles canvas scaling, and fixes case mismatches
  const runtimeScript = `
<script id="lowteir-runtime-patch">
(function() {
  var gameBaseHref = ${JSON.stringify(baseHref)};

  // Intercept fetch and XMLHttpRequest to fix case-sensitivity on CDNs and emulator configs
  var origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function(input, init) {
      try {
        if (typeof input === 'string') {
          if (input.indexOf('Pokemon_Emerald.gba') !== -1) {
            input = input.replace(/Pokemon_Emerald\.gba/g, 'pokemon_emerald.gba');
          }
          if (input.indexOf('en-US.json') !== -1) {
            input = input.replace(/en-US\.json/g, 'en-us.json');
          }
        } else if (input && typeof input.url === 'string') {
          var u = input.url;
          if (u.indexOf('Pokemon_Emerald.gba') !== -1 || u.indexOf('en-US.json') !== -1) {
            var newUrl = u.replace(/Pokemon_Emerald\.gba/g, 'pokemon_emerald.gba').replace(/en-US\.json/g, 'en-us.json');
            input = new Request(newUrl, input);
          }
        }
      } catch (e) {}
      return origFetch.call(this, input, init);
    };
  }

  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    try {
      if (typeof url === 'string') {
        if (url.indexOf('Pokemon_Emerald.gba') !== -1) {
          url = url.replace(/Pokemon_Emerald\.gba/g, 'pokemon_emerald.gba');
        }
        if (url.indexOf('en-US.json') !== -1) {
          url = url.replace(/en-US\.json/g, 'en-us.json');
        }
      }
    } catch (e) {}
    return origOpen.apply(this, arguments);
  };

  // 1. Fix Unity WebGL "Failed to construct 'URL': Invalid URL" error
  // Unity WebGL loaders do: new URL(c.streamingAssetsUrl, document.URL)
  // When running inside a blob: URL or srcdoc iframe, document.URL has scheme 'blob:', which URL() rejects as a base.
  var OriginalURL = window.URL;
  function PatchedURL(url, base) {
    if (!base || (typeof base === 'string' && (base.indexOf('blob:') === 0 || base.indexOf('about:') === 0))) {
      var baseElem = document.querySelector('base');
      base = (baseElem && baseElem.href) ? baseElem.href : gameBaseHref;
    }
    try {
      return new OriginalURL(url, base);
    } catch (err) {
      return new OriginalURL(url, gameBaseHref);
    }
  }
  try {
    Object.setPrototypeOf(PatchedURL, OriginalURL);
    PatchedURL.prototype = OriginalURL.prototype;
    window.URL = PatchedURL;
    if (typeof window.webkitURL !== 'undefined') {
      window.webkitURL = PatchedURL;
    }
  } catch (e) {}

  try {
    Object.defineProperty(document, 'URL', {
      get: function() { return gameBaseHref; },
      configurable: true
    });
    Object.defineProperty(document, 'baseURI', {
      get: function() { return gameBaseHref; },
      configurable: true
    });
  } catch (e) {}

  // 1.5 Fix Cross-Origin Web Workers (e.g. Eaglercraft worker_bootstrap.js from CDN)
  // Cross-origin script URLs passed to new Worker() trigger SecurityError in browsers.
  // We proxy Worker using a same-origin Blob with self.importScripts patched for relative imports.
  var OrigWorker = window.Worker;
  if (OrigWorker) {
    function PatchedWorker(scriptURL, options) {
      try {
        var resolvedUrl = scriptURL;
        if (typeof scriptURL === 'string') {
          try {
            resolvedUrl = new OriginalURL(scriptURL, gameBaseHref).href;
          } catch (e) {
            resolvedUrl = scriptURL;
          }
        }
        if (typeof resolvedUrl === 'string' && (resolvedUrl.indexOf('http://') === 0 || resolvedUrl.indexOf('https://') === 0)) {
          var workerBase = resolvedUrl.substring(0, resolvedUrl.lastIndexOf('/') + 1);
          var blobCode = [
            '(function() {',
            '  var _workerBase = ' + JSON.stringify(workerBase) + ';',
            '  var _origImportScripts = self.importScripts;',
            '  self.importScripts = function() {',
            '    var args = Array.prototype.slice.call(arguments).map(function(s) {',
            '      if (typeof s === "string" && s.indexOf("http://") !== 0 && s.indexOf("https://") !== 0 && s.indexOf("blob:") !== 0 && s.indexOf("data:") !== 0) {',
            '        return _workerBase + (s.charAt(0) === "/" ? s.slice(1) : s);',
            '      }',
            '      return s;',
            '    });',
            '    return _origImportScripts.apply(self, args);',
            '  };',
            '  _origImportScripts(' + JSON.stringify(resolvedUrl) + ');',
            '})();'
          ].join('\\n');
          var blob = new Blob([blobCode], { type: 'application/javascript' });
          var blobUrl = OriginalURL.createObjectURL(blob);
          return new OrigWorker(blobUrl, options);
        }
      } catch (err) {
        console.warn('PatchedWorker error, falling back to original Worker:', err);
      }
      return new OrigWorker(scriptURL, options);
    }
    PatchedWorker.prototype = OrigWorker.prototype;
    window.Worker = PatchedWorker;
  }

  // 2. Suppress unhandled teardown exceptions (e.g. Eaglercraft onbeforeunload null pointer)
  window.addEventListener('beforeunload', function() {
    try { window.onbeforeunload = null; } catch(e) {}
    try { window.onunload = null; } catch(e) {}
  }, { capture: true });

  window.addEventListener('error', function(e) {
    var msg = (e && (e.message || (e.error && e.error.message))) || '';
    if (msg.indexOf("reading 'jm'") !== -1 || 
        msg.indexOf("reading 'stack'") !== -1 ||
        msg.indexOf('WebGL: INVALID_OPERATION') !== -1) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  });

  // 3. Auto-scaling canvas helper for clean zero-border layout
  function fixFullscreenCanvases() {
    var canvases = document.querySelectorAll('canvas');
    for (var i = 0; i < canvases.length; i++) {
      var c = canvases[i];
      c.style.setProperty('width', '100%', 'important');
      c.style.setProperty('height', '100%', 'important');
      c.style.setProperty('max-width', '100%', 'important');
      c.style.setProperty('max-height', '100%', 'important');
      c.style.setProperty('object-fit', 'fill', 'important');
      c.style.setProperty('margin', '0', 'important');
      c.style.setProperty('padding', '0', 'important');
      if (c.parentElement && c.parentElement !== document.body && c.parentElement.id !== 'unity-loading-bar') {
        c.parentElement.style.setProperty('width', '100%', 'important');
        c.parentElement.style.setProperty('height', '100%', 'important');
        c.parentElement.style.setProperty('position', 'absolute', 'important');
        c.parentElement.style.setProperty('top', '0', 'important');
        c.parentElement.style.setProperty('left', '0', 'important');
        c.parentElement.style.setProperty('right', '0', 'important');
        c.parentElement.style.setProperty('bottom', '0', 'important');
        c.parentElement.style.setProperty('display', 'block', 'important');
        c.parentElement.style.setProperty('margin', '0', 'important');
        c.parentElement.style.setProperty('padding', '0', 'important');
        c.parentElement.style.setProperty('background', '#000', 'important');
      }
    }
  }
  window.addEventListener('resize', fixFullscreenCanvases);
  window.addEventListener('DOMContentLoaded', fixFullscreenCanvases);
  window.addEventListener('load', function() {
    fixFullscreenCanvases();
    setTimeout(fixFullscreenCanvases, 200);
    setTimeout(fixFullscreenCanvases, 800);
    setTimeout(fixFullscreenCanvases, 2000);
  });
})();
</script>
`;

  const isolationCSS = getRuntimeIsolationCSS(allowScroll);
  const fullInjection = `
  <style id="clean-runtime-scrollbar">${isolationCSS}</style>
  ${runtimeScript}
`;

  // Inject at the very beginning of <head> so PatchedURL is active before any game scripts run
  if (/<head[^>]*>/i.test(finalHtml)) {
    finalHtml = finalHtml.replace(/<head[^>]*>/i, `$& \n  ${fullInjection}`);
  } else {
    finalHtml = fullInjection + '\n' + finalHtml;
  }

  return finalHtml;
}

export const GamePlayer: React.FC<GamePlayerProps> = ({ meta, onBack }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [keySeed, setKeySeed] = useState(1);
  const [frameSrc, setFrameSrc] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatioMode>(() => {
    try {
      const key = `lowteir_aspect_${meta.id || meta.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const saved = localStorage.getItem(key);
      if (saved && (saved === 'fill' || saved === '9:16' || saved === '16:9' || saved === '4:3')) {
        return saved as AspectRatioMode;
      }
    } catch (e) {}

    // Auto-detect mobile portrait games (Bitlife, etc.) so they don't stretch or zoom in
    const lowerName = (meta.name || '').toLowerCase();
    const lowerId = (meta.id || '').toLowerCase();
    if (lowerName.includes('bitlife') || lowerId.includes('bitlife')) {
      return '9:16';
    }

    return 'fill';
  });
  const [showAspectMenu, setShowAspectMenu] = useState(false);

  // Resolution state - Dedicated for 16:9 games
  const [resolution, setResolution] = useState<GameResolution>(() => {
    try {
      const key = `lowteir_res_${meta.id || meta.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const saved = localStorage.getItem(key);
      if (saved && RESOLUTION_PRESETS.some((r) => r.id === saved)) {
        return saved as GameResolution;
      }
    } catch (e) {}
    return 'auto';
  });
  const [showResolutionMenu, setShowResolutionMenu] = useState(false);
  const [hudToast, setHudToast] = useState<string | null>(null);
  const hudToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Scroll toggle state: Persisted per game, allows vertical/horizontal scrolling if game UI overflows
  const [allowScroll, setAllowScroll] = useState<boolean>(() => {
    try {
      const key = `lowteir_scroll_${meta.id || meta.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      return localStorage.getItem(key) === 'true';
    } catch (e) {
      return false;
    }
  });

  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState<{ width: number; height: number }>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight - 44 : 720,
  });

  const blobUrlRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const aspectMenuRef = useRef<HTMLDivElement>(null);
  const resolutionMenuRef = useRef<HTMLDivElement>(null);

  const triggerHudToast = (message: string) => {
    if (hudToastTimeoutRef.current) clearTimeout(hudToastTimeoutRef.current);
    setHudToast(message);
    hudToastTimeoutRef.current = setTimeout(() => {
      setHudToast(null);
    }, 2400);
  };

  const updateIframeScroll = (enabled: boolean) => {
    try {
      if (iframeRef.current?.contentDocument) {
        const doc = iframeRef.current.contentDocument;
        doc.documentElement.style.setProperty('overflow', enabled ? 'auto' : 'hidden', 'important');
        doc.body.style.setProperty('overflow', enabled ? 'auto' : 'hidden', 'important');
        doc.documentElement.style.setProperty('height', enabled ? 'auto' : '100%', 'important');
        doc.body.style.setProperty('height', enabled ? 'auto' : '100%', 'important');
        doc.documentElement.style.setProperty('scrollbar-width', enabled ? 'thin' : 'none', 'important');
        doc.body.style.setProperty('scrollbar-width', enabled ? 'thin' : 'none', 'important');

        let styleTag = doc.getElementById('clean-runtime-scrollbar') as HTMLStyleElement | null;
        if (styleTag) {
          styleTag.textContent = getRuntimeIsolationCSS(enabled);
        } else {
          const newStyle = doc.createElement('style');
          newStyle.id = 'clean-runtime-scrollbar';
          newStyle.textContent = getRuntimeIsolationCSS(enabled);
          doc.head.appendChild(newStyle);
        }
      }
    } catch (e) {}
  };

  const toggleScroll = () => {
    const next = !allowScroll;
    setAllowScroll(next);
    try {
      const key = `lowteir_scroll_${meta.id || meta.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      localStorage.setItem(key, String(next));
    } catch (e) {}

    triggerHudToast(next ? 'Scrolling: ON' : 'Scrolling: OFF');
    updateIframeScroll(next);
  };

  // Keep iframe document scrolling styles synced whenever allowScroll changes
  useEffect(() => {
    updateIframeScroll(allowScroll);
  }, [allowScroll]);

  // Helper to ensure canvas inside iframe stretches fully without letterbox borders
  const syncIframeCanvas = () => {
    try {
      if (iframeRef.current?.contentDocument) {
        const doc = iframeRef.current.contentDocument;
        const canvases = doc.querySelectorAll('canvas');
        canvases.forEach((c) => {
          c.style.setProperty('width', '100%', 'important');
          c.style.setProperty('height', '100%', 'important');
          c.style.setProperty('max-width', '100%', 'important');
          c.style.setProperty('max-height', '100%', 'important');
          c.style.setProperty('object-fit', 'fill', 'important');
          c.style.setProperty('margin', '0', 'important');
          c.style.setProperty('padding', '0', 'important');
        });
      }
    } catch (e) {}
  };

  const handleSelectAspectRatio = (mode: AspectRatioMode) => {
    setAspectRatio(mode);
    setShowAspectMenu(false);
    try {
      const key = `lowteir_aspect_${meta.id || meta.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      localStorage.setItem(key, mode);
    } catch (e) {}

    const label =
      mode === 'fill'
        ? 'Fill Screen (Stretch - No Black Borders)'
        : mode === '16:9'
        ? 'Widescreen (16:9)'
        : mode === '4:3'
        ? 'Classic (4:3)'
        : 'Mobile (9:16)';
    triggerHudToast(`Screen: ${label}`);

    setTimeout(() => {
      syncIframeCanvas();
      window.dispatchEvent(new Event('resize'));
      if (iframeRef.current?.contentWindow) {
        try {
          iframeRef.current.contentWindow.dispatchEvent(new Event('resize'));
          iframeRef.current.contentDocument?.dispatchEvent(new Event('resize'));
        } catch (e) {}
      }
    }, 60);
  };

  const handleSelectResolution = (resId: GameResolution) => {
    setResolution(resId);
    setShowResolutionMenu(false);
    const resPreset = RESOLUTION_PRESETS.find((r) => r.id === resId) || RESOLUTION_PRESETS[0];

    // Resolution scaling activates 16:9 widescreen layout
    if (aspectRatio !== '16:9') {
      setAspectRatio('16:9');
      try {
        const aspectKey = `lowteir_aspect_${meta.id || meta.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        localStorage.setItem(aspectKey, '16:9');
      } catch (e) {}
    }
    try {
      const key = `lowteir_res_${meta.id || meta.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      localStorage.setItem(key, resId);
    } catch (e) {}

    triggerHudToast(`Resolution: ${resPreset.label} (${resPreset.sub}) • 16:9`);

    setTimeout(() => {
      syncIframeCanvas();
      window.dispatchEvent(new Event('resize'));
      if (iframeRef.current?.contentWindow) {
        try {
          iframeRef.current.contentWindow.dispatchEvent(new Event('resize'));
          iframeRef.current.contentDocument?.dispatchEvent(new Event('resize'));
        } catch (e) {}
      }
    }, 60);
  };

  const cycleResolution = () => {
    const currentIndex = RESOLUTION_PRESETS.findIndex((r) => r.id === resolution);
    const nextIndex = (currentIndex + 1) % RESOLUTION_PRESETS.length;
    handleSelectResolution(RESOLUTION_PRESETS[nextIndex].id);
  };

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        showAspectMenu &&
        aspectMenuRef.current &&
        !aspectMenuRef.current.contains(e.target as Node)
      ) {
        setShowAspectMenu(false);
      }
      if (
        showResolutionMenu &&
        resolutionMenuRef.current &&
        !resolutionMenuRef.current.contains(e.target as Node)
      ) {
        setShowResolutionMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAspectMenu, showResolutionMenu]);

  // Track main stage container dimensions for pixel-perfect aspect ratio and resolution calculations
  useEffect(() => {
    if (!stageRef.current) return;
    const updateSize = () => {
      if (stageRef.current) {
        const rect = stageRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setStageSize({ width: rect.width, height: rect.height });
        }
      }
    };
    updateSize();
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect && entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setStageSize({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      }
    });
    observer.observe(stageRef.current);
    window.addEventListener('resize', updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [isFullscreen]);

  // Compute exact pixel bounding box for the active aspect ratio mode
  const getBoxDimensions = () => {
    const availW = stageSize.width || (typeof window !== 'undefined' ? window.innerWidth : 1280);
    const availH = stageSize.height || (typeof window !== 'undefined' ? window.innerHeight - 44 : 720);

    if (aspectRatio === 'fill') {
      return { width: availW, height: availH };
    }

    let targetRatio = 16 / 9;
    if (aspectRatio === '4:3') targetRatio = 4 / 3;
    if (aspectRatio === '9:16') targetRatio = 9 / 16;

    const currentRatio = availW / availH;
    if (currentRatio > targetRatio) {
      const height = availH;
      const width = Math.round(availH * targetRatio);
      return { width, height };
    } else {
      const width = availW;
      const height = Math.round(availW / targetRatio);
      return { width, height };
    }
  };

  // Load and prepare game HTML client-side (no backend required, works on Surge.sh)
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);

    async function loadGame() {
      const parsed = parseGitHubRepoUrl(meta.repo, meta.entryPoint);
      const owner = parsed.owner;
      const repo = parsed.repo;
      const branch = parsed.branch || 'main';
      const entry = parsed.entryPoint || 'index.html';
      const baseHref = parsed.baseHref;

      let rawHtml = '';

      // 1. Try local cache from IndexedDB if downloaded
      try {
        const { getGameFiles } = await import('../utils/cacheManager');
        const cachedFiles = await getGameFiles(meta.id);
        if (cachedFiles) {
          if (cachedFiles.has(entry)) {
            const fileData = cachedFiles.get(entry);
            if (fileData) {
              rawHtml = await fileData.blob.text();
            }
          } else if (parsed.subPath && entry.startsWith(parsed.subPath + '/')) {
            const trimmed = entry.substring(parsed.subPath.length + 1);
            if (cachedFiles.has(trimmed)) {
              const fileData = cachedFiles.get(trimmed);
              if (fileData) {
                rawHtml = await fileData.blob.text();
              }
            }
          }
        }
      } catch (e) {
        // Continue to network fetch
      }

      // 2. Fetch directly from jsDelivr / GitHub (static friendly, CORS enabled)
      if (!rawHtml) {
        const candidates = [
          `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${entry}`,
          `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${entry}`,
          `https://cdn.jsdelivr.net/gh/${owner}/${repo}@main/${entry}`,
          `https://raw.githubusercontent.com/${owner}/${repo}/main/${entry}`,
          `https://cdn.jsdelivr.net/gh/${owner}/${repo}@master/${entry}`,
          `https://raw.githubusercontent.com/${owner}/${repo}/master/${entry}`,
        ];
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          candidates.push(`/api/game-runtime/${owner}/${repo}/${entry}`);
        }

        for (const url of candidates) {
          try {
            const resp = await fetch(url);
            if (resp.ok) {
              rawHtml = await resp.text();
              break;
            }
          } catch (err) {
            // try next candidate
          }
        }
      }

      if (isCancelled) return;

      if (!rawHtml) {
        rawHtml = `<!DOCTYPE html><html><body style="background:#000;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">Unable to load game. Please check your connection.</body></html>`;
      }

      // Process HTML with baseHref, URL constructor patch, and runtime scrollbar styling
      const finalHtml = buildGameRuntimeHTML(rawHtml, baseHref, allowScroll);

      // Create blob URL for the iframe
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
      const blob = new Blob([finalHtml], { type: 'text/html; charset=utf-8' });
      const newUrl = URL.createObjectURL(blob);
      blobUrlRef.current = newUrl;

      setFrameSrc(newUrl);
    }

    loadGame();

    return () => {
      isCancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [meta.repo, meta.entryPoint, meta.id, keySeed]);

  // Clean exit: stops all game execution, blanks iframe, exits fullscreen, and frees audio/worker contexts
  const exitGame = () => {
    if (document.fullscreenElement) {
      try {
        document.exitFullscreen();
      } catch (e) {}
    }
    if (iframeRef.current) {
      try {
        // Disarm unload events inside iframe to avoid null pointer exceptions in game engines
        if (iframeRef.current.contentWindow) {
          iframeRef.current.contentWindow.onbeforeunload = null;
          iframeRef.current.contentWindow.onunload = null;
        }
      } catch (e) {}
      try {
        iframeRef.current.src = 'about:blank';
      } catch (e) {}
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    onBack();
  };

  // Prevent background scrolling while game player is active
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      if (iframeRef.current) {
        try {
          if (iframeRef.current.contentWindow) {
            iframeRef.current.contentWindow.onbeforeunload = null;
            iframeRef.current.contentWindow.onunload = null;
          }
          iframeRef.current.src = 'about:blank';
        } catch (e) {}
      }
    };
  }, []);

  // Keyboard shortcut: Escape exits fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) {
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          }
          setIsFullscreen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isFs);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Broadcast resize to canvas and engine on fullscreen transition
  useEffect(() => {
    const triggerResize = () => {
      window.dispatchEvent(new Event('resize'));
      if (iframeRef.current?.contentWindow) {
        try {
          iframeRef.current.contentWindow.dispatchEvent(new Event('resize'));
        } catch (e) {}
      }
    };

    triggerResize();
    const t1 = setTimeout(triggerResize, 100);
    const t2 = setTimeout(triggerResize, 350);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isFullscreen]);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      const isCurrentlyFullscreen = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );

      if (!isCurrentlyFullscreen) {
        const elem: any = containerRef.current;
        const requestMethod =
          elem.requestFullscreen ||
          elem.webkitRequestFullscreen ||
          elem.mozRequestFullScreen ||
          elem.msRequestFullscreen;

        if (requestMethod) {
          await requestMethod.call(elem);
          setIsFullscreen(true);
        } else {
          setIsFullscreen(true);
        }
      } else {
        const exitMethod: any =
          document.exitFullscreen ||
          (document as any).webkitExitFullscreen ||
          (document as any).mozCancelFullScreen ||
          (document as any).msExitFullscreen;

        if (exitMethod) {
          await exitMethod.call(document);
          setIsFullscreen(false);
        } else {
          setIsFullscreen(false);
        }
      }
    } catch (err) {
      console.warn('Native fullscreen request blocked, using viewport theater mode:', err);
      setIsFullscreen((prev) => !prev);
    }
  };

  const reloadGame = () => {
    setIsLoading(true);
    setKeySeed((k) => k + 1);
  };

  return (
    <div
      ref={containerRef}
      id="game-player-stage"
      className={`bg-black flex flex-col overflow-hidden select-none transition-all duration-150 ${
        isFullscreen
          ? 'fixed inset-0 z-[9999] w-screen h-screen'
          : 'fixed inset-0 z-50 w-full h-full'
      }`}
    >
      {/* Top Controls Bar - Hidden whenever in Fullscreen */}
      {!isFullscreen && (
        <header
          id="player-top-bar"
          className="h-11 bg-black border-b border-[#222222] px-3 sm:px-5 flex items-center justify-between z-40 shrink-0 select-none"
        >
          {/* Left: Exit & Title & Mobile badge */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              id="player-back-to-library-btn"
              onClick={exitGame}
              className="px-2.5 py-1 bg-[#141414] hover:bg-[#222222] text-[#cccccc] hover:text-white border border-[#2a2a2a] rounded text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Exit game and return to library"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-semibold text-white tracking-wide truncate max-w-[160px] sm:max-w-xs md:max-w-md">
                {meta.name}
              </h2>
            </div>
          </div>

          {/* Right: Aspect Ratio Selector, Resolution Switcher (16:9 only), Quick Tools & Fullscreen */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Aspect Ratio Switcher */}
            <div className="relative" ref={aspectMenuRef}>
              <button
                id="player-aspect-ratio-btn"
                onClick={() => setShowAspectMenu((prev) => !prev)}
                className="px-2.5 py-1 text-xs font-medium border border-[#2a2a2a] rounded transition-colors flex items-center gap-1.5 cursor-pointer bg-[#141414] hover:bg-[#222222] text-[#cccccc] hover:text-white"
                title="Change Screen Aspect Ratio (Fill / Mobile 9:16 / Widescreen 16:9 / Classic 4:3)"
              >
                {aspectRatio === '9:16' ? (
                  <Smartphone className="w-3.5 h-3.5 text-[#aaaaaa]" />
                ) : aspectRatio === '16:9' ? (
                  <Monitor className="w-3.5 h-3.5 text-[#aaaaaa]" />
                ) : aspectRatio === '4:3' ? (
                  <Tv className="w-3.5 h-3.5 text-[#aaaaaa]" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5 text-[#aaaaaa]" />
                )}
                <span className="hidden sm:inline">
                  {aspectRatio === '9:16' ? 'Mobile (9:16)' : aspectRatio === '16:9' ? '16:9' : aspectRatio === '4:3' ? '4:3' : 'Fill'}
                </span>
              </button>

              {showAspectMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-[#141414] border border-[#2a2a2a] rounded-lg shadow-2xl py-1.5 z-50 select-none backdrop-blur-md">
                  <div className="px-3 py-1 text-[10px] font-semibold text-[#666666] uppercase tracking-wider">
                    Aspect Ratio
                  </div>
                  {[
                    { id: 'fill', label: 'Fill Screen', desc: 'Stretch to window (Default)', icon: Maximize2 },
                    { id: '9:16', label: 'Mobile (9:16)', desc: 'Phone portrait (BitLife)', icon: Smartphone },
                    { id: '16:9', label: 'Widescreen (16:9)', desc: 'Standard widescreen display', icon: Monitor },
                    { id: '4:3', label: 'Classic (4:3)', desc: 'Retro games & classic arcade', icon: Tv },
                  ].map((mode) => {
                    const IconComponent = mode.icon;
                    const isSelected = aspectRatio === mode.id;
                    return (
                      <button
                        key={mode.id}
                        onClick={() => handleSelectAspectRatio(mode.id as AspectRatioMode)}
                        className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#222222] text-white font-medium'
                            : 'text-[#aaaaaa] hover:text-white hover:bg-[#1a1a1a]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <IconComponent className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-[#777777]'}`} />
                          <div>
                            <div className="leading-tight">{mode.label}</div>
                            <div className="text-[10px] text-[#666666]">{mode.desc}</div>
                          </div>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0 ml-1.5" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Resolution Switcher - ALWAYS next to Aspect Ratio button */}
            <div className="relative" ref={resolutionMenuRef}>
              <button
                id="player-resolution-btn"
                onClick={() => setShowResolutionMenu((prev) => !prev)}
                className="px-2.5 py-1 text-xs font-medium border border-[#2a2a2a] rounded transition-colors flex items-center gap-1.5 cursor-pointer bg-[#141414] hover:bg-[#222222] text-[#cccccc] hover:text-white"
                title="Change Render Resolution (1080p, 720p, 540p, 360p) for 16:9 games"
              >
                <Sliders className="w-3.5 h-3.5 text-[#aaaaaa]" />
                <span className="text-[#777777]">Res:</span>
                <span className="font-medium text-white">{RESOLUTION_PRESETS.find((r) => r.id === resolution)?.label || 'Auto'}</span>
              </button>

              {showResolutionMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-[#141414] border border-[#2a2a2a] rounded-lg shadow-2xl py-1.5 z-50 select-none backdrop-blur-md">
                  <div className="px-3 py-1.5 border-b border-[#222222] mb-1">
                    <div className="flex items-center justify-between text-[10px] font-semibold text-[#888888] uppercase tracking-wider">
                      <span>Render Resolution</span>
                      <span className="text-emerald-400 font-medium normal-case">16:9 Widescreen</span>
                    </div>
                    {aspectRatio !== '16:9' && (
                      <div className="text-[10px] text-amber-400/90 mt-0.5 leading-tight">
                        Selecting switches screen to 16:9 Widescreen
                      </div>
                    )}
                  </div>
                  {RESOLUTION_PRESETS.map((res) => {
                    const isSelected = resolution === res.id;
                    return (
                      <button
                        key={res.id}
                        id={`player-resolution-opt-${res.id}`}
                        onClick={() => handleSelectResolution(res.id)}
                        className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#222222] text-white font-medium'
                            : 'text-[#aaaaaa] hover:text-white hover:bg-[#1a1a1a]'
                        }`}
                      >
                        <div>
                          <div className="font-medium text-white">{res.label}</div>
                          <div className="text-[10px] text-[#777777]">{res.sub}</div>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              id="player-reload-btn"
              onClick={reloadGame}
              className="p-1.5 bg-[#141414] hover:bg-[#222222] text-[#aaaaaa] hover:text-white border border-[#2a2a2a] rounded transition-colors cursor-pointer"
              title="Reload Game"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Scroll Toggle Button - Replaces Open Clean Tab */}
            <button
              id="player-scroll-toggle-btn"
              onClick={toggleScroll}
              className={`p-1.5 border rounded transition-colors cursor-pointer flex items-center justify-center ${
                allowScroll
                  ? 'bg-white/20 text-white border-white/40 shadow-sm'
                  : 'bg-[#141414] hover:bg-[#222222] text-[#aaaaaa] hover:text-white border-[#2a2a2a]'
              }`}
              title={allowScroll ? 'Scrolling: ON (Click to turn OFF)' : 'Scrolling: OFF (Click to turn ON)'}
            >
              <Scroll className="w-3.5 h-3.5" />
            </button>

            <button
              id="player-fullscreen-btn"
              onClick={toggleFullscreen}
              className="p-1.5 bg-[#141414] hover:bg-[#222222] text-[#aaaaaa] hover:text-white border border-[#2a2a2a] rounded transition-colors cursor-pointer"
              title="Enter Fullscreen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>
      )}

      {/* Floating Controls in Fullscreen mode (reveals on hover in top-right) */}
      {isFullscreen && (
        <div className="absolute top-3 right-3 z-50 flex items-center gap-2 transition-opacity opacity-25 hover:opacity-100">
          <button
            id="player-aspect-cycle-fullscreen-btn"
            onClick={() => {
              const next: AspectRatioMode =
                aspectRatio === 'fill' ? '9:16' : aspectRatio === '9:16' ? '16:9' : aspectRatio === '16:9' ? '4:3' : 'fill';
              handleSelectAspectRatio(next);
            }}
            className="px-2.5 py-1.5 bg-black/85 hover:bg-black text-white text-xs font-medium border border-white/20 rounded-full transition-colors cursor-pointer flex items-center gap-1.5 shadow-lg"
            title="Cycle Aspect Ratio (Fill / Mobile 9:16 / 16:9 / 4:3)"
          >
            {aspectRatio === '9:16' ? (
              <Smartphone className="w-3.5 h-3.5 text-white" />
            ) : aspectRatio === '16:9' ? (
              <Monitor className="w-3.5 h-3.5 text-white" />
            ) : aspectRatio === '4:3' ? (
              <Tv className="w-3.5 h-3.5 text-white" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 text-white" />
            )}
            <span>{aspectRatio === '9:16' ? 'Mobile (9:16)' : aspectRatio === '16:9' ? '16:9' : aspectRatio === '4:3' ? '4:3' : 'Fill'}</span>
          </button>

          {/* Resolution button in Fullscreen - always next to Aspect Ratio button */}
          <button
            id="player-resolution-cycle-fullscreen-btn"
            onClick={cycleResolution}
            className="px-2.5 py-1.5 bg-black/85 hover:bg-black text-white text-xs font-medium border border-white/20 rounded-full transition-colors cursor-pointer flex items-center gap-1.5 shadow-lg"
            title="Cycle Resolution (Auto -> 1080p -> 900p -> 720p -> 540p -> 480p -> 360p)"
          >
            <Sliders className="w-3.5 h-3.5 text-white" />
            <span>Res: {RESOLUTION_PRESETS.find((r) => r.id === resolution)?.label || 'Auto'}</span>
          </button>

          {/* Scroll toggle button in Fullscreen */}
          <button
            id="player-scroll-cycle-fullscreen-btn"
            onClick={toggleScroll}
            className={`px-2.5 py-1.5 text-xs font-medium border rounded-full transition-colors cursor-pointer flex items-center gap-1.5 shadow-lg ${
              allowScroll
                ? 'bg-white text-black border-white'
                : 'bg-black/85 hover:bg-black text-white border-white/20'
            }`}
            title={allowScroll ? 'Scrolling: ON (Click to turn OFF)' : 'Scrolling: OFF (Click to turn ON)'}
          >
            <Scroll className="w-3.5 h-3.5" />
            <span>Scroll: {allowScroll ? 'ON' : 'OFF'}</span>
          </button>

          <button
            id="player-exit-game-fullscreen-btn"
            onClick={exitGame}
            className="px-2.5 py-1.5 bg-black/85 hover:bg-black text-white text-xs font-medium border border-white/20 rounded-full transition-colors cursor-pointer flex items-center gap-1 shadow-lg"
            title="Exit Game"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Exit</span>
          </button>
          <button
            id="player-exit-fullscreen-btn"
            onClick={toggleFullscreen}
            className="p-1.5 bg-black/85 hover:bg-black text-white/70 hover:text-white border border-white/20 rounded-full transition-opacity cursor-pointer shadow-lg"
            title="Exit Fullscreen (Esc)"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Game Stage */}
      <div
        ref={stageRef}
        className={`flex-1 w-full min-h-0 relative bg-[#0a0a0a] flex items-center justify-center p-0 ${
          allowScroll ? 'overflow-auto' : 'overflow-hidden'
        }`}
        onClick={() => {
          if (showAspectMenu) setShowAspectMenu(false);
          if (showResolutionMenu) setShowResolutionMenu(false);
        }}
      >
        {/* On-Screen HUD Toast */}
        {hudToast && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-black/90 text-white text-xs font-medium px-4 py-2 rounded-full border border-white/20 shadow-2xl backdrop-blur-md pointer-events-none flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>{hudToast}</span>
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center gap-3 z-30 pointer-events-none transition-opacity duration-300">
            <Loader2 className="w-7 h-7 text-white animate-spin" />
            <div className="text-center">
              <p className="text-xs font-semibold text-white tracking-wide">Loading {meta.name}</p>
              <p className="text-[11px] text-[#777777] mt-0.5">
                {aspectRatio === '9:16'
                  ? 'Calibrating mobile phone viewport (9:16)...'
                  : aspectRatio === '16:9' && resolution !== 'auto'
                  ? `Rendering at ${resolution} resolution...`
                  : 'Running GitHub game build...'}
              </p>
            </div>
          </div>
        )}

        {frameSrc && (() => {
          const { width: boxW, height: boxH } = getBoxDimensions();
          const currentRes = RESOLUTION_PRESETS.find((r) => r.id === resolution) || RESOLUTION_PRESETS[0];
          const isCustomRes = aspectRatio === '16:9' && resolution !== 'auto' && Boolean(currentRes.width && currentRes.height);
          const targetW = currentRes.width || 1920;
          const targetH = currentRes.height || 1080;
          const scaleX = boxW / targetW;
          const scaleY = boxH / targetH;

          return (
            <div
              style={{
                width: `${boxW}px`,
                height: `${boxH}px`,
                maxWidth: '100%',
                maxHeight: '100%',
              }}
              className={`relative flex items-center justify-center transition-all duration-150 ${
                allowScroll ? 'overflow-auto' : 'overflow-hidden'
              } ${
                aspectRatio === 'fill'
                  ? 'w-full h-full'
                  : 'shadow-[0_0_80px_rgba(0,0,0,0.95)] border border-[#222222]/80 rounded-sm'
              }`}
            >
              {isCustomRes ? (
                <div
                  style={{
                    width: `${boxW}px`,
                    height: `${boxH}px`,
                    position: 'relative',
                    overflow: allowScroll ? 'auto' : 'hidden',
                  }}
                >
                  <iframe
                    key={`frame-${keySeed}`}
                    ref={iframeRef}
                    src={frameSrc}
                    title={meta.name}
                    scrolling={allowScroll ? 'yes' : 'no'}
                    onLoad={() => {
                      setIsLoading(false);
                      syncIframeCanvas();
                      updateIframeScroll(allowScroll);
                    }}
                    className={`border-0 outline-none bg-black select-none m-0 p-0 block ${
                      allowScroll ? 'overflow-auto' : 'overflow-hidden'
                    }`}
                    style={{
                      width: `${targetW}px`,
                      height: `${targetH}px`,
                      transform: `scale(${scaleX}, ${scaleY})`,
                      transformOrigin: '0 0',
                      imageRendering: resolution === '360p' || resolution === '480p' ? 'pixelated' : 'auto',
                      overflow: allowScroll ? 'auto' : 'hidden',
                    }}
                    allow="fullscreen; autoplay; gamepad; clipboard-read; clipboard-write"
                  />
                </div>
              ) : (
                <iframe
                  key={`frame-${keySeed}`}
                  ref={iframeRef}
                  src={frameSrc}
                  title={meta.name}
                  scrolling={allowScroll ? 'yes' : 'no'}
                  onLoad={() => {
                    setIsLoading(false);
                    syncIframeCanvas();
                    updateIframeScroll(allowScroll);
                  }}
                  className={`w-full h-full border-0 outline-none bg-black select-none m-0 p-0 block ${
                    allowScroll ? 'overflow-auto' : 'overflow-hidden'
                  }`}
                  style={{
                    width: '100%',
                    height: '100%',
                    overflow: allowScroll ? 'auto' : 'hidden',
                  }}
                  allow="fullscreen; autoplay; gamepad; clipboard-read; clipboard-write"
                />
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
};
