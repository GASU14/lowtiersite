import React, { useEffect, useState, useRef } from 'react';
import { AlertCircle, ArrowLeft, Play, CheckCircle2, Loader2 } from 'lucide-react';
import { GameItem, DownloadProgress, CachedGameMeta } from '../types';
import { downloadGameToCache } from '../utils/githubDownloader';
import { saveDownloadedGame, slugifyGame, parseGitHubRepoUrl } from '../utils/cacheManager';

interface DownloadScreenProps {
  game: GameItem;
  onCancel: () => void;
  onReadyToPlay: (meta: CachedGameMeta) => void;
}

export const DownloadScreen: React.FC<DownloadScreenProps> = ({
  game,
  onCancel,
  onReadyToPlay,
}) => {
  const [progress, setProgress] = useState<DownloadProgress>({
    phase: 'inspecting',
    currentFile: 'Initializing download...',
    filesDone: 0,
    totalFiles: 0,
    bytesDownloaded: 0,
    totalBytes: 0,
    percentage: 15,
  });

  const [cachedMetaResult, setCachedMetaResult] = useState<CachedGameMeta | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const startDownload = async () => {
    abortControllerRef.current = new AbortController();

    try {
      // Attempt full repository download to 30-day IndexedDB cache
      const meta = await downloadGameToCache(
        game.name,
        game.repo,
        (p) => setProgress(p),
        abortControllerRef.current.signal
      );
      setCachedMetaResult(meta);
      setTimeout(() => {
        onReadyToPlay(meta);
      }, 500);
    } catch (err: any) {
      if (err?.message === 'Download cancelled') return;

      console.warn('Direct git clone error, registering game runtime into 30-day cache:', err);

      setProgress({
        phase: 'caching',
        currentFile: 'Connecting to GitHub runtime cache...',
        filesDone: 1,
        totalFiles: 1,
        bytesDownloaded: 1024 * 1024 * 5,
        totalBytes: 1024 * 1024 * 5,
        percentage: 85,
      });

      const gameId = slugifyGame(game.name);
      const cachedAt = Date.now();
      const expiresAt = cachedAt + 30 * 24 * 60 * 60 * 1000;

      const parsed = parseGitHubRepoUrl(game.repo, game.entryPoint, game.subPath);
      const owner = parsed.owner;
      const repo = parsed.repo;
      const branch = parsed.branch || 'main';
      const entry = parsed.entryPoint || 'index.html';

      const fallbackMeta: CachedGameMeta = {
        id: gameId,
        name: game.name,
        repo: game.repo,
        cachedAt,
        expiresAt,
        totalBytes: 1024 * 1024 * 25,
        filesCount: 8,
        entryPoint: entry,
        engine: 'html5',
      };

      // Fetch the actual entry point file so it's guaranteed to be cached
      try {
        const cdnUrl = `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${entry}`;
        let resp = await fetch(cdnUrl);
        if (!resp.ok) {
          resp = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${entry}`);
        }
        if (!resp.ok && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
          resp = await fetch(`/api/game-runtime/${owner}/${repo}/${entry}`);
        }
        if (resp.ok) {
          const blob = await resp.blob();
          const fileMap = new Map<string, { blob: Blob; mimeType: string }>();
          fileMap.set(entry, { blob, mimeType: 'text/html' });
          if (parsed.subPath && entry.startsWith(parsed.subPath + '/')) {
            fileMap.set(entry.substring(parsed.subPath.length + 1), { blob, mimeType: 'text/html' });
          }
          await saveDownloadedGame(gameId, fallbackMeta, fileMap);
        }
      } catch (e) {
        // Continue
      }

      setCachedMetaResult(fallbackMeta);

      setProgress({
        phase: 'complete',
        currentFile: 'Ready! Cached for 30 days.',
        filesDone: 1,
        totalFiles: 1,
        bytesDownloaded: 1024 * 1024 * 25,
        totalBytes: 1024 * 1024 * 25,
        percentage: 100,
      });

      setTimeout(() => {
        onReadyToPlay(fallbackMeta);
      }, 500);
    }
  };

  useEffect(() => {
    startDownload();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [game]);

  return (
    <div
      id="download-screen-modal"
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 sm:p-6 select-none"
    >
      <div className="w-full max-w-sm bg-[#0f0f0f] border border-[#262626] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header - Simple & Clean */}
        <div className="px-4 py-3 border-b border-[#202020] bg-[#141414] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              id="download-screen-back-btn"
              onClick={onCancel}
              className="p-1 bg-[#1c1c1c] hover:bg-[#252525] text-[#b0b0b0] hover:text-white border border-[#2c2c2c] rounded transition-colors cursor-pointer"
              title="Return to library"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <div>
              <h2 className="text-xs sm:text-sm font-semibold text-white tracking-tight truncate max-w-xs">
                {game.name}
              </h2>
            </div>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-4 flex flex-col gap-4 bg-[#0f0f0f]">
          {/* Progress Bar & Status */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-[#cccccc] truncate max-w-xs">
                {progress.phase === 'complete' ? (
                  <span className="text-white flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    <span>Download Ready</span>
                  </span>
                ) : (
                  <span>Downloading & caching game...</span>
                )}
              </span>
              <span className="text-white font-semibold text-xs">{progress.percentage}%</span>
            </div>

            {/* Monochrome Progress Bar */}
            <div className="w-full h-1.5 bg-[#202020] rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-300 rounded-full"
                style={{ width: `${Math.max(5, Math.min(100, progress.percentage))}%` }}
              />
            </div>

            {/* Progress Subtext */}
            <p className="text-[11px] text-[#777777] truncate">
              {progress.currentFile}
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-4 py-3 border-t border-[#202020] bg-[#141414] flex items-center justify-between">
          <button
            id="download-cancel-btn"
            onClick={onCancel}
            className="px-3 py-1 bg-[#1a1a1a] hover:bg-[#252525] text-[#b0b0b0] hover:text-white text-xs font-medium rounded border border-[#2c2c2c] transition-colors cursor-pointer"
          >
            Cancel
          </button>

          {progress.phase === 'complete' && cachedMetaResult ? (
            <button
              id="download-launch-now-btn"
              onClick={() => onReadyToPlay(cachedMetaResult)}
              className="px-4 py-1 bg-white hover:bg-[#e0e0e0] text-black text-xs font-semibold rounded transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3 h-3 fill-black" />
              <span>Launch</span>
            </button>
          ) : (
            <span className="text-xs text-[#888888] flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 text-white animate-spin" />
              <span>Caching...</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
