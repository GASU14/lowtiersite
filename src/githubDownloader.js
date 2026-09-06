// LowTierSite - Native GitHub Downloader & Caching Engine
import {
  detectEngine,
  detectEntryPoint,
  parseGitHubRepoUrl,
  saveDownloadedGame,
  slugifyGame,
} from './cacheManager.js';

// Known manifests for instant zero-lag lookup & fallback
const KNOWN_MANIFESTS = {
  'irv77/hd_fnaf/1': {
    branch: 'main',
    files: [
      { path: '1/index.html', size: 11367 },
      { path: '1/favicon.ico', size: 391533 },
      { path: '1/resources/animatronic.png', size: 542000 },
      { path: '1/resources/background.gif', size: 212000 },
      { path: '1/resources/launcher-text.png', size: 104000 },
      { path: '1/resources/office.png', size: 840000 },
      { path: '1/resources/title.png', size: 240000 },
      { path: '1/resources/vignette.png', size: 120000 },
      { path: '1/src/Runtime.js', size: 540000 },
      { path: '1/src/resources.zip.part1', size: 1048576 },
      { path: '1/src/resources.zip.part2', size: 1048576 },
      { path: '1/src/resources.zip.part3', size: 1048576 },
      { path: '1/src/resources.zip.part4', size: 1048576 },
      { path: '1/src/resources.zip.part5', size: 1048576 },
      { path: '1/src/resources.zip.part6', size: 1048576 },
      { path: '1/src/resources.zip.part7', size: 1048576 },
      { path: '1/src/resources.zip.part8', size: 1048576 },
      { path: '1/src/resources.zip.part9', size: 1048576 },
      { path: '1/src/resources.zip.part10', size: 1048576 },
      { path: '1/src/resources.zip.part11', size: 1048576 },
      { path: '1/src/resources.zip.part12', size: 1048576 },
      { path: '1/src/resources.zip.part13', size: 1048576 },
      { path: '1/src/resources.zip.part14', size: 1048576 },
      { path: '1/src/resources.zip.part15', size: 1048576 },
      { path: '1/src/resources.zip.part16', size: 1048576 },
      { path: '1/src/resources.zip.part17', size: 1048576 },
      { path: '1/src/resources.zip.part18', size: 1048576 },
      { path: '1/src/resources.zip.part19', size: 1048576 },
      { path: '1/src/resources.zip.part20', size: 980000 },
    ],
  },
  'webporting/Shift-At-Midnight': {
    branch: 'main',
    files: [
      { path: 'index.html', size: 2858 },
      { path: 'Build/ShiftAtMidnightPort.loader.js', size: 13076 },
      { path: 'Build/ShiftAtMidnightPort.framework.js', size: 401808 },
      { path: 'Build/ShiftAtMidnightPort.wasm.part1', size: 20866662 },
      { path: 'Build/ShiftAtMidnightPort.wasm.part2', size: 12835872 },
      { path: 'Build/ShiftAtMidnightPort.data.part1', size: 20866662 },
      { path: 'Build/ShiftAtMidnightPort.data.part2', size: 20866662 },
      { path: 'Build/ShiftAtMidnightPort.data.part3', size: 20866662 },
      { path: 'Build/ShiftAtMidnightPort.data.part4', size: 20866662 },
      { path: 'Build/ShiftAtMidnightPort.data.part5', size: 19984028 },
      { path: 'StreamingAssets/dialogue.json', size: 18661 },
      { path: 'StreamingAssets/id database.json', size: 5682 },
    ],
  },
  'web-ports/flying-gorilla': {
    branch: 'main',
    files: [
      { path: 'index.html', size: 5411 },
      { path: 'Build/vb.loader.js', size: 20642 },
      { path: 'Build/vb.framework.js', size: 412909 },
      { path: 'Build/vb.wasm.part1', size: 20866662 },
      { path: 'Build/vb.wasm.part2', size: 12689902 },
      { path: 'Build/vb.data.part1', size: 20866662 },
      { path: 'Build/vb.data.part2', size: 19889000 },
      { path: 'TemplateData/style.css', size: 1285 },
    ],
  },
  'web-ports/20-minutes': {
    branch: 'main',
    files: [
      { path: 'index.html', size: 3000 },
      { path: 'Build/20minutes.loader.js', size: 11034 },
      { path: 'Build/20minutes.framework.js', size: 544199 },
      { path: 'Build/20minutes.wasm.part1', size: 20866662 },
      { path: 'Build/20minutes.wasm.part2', size: 5864515 },
      { path: 'Build/20minutes.data.part1', size: 20866662 },
      { path: 'Build/20minutes.data.part2', size: 10052265 },
      { path: 'TemplateData/style.css', size: 1375 },
    ],
  },
  'bitlifefreeonline/bitlife': {
    branch: 'main',
    files: [
      { path: 'index.html', size: 844 },
      { path: 'Build/UnityLoader.js', size: 324823 },
      { path: 'Build/BitLife.json', size: 574 },
      { path: 'Build/BitLife.data.unityweb', size: 14312854 },
      { path: 'Build/BitLife.wasm.code.unityweb', size: 5614320 },
      { path: 'Build/BitLife.wasm.framework.unityweb', size: 75838 },
      { path: 'TemplateData/UnityProgress.js', size: 1258 },
      { path: 'style.css', size: 5912 },
    ],
  },
  'web-ports/yomi-hustle': {
    branch: 'main',
    files: [
      { path: 'index.html', size: 6929 },
      { path: 'index.icon.png', size: 802 },
      { path: 'index.js', size: 350804 },
      { path: 'index.pck', size: 18868128 },
      { path: 'index.wasm', size: 17862218 },
    ],
  },
  'MoltenWolf85/UK-web': {
    branch: 'main',
    files: [
      { path: 'index.html', size: 3200 },
      { path: 'Build/ultrakill.loader.js', size: 42615 },
      { path: 'Build/ultrakill.framework.js.unityweb', size: 401879 },
      { path: 'Build/ultrakill.wasm.unityweb.part1', size: 20866662 },
      { path: 'Build/ultrakill.wasm.unityweb.part2', size: 3503426 },
      { path: 'Build/ultrakill.data.unityweb.part1', size: 20866662 },
      { path: 'Build/ultrakill.data.unityweb.part2', size: 20866662 },
      { path: 'Build/ultrakill.data.unityweb.part3', size: 20866662 },
      { path: 'Build/ultrakill.data.unityweb.part4', size: 10636979 },
      { path: 'TemplateData/style.css', size: 1428 },
    ],
  },
  'sussygamedeveloper/FNAF1': {
    branch: 'main',
    files: [
      { path: 'index.html', size: 2995 },
    ],
  },
  'sussygamedeveloper/FNAF2': {
    branch: 'main',
    files: [
      { path: 'index.html', size: 2939 },
    ],
  },
  'lDEVinux/eaglercraft': {
    branch: 'main',
    files: [
      { path: 'stable-download/web/index.html', size: 5000 },
      { path: 'stable-download/web/classes.js', size: 4500000 },
      { path: 'stable-download/web/assets.epk', size: 11000000 },
    ],
  },
  'jaydengass/pokemon-emerald-oasis': {
    branch: 'main',
    files: [
      { path: 'index.html', size: 1258 },
      { path: 'games/pokemon_emerald.gba', size: 16777216 },
      { path: 'data/loader.js', size: 7594 },
      { path: 'data/emulator.min.js', size: 426343 },
      { path: 'data/emulator.min.css', size: 25630 },
      { path: 'data/gba_bios.bin', size: 16384 },
      { path: 'data/localization/en-us.json', size: 9825 },
      { path: 'data/version.json', size: 126 },
      { path: 'data/cores/mgba-wasm.data', size: 1055616 },
      { path: 'data/cores/mgba-legacy-wasm.data', size: 1054993 },
      { path: 'data/cores/mgba-thread-wasm.data', size: 1116559 },
      { path: 'data/cores/mgba-thread-legacy-wasm.data', size: 1115276 },
      { path: 'data/src/compression.js', size: 6409 },
      { path: 'data/src/emulator.js', size: 341775 },
      { path: 'data/src/gamemanager.js', size: 19048 },
      { path: 'data/src/gamepad.js', size: 6054 },
      { path: 'data/src/nipplejs.js', size: 20259 },
      { path: 'data/src/shaders.js', size: 139565 },
      { path: 'data/src/socket.io.min.js', size: 46831 },
      { path: 'data/src/storage.js', size: 4600 },
    ],
  },
  'genizy/web-port/undertale-yellow': {
    branch: 'main',
    files: [
      { path: 'undertale-yellow/favicon.png', size: 3723 },
      { path: 'undertale-yellow/index.html', size: 11265 },
      { path: 'undertale-yellow/index.js', size: 18351 },
      { path: 'undertale-yellow/runner.data', size: 15643056 },
      { path: 'undertale-yellow/runner.js', size: 368249 },
      { path: 'undertale-yellow/runner.wasm', size: 4635241 },
      { path: 'undertale-yellow/game.unx.part1', size: 20724642 },
      { path: 'undertale-yellow/game.unx.part2', size: 20724642 },
      { path: 'undertale-yellow/game.unx.part3', size: 20724642 },
      { path: 'undertale-yellow/game.unx.part4', size: 20724642 },
      { path: 'undertale-yellow/game.unx.part5', size: 20724642 },
      { path: 'undertale-yellow/game.unx.part6', size: 20724642 },
      { path: 'undertale-yellow/game.unx.part7', size: 20724642 },
      { path: 'undertale-yellow/game.unx.part8', size: 20724642 },
      { path: 'undertale-yellow/game.unx.part9', size: 20724642 },
      { path: 'undertale-yellow/game.unx.part10', size: 20724642 },
      { path: 'undertale-yellow/game.unx.part11', size: 20724642 },
      { path: 'undertale-yellow/game.unx.part12', size: 20724631 },
    ],
  },
  'genizy/web-port/people-playground': {
    branch: 'main',
    files: [
      { path: 'people-playground/index.html', size: 5776 },
      { path: 'people-playground/Build/PPG.loader.js', size: 648295 },
      { path: 'people-playground/Build/PPG.framework.js', size: 455464 },
      { path: 'people-playground/Build/PPG.wasm.part1', size: 16957061 },
      { path: 'people-playground/Build/PPG.wasm.part2', size: 16957061 },
      { path: 'people-playground/Build/PPG.wasm.part3', size: 16957061 },
      { path: 'people-playground/Build/PPG.data.part1', size: 18814925 },
      { path: 'people-playground/Build/PPG.data.part2', size: 18814925 },
      { path: 'people-playground/Build/PPG.data.part3', size: 18814925 },
      { path: 'people-playground/Build/PPG.data.part4', size: 18814925 },
      { path: 'people-playground/Build/PPG.data.part5', size: 18814925 },
      { path: 'people-playground/Build/PPG.data.part6', size: 18814923 },
      { path: 'people-playground/TemplateData/style.css', size: 1428 },
      { path: 'people-playground/TemplateData/favicon.ico', size: 2305 },
    ],
  },
  'genizy/web-port/baldi-plus': {
    branch: 'main',
    files: [
      { path: 'baldi-plus/index.html', size: 5981 },
      { path: 'baldi-plus/Build/BaldiPlusNew.loader.js', size: 12460 },
      { path: 'baldi-plus/Build/BaldiPlusNew.framework.js', size: 448398 },
      { path: 'baldi-plus/Build/BaldiPlusNew.wasm.part1', size: 20866662 },
      { path: 'baldi-plus/Build/BaldiPlusNew.wasm.part2', size: 20132707 },
      { path: 'baldi-plus/Build/BaldiPlusNew.data.part1', size: 20866662 },
      { path: 'baldi-plus/Build/BaldiPlusNew.data.part2', size: 20866662 },
      { path: 'baldi-plus/Build/BaldiPlusNew.data.part3', size: 20866662 },
      { path: 'baldi-plus/Build/BaldiPlusNew.data.part4', size: 20866662 },
      { path: 'baldi-plus/Build/BaldiPlusNew.data.part5', size: 44699 },
      { path: 'baldi-plus/TemplateData/style.css', size: 823 },
      { path: 'baldi-plus/TemplateData/favicon.ico', size: 2305 },
    ],
  },
};

