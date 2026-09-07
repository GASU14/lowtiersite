import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory cache for GitHub trees to prevent hitting rate limits
const treeCache = new Map<string, { timestamp: number; data: any }>();

// Parse GitHub repo URL into owner, repo, default branch
function parseRepoUrl(url: string) {
  const clean = url.replace(/\.git$/, '').trim();
  const match = clean.match(/github\.com\/([^\/]+)\/([^\/]+)/i);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

// API: list games
app.get('/api/games', (req, res) => {
  try {
    const metaPath = path.join(process.cwd(), 'GameMetadata.json');
    if (fs.existsSync(metaPath)) {
      const data = fs.readFileSync(metaPath, 'utf8');
      return res.json(JSON.parse(data));
    }
    return res.json([]);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read metadata' });
  }
});

// API: get repo tree
app.get('/api/repo-tree', async (req, res) => {
  const { owner, repo, branch = 'main' } = req.query as { owner?: string; repo?: string; branch?: string };
  if (!owner || !repo) {
    return res.status(400).json({ error: 'Missing owner or repo query params' });
  }

  const cacheKey = `${owner}/${repo}/${branch}`;
  const cached = treeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 1000 * 60 * 60) {
    return res.json(cached.data);
  }

  // Try fetching git tree from GitHub API
  try {
    const branchesToTry = [branch, 'main', 'master'];
    let treeData: any = null;
    let successfulBranch = branch;

    for (const b of branchesToTry) {
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${b}?recursive=1`;
      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'LowTeirSite-GameLoader/1.0',
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (response.ok) {
        const json = await response.json();
        treeData = json;
        successfulBranch = b;
        break;
      }
    }

    if (treeData && treeData.tree) {
      const result = {
        branch: successfulBranch,
        tree: treeData.tree.map((item: any) => ({
          path: item.path,
          type: item.type, // 'blob' or 'tree'
          size: item.size || 0,
          sha: item.sha,
        })),
      };
      treeCache.set(cacheKey, { timestamp: Date.now(), data: result });
      return res.json(result);
    }

    // Fallback: If GitHub API has rate limit or returns 403/404, return partial or error
    return res.status(502).json({
      error: 'GitHub tree unavailable or rate limited',
      fallback: true,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to query GitHub tree' });
  }
});

function getMime(filePath: string): string {
  const p = filePath.split('?')[0].toLowerCase();
  if (p.endsWith('.html') || p.endsWith('.htm')) return 'text/html; charset=utf-8';
  if (p.endsWith('.js') || p.endsWith('.javascript')) return 'application/javascript; charset=utf-8';
  if (p.endsWith('.wasm') || p.includes('.wasm.part')) return 'application/wasm';
  if (p.endsWith('.json')) return 'application/json; charset=utf-8';
  if (p.endsWith('.css')) return 'text/css; charset=utf-8';
  if (p.endsWith('.png')) return 'image/png';
  if (p.endsWith('.jpg') || p.endsWith('.jpeg')) return 'image/jpeg';
  if (p.endsWith('.svg')) return 'image/svg+xml';
  if (p.endsWith('.ico')) return 'image/x-icon';
  if (p.endsWith('.mp3')) return 'audio/mpeg';
  if (p.endsWith('.ogg')) return 'audio/ogg';
  if (p.endsWith('.wav')) return 'audio/wav';
  if (p.endsWith('.unityweb')) return 'application/octet-stream';
  if (p.includes('.data') || p.endsWith('.pck') || p.endsWith('.cch')) return 'application/octet-stream';
  return 'application/octet-stream';
}

// API: Direct Game Runtime Server (runs real GitHub web games with all assets)
app.get(['/api/game-runtime/:owner/:repo', '/api/game-runtime/:owner/:repo/*'], async (req, res) => {
  const params = req.params as Record<string, string>;
  let owner = params.owner || '';
  let repo = params.repo || '';
  let subPath = (req.params[0] || '').replace(/^\/+/, '');

  // Handle known aliases
  if (repo === 'ULTRAKILL' && owner === 'teker821') {
    owner = 'MoltenWolf85';
    repo = 'UK-web';
  } else if (repo.toLowerCase().includes('hustle')) {
    owner = 'web-ports';
    repo = 'yomi-hustle';
  }

  // Handle default entry point
  if (!subPath || subPath === '') {
    if (repo.toLowerCase().includes('eaglercraft')) {
      subPath = 'stable-download/web/index.html';
    } else {
      subPath = 'index.html';
    }
  }

  const mime = getMime(subPath);

  // Check local cache on disk first
  const cacheDir = path.join(process.cwd(), '.game-cache', owner, repo);
  const cacheFilePath = path.join(cacheDir, ...subPath.split('/'));

  function injectFullscreenCSS(rawHtml: string): string {
    const fullscreenStyle = `
<style id="clean-zero-scrollbar">
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    overflow: hidden !important;
    background-color: #000 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }
  * {
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
  }
  *::-webkit-scrollbar {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
  }
  /* Game containers: Unity, Godot, WebGL wrappers */
  #unity-container, #game-container, #gameContainer, .webgl-content {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    margin: 0 !important;
    padding: 0 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: #000 !important;
    z-index: 1 !important;
  }
  /* Game Canvas: scales up responsively to fill viewport preserving aspect ratio */
  #unity-canvas, #canvas, #MMFCanvas, canvas {
    width: 100% !important;
    height: 100% !important;
    max-width: 100vw !important;
    max-height: 100vh !important;
    object-fit: contain !important;
    display: block !important;
    margin: auto !important;
    background: #000 !important;
  }
  /* Keep Unity loading progress bar centered */
  #unity-loading-bar {
    position: absolute !important;
    left: 50% !important;
    top: 50% !important;
    transform: translate(-50%, -50%) !important;
    z-index: 10 !important;
  }
</style>
<script id="clean-fullscreen-helper">
  (function() {
    function fixFullscreenCanvases() {
      var canvases = document.querySelectorAll('canvas');
      for (var i = 0; i < canvases.length; i++) {
        var c = canvases[i];
        c.style.setProperty('width', '100%', 'important');
        c.style.setProperty('height', '100%', 'important');
        c.style.setProperty('max-width', '100vw', 'important');
        c.style.setProperty('max-height', '100vh', 'important');
        c.style.setProperty('object-fit', 'contain', 'important');
        if (c.parentElement && c.parentElement !== document.body && c.parentElement.id !== 'unity-loading-bar') {
          c.parentElement.style.setProperty('width', '100vw', 'important');
          c.parentElement.style.setProperty('height', '100vh', 'important');
          c.parentElement.style.setProperty('position', 'fixed', 'important');
          c.parentElement.style.setProperty('top', '0', 'important');
          c.parentElement.style.setProperty('left', '0', 'important');
          c.parentElement.style.setProperty('display', 'flex', 'important');
          c.parentElement.style.setProperty('align-items', 'center', 'important');
          c.parentElement.style.setProperty('justify-content', 'center', 'important');
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

    let clean = rawHtml.replace(/<style id="clean-zero-scrollbar">[\s\S]*?<\/style>/g, '');
    clean = clean.replace(/<script id="clean-fullscreen-helper">[\s\S]*?<\/script>/g, '');

    if (clean.includes('</head>')) {
      return clean.replace('</head>', `${fullscreenStyle}</head>`);
    }
    return `${fullscreenStyle}${clean}`;
  }

  if (fs.existsSync(cacheFilePath)) {
    try {
      const stats = fs.statSync(cacheFilePath);
      if (stats.isFile()) {
        res.setHeader('Content-Type', mime);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
        res.setHeader('Cache-Control', 'public, max-age=2592000');

        if (mime.includes('text/html') || subPath.endsWith('.html')) {
          const html = fs.readFileSync(cacheFilePath, 'utf8');
          return res.send(injectFullscreenCSS(html));
        }
        return fs.createReadStream(cacheFilePath).pipe(res);
      }
    } catch (e) {
      // Continue to fetch if disk read fails
    }
  }

  // Candidates to fetch upstream
  const branches = ['main', 'master'];
  let fetchedBuffer: Buffer | null = null;

  for (const branch of branches) {
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encodeURI(subPath)}`;
    const cdnUrl = `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${encodeURI(subPath)}`;

    for (const url of [rawUrl, cdnUrl]) {
      try {
        const resp = await fetch(url, {
          headers: { 'User-Agent': 'LowTeirSite-GameLoader/1.0' },
        });
        if (resp.ok) {
          fetchedBuffer = Buffer.from(await resp.arrayBuffer());
          break;
        }
      } catch (err) {
        // try next
      }
    }
    if (fetchedBuffer) break;
  }

  if (!fetchedBuffer) {
    return res.status(404).send(`Asset not found in repo: ${owner}/${repo}/${subPath}`);
  }

  // Save to disk cache asynchronously
  try {
    const parentDir = path.dirname(cacheFilePath);
    fs.mkdirSync(parentDir, { recursive: true });
    fs.writeFileSync(cacheFilePath, fetchedBuffer);
  } catch (err) {
    // Non-critical cache write error
  }

  res.setHeader('Content-Type', mime);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cache-Control', 'public, max-age=2592000');

  if (mime.includes('text/html') || subPath.endsWith('.html')) {
    const html = fetchedBuffer.toString('utf8');
    return res.send(injectFullscreenCSS(html));
  }

  return res.send(fetchedBuffer);
});

// API: Fallback redirect by game slug
app.get('/api/game-runtime-fallback', (req, res) => {
  const { gameId, path: subPath } = req.query as { gameId?: string; path?: string };
  try {
    const metaPath = path.join(process.cwd(), 'GameMetadata.json');
    if (fs.existsSync(metaPath)) {
      const list = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      const found = list.find((g: any) =>
        g.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') === gameId
      );
      if (found) {
        const cleanRepo = found.repo.replace(/\.git$/, '').trim();
        const match = cleanRepo.match(/github\.com\/([^\/]+)\/([^\/]+)/i);
        if (match) {
          const target = `/api/game-runtime/${match[1]}/${match[2]}/${subPath || 'index.html'}`;
          return res.redirect(target);
        }
      }
    }
  } catch (err) {
    // ignore
  }
  return res.status(404).send('Game fallback not found');
});

// Route for standalone download launcher
app.get(['/index2', '/index2.html', '/download', '/download.html'], (req, res) => {
  const distFile = path.join(process.cwd(), 'dist', 'index2.html');
  const rootFile = path.join(process.cwd(), 'index2.html');
  if (process.env.NODE_ENV === 'production' && fs.existsSync(distFile)) {
    return res.sendFile(distFile);
  }
  return res.sendFile(rootFile);
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LowTeirSite server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