function isRuntimeFile(filePath) {
  const p = (filePath || '').toLowerCase();
  if (
    p.startsWith('.git') ||
    p.startsWith('.github') ||
    p.startsWith('.vscode') ||
    p.includes('readme') ||
    p.endsWith('.md') ||
    p.endsWith('.txt') ||
    p.endsWith('.gitignore') ||
    p.endsWith('.gitattributes') ||
    p.endsWith('.cs')
  ) {
    return false;
  }
  return true;
}

export function getFileMime(filePath) {
  const p = (filePath || '').toLowerCase();
  if (p.endsWith('.html') || p.endsWith('.htm')) return 'text/html';
  if (p.endsWith('.js')) return 'application/javascript';
  if (p.endsWith('.wasm') || p.includes('.wasm.part')) return 'application/wasm';
  if (p.endsWith('.json')) return 'application/json';
  if (p.endsWith('.css')) return 'text/css';
  if (p.endsWith('.png')) return 'image/png';
  if (p.endsWith('.jpg') || p.endsWith('.jpeg')) return 'image/jpeg';
  if (p.endsWith('.svg')) return 'image/svg+xml';
  if (p.endsWith('.ico')) return 'image/x-icon';
  if (p.endsWith('.mp3')) return 'audio/mpeg';
  if (p.endsWith('.ogg')) return 'audio/ogg';
  if (p.endsWith('.wav')) return 'audio/wav';
  return 'application/octet-stream';
}

export async function fetchRepoManifest(repoUrl) {
  const parsed = parseGitHubRepoUrl(repoUrl);
  if (!parsed || !parsed.owner || !parsed.repo) {
    throw new Error('Invalid GitHub repository URL');
  }

  const { owner, repo, branch: defaultBranch, subPath } = parsed;
  const repoKey = subPath ? `${owner}/${repo}/${subPath}` : `${owner}/${repo}`;

  if (KNOWN_MANIFESTS[repoKey]) {
    return KNOWN_MANIFESTS[repoKey];
  }

  // Try server API first if running with backend
  try {
    const apiResp = await fetch(`/api/repo-tree?owner=${owner}&repo=${repo}&branch=${defaultBranch}`);
    if (apiResp.ok) {
      const data = await apiResp.json();
      if (data.tree && Array.isArray(data.tree)) {
        let treeItems = data.tree.filter((item) => item.type === 'blob');
        if (subPath) {
          const prefix = subPath.replace(/^\/+|\/+$/g, '') + '/';
          treeItems = treeItems.filter((item) => item.path.startsWith(prefix));
        }
        const runtimeFiles = treeItems
          .filter((item) => isRuntimeFile(item.path))
          .map((item) => ({ path: item.path, size: item.size || 1024 }));
        if (runtimeFiles.length > 0) {
          return { branch: data.branch || defaultBranch, files: runtimeFiles };
        }
      }
    }
  } catch (e) {
    // continue to direct GitHub API
  }

  // Direct GitHub API tree query
  for (const branch of [defaultBranch, 'main', 'master']) {
    try {
      const resp = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
        { headers: { Accept: 'application/vnd.github.v3+json' } }
      );
      if (resp.ok) {
        const json = await resp.json();
        if (json.tree) {
          let treeItems = json.tree.filter((item) => item.type === 'blob');
          if (subPath) {
            const prefix = subPath.replace(/^\/+|\/+$/g, '') + '/';
            treeItems = treeItems.filter((item) => item.path.startsWith(prefix));
          }
          const runtimeFiles = treeItems
            .filter((item) => isRuntimeFile(item.path))
            .map((item) => ({ path: item.path, size: item.size || 1024 }));
          if (runtimeFiles.length > 0) {
            return { branch, files: runtimeFiles };
          }
        }
      }
    } catch (err) {
      // continue
    }
  }

  if (KNOWN_MANIFESTS[repoKey]) {
    return KNOWN_MANIFESTS[repoKey];
  }

  throw new Error(
    `Unable to inspect repository ${repoKey}. The repository may be private or rate-limited.`
  );
}

async function downloadFileContent(
  owner,
  repo,
  branch,
  filePath,
  fileSize = 0,
  onByteProgress,
  abortSignal
) {
  const cleanPath = filePath.replace(/^\/+/, '');
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encodeURI(cleanPath)}`;
  const cdnUrl = `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${encodeURI(cleanPath)}`;

  const isLargeOrBinary =
    fileSize >= 18 * 1024 * 1024 ||
    /\.(part\d+|data|wasm|unx|gba|unityweb)$/i.test(cleanPath);

  const urlsToTry = isLargeOrBinary ? [rawUrl, cdnUrl] : [cdnUrl, rawUrl];

  for (let i = 0; i < urlsToTry.length; i++) {
    const url = urlsToTry[i];
    if (abortSignal && abortSignal.aborted) {
      throw new Error('Download cancelled');
    }

    try {
      const isCdn = url.includes('jsdelivr.net');
      let fetchSignal = abortSignal;
      let timeoutId = null;

      if (isCdn) {
        const timeoutCtrl = new AbortController();
        if (abortSignal) {
          abortSignal.addEventListener('abort', () => timeoutCtrl.abort(), { once: true });
        }
        timeoutId = setTimeout(() => timeoutCtrl.abort(), 5000);
        fetchSignal = timeoutCtrl.signal;
      }

      const response = await fetch(url, { signal: fetchSignal });
      if (timeoutId) clearTimeout(timeoutId);

      if (response.ok) {
        const mime = getFileMime(cleanPath);

        if (fileSize > 0 && fileSize < 1024 * 1024) {
          const blob = await response.blob();
          if (onByteProgress) onByteProgress(blob.size);
          return blob;
        }

        if (response.body && onByteProgress) {
          const reader = response.body.getReader();
          const chunks = [];
          while (true) {
            if (abortSignal && abortSignal.aborted) {
              reader.cancel();
              throw new Error('Download cancelled');
            }
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
              onByteProgress(value.length);
            }
          }
          return new Blob(chunks, { type: mime });
        } else {
          const blob = await response.blob();
          if (onByteProgress) onByteProgress(blob.size);
          return blob;
        }
      }
    } catch (e) {
      if (abortSignal && abortSignal.aborted) {
        throw new Error('Download cancelled');
      }
    }
  }

  // Quick fallback try on rawUrl
  try {
    const fallbackResponse = await fetch(rawUrl, { signal: abortSignal });
    if (fallbackResponse.ok) {
      const blob = await fallbackResponse.blob();
      if (onByteProgress) onByteProgress(blob.size);
      return blob;
    }
  } catch (err) {
    if (abortSignal && abortSignal.aborted) throw new Error('Download cancelled');
  }

  throw new Error(`Failed to download: ${cleanPath}`);
}

export async function downloadGameToCache(gameName, repoUrl, onProgress, abortSignal) {
  const gameId = slugifyGame(gameName);
  const parsed = parseGitHubRepoUrl(repoUrl);
  if (!parsed) {
    throw new Error('Invalid GitHub URL');
  }

  onProgress({
    phase: 'inspecting',
    currentFile: 'Fetching repository manifest...',
    filesDone: 0,
    totalFiles: 0,
    bytesDownloaded: 0,
    totalBytes: 0,
    percentage: 5,
  });

  const { branch, files } = await fetchRepoManifest(repoUrl);
  if (!files || files.length === 0) {
    throw new Error('No playable web assets found in repository');
  }

  const totalBytesExpected = files.reduce((acc, f) => acc + f.size, 0);
  const downloadedFilesMap = new Map();

  let totalBytesDownloaded = 0;
  let filesCompleted = 0;
  let lastProgressEmit = 0;

  const emitProgress = (currentFilePath, force = false) => {
    const now = performance.now();
    if (!force && now - lastProgressEmit < 50) return;
    lastProgressEmit = now;

    onProgress({
      phase: 'downloading',
      currentFile: currentFilePath,
      filesDone: filesCompleted,
      totalFiles: files.length,
      bytesDownloaded: totalBytesDownloaded,
      totalBytes: totalBytesExpected,
      percentage: Math.min(
        92,
        Math.round(10 + (totalBytesDownloaded / Math.max(1, totalBytesExpected)) * 82)
      ),
    });
  };

  emitProgress(files[0]?.path || 'Starting download...', true);

  const averageSize = totalBytesExpected / Math.max(1, files.length);
  const concurrency = averageSize > 12 * 1024 * 1024 ? 4 : (files.length > 50 ? 8 : 6);
  const queue = [...files];

  async function worker() {
    while (queue.length > 0) {
      if (abortSignal && abortSignal.aborted) {
        throw new Error('Download cancelled');
      }

      const file = queue.shift();
      if (!file) break;

      emitProgress(file.path);

      let fileLoadedBytes = 0;
      const blob = await downloadFileContent(
        parsed.owner,
        parsed.repo,
        branch,
        file.path,
        file.size,
        (delta) => {
          fileLoadedBytes += delta;
          totalBytesDownloaded += delta;
          emitProgress(file.path);
        },
        abortSignal
      );

      downloadedFilesMap.set(file.path, {
        blob,
        mimeType: getFileMime(file.path),
      });

      if (parsed.subPath && file.path.startsWith(parsed.subPath + '/')) {
        const stripped = file.path.substring(parsed.subPath.length + 1);
        downloadedFilesMap.set(stripped, {
          blob,
          mimeType: getFileMime(file.path),
        });
      }

      if (file.path === 'games/pokemon_emerald.gba') {
        downloadedFilesMap.set('games/Pokemon_Emerald.gba', {
          blob,
          mimeType: getFileMime(file.path),
        });
      } else if (file.path === 'data/localization/en-us.json') {
        downloadedFilesMap.set('data/localization/en-US.json', {
          blob,
          mimeType: getFileMime(file.path),
        });
      }

      filesCompleted++;
      emitProgress(file.path, true);
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  onProgress({
    phase: 'caching',
    currentFile: 'Saving to 30-day browser cache...',
    filesDone: filesCompleted,
    totalFiles: files.length,
    bytesDownloaded: totalBytesDownloaded,
    totalBytes: totalBytesExpected,
    percentage: 95,
  });

  const filePaths = Array.from(downloadedFilesMap.keys());
  const entryPoint = parsed.entryPoint || detectEntryPoint(filePaths);
  const engine = detectEngine(filePaths);

  const cachedAt = Date.now();
  const expiresAt = cachedAt + 30 * 24 * 60 * 60 * 1000;

  const meta = {
    id: gameId,
    name: gameName,
    repo: repoUrl,
    cachedAt,
    expiresAt,
    totalBytes: totalBytesDownloaded,
    filesCount: downloadedFilesMap.size,
    entryPoint,
    engine,
  };

  await saveDownloadedGame(gameId, meta, downloadedFilesMap);

  onProgress({
    phase: 'complete',
    currentFile: 'Download complete & cached for 30 days.',
    filesDone: files.length,
    totalFiles: files.length,
    bytesDownloaded: totalBytesDownloaded,
    totalBytes: totalBytesDownloaded,
    percentage: 100,
  });

  return meta;
}
