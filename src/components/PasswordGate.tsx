import React, { useState } from 'react';

interface PasswordGateProps {
  onUnlock: () => void;
}

const AUTH_HASH = '83fde3b722e0824d7959a188358167420ccdfdc6a4cbf3b06cfbdc73323f1ea9';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function sha256(message: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      console.warn('Web Crypto SHA-256 failed, falling back to JS implementation', e);
    }
  }

  // Pure JavaScript SHA-256 fallback
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i = 0, j = 0;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = message[lengthProperty] * 8;

  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, number> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  const cleanHash = hash.slice(0, 8);

  for (i = 0; i < message[lengthProperty]; i++) {
    j = message.charCodeAt(i);
    words[i >> 2] |= j << ((3 - (i % 4)) * 8);
  }

  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  for (j = 0; j < words[lengthProperty]; j += 16) {
    const w = words.slice(j, j + 16);
    const oldHash = cleanHash.slice(0, 8);

    for (i = 0; i < 64; i++) {
      if (i >= 16) {
        const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }

      const s1 = rightRotate(cleanHash[4], 6) ^ rightRotate(cleanHash[4], 11) ^ rightRotate(cleanHash[4], 25);
      const ch = (cleanHash[4] & cleanHash[5]) ^ (~cleanHash[4] & cleanHash[6]);
      const temp1 = (cleanHash[7] + s1 + ch + k[i] + (w[i] | 0)) | 0;
      const s0 = rightRotate(cleanHash[0], 2) ^ rightRotate(cleanHash[0], 13) ^ rightRotate(cleanHash[0], 22);
      const maj = (cleanHash[0] & cleanHash[1]) ^ (cleanHash[0] & cleanHash[2]) ^ (cleanHash[1] & cleanHash[2]);
      const temp2 = (s0 + maj) | 0;

      cleanHash[7] = cleanHash[6];
      cleanHash[6] = cleanHash[5];
      cleanHash[5] = cleanHash[4];
      cleanHash[4] = (cleanHash[3] + temp1) | 0;
      cleanHash[3] = cleanHash[2];
      cleanHash[2] = cleanHash[1];
      cleanHash[1] = cleanHash[0];
      cleanHash[0] = (temp1 + temp2) | 0;
    }

    for (i = 0; i < 8; i++) {
      cleanHash[i] = (cleanHash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (cleanHash[i] >> (8 * j)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }

  return result;
}

export const PasswordGate: React.FC<PasswordGateProps> = ({ onUnlock }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || isVerifying) return;

    setIsVerifying(true);
    setError(false);

    try {
      const hash = await sha256(password.trim());
      if (hash === AUTH_HASH) {
        try {
          localStorage.setItem('lts_auth_exp', (Date.now() + THIRTY_DAYS_MS).toString());
        } catch (e) {
          // ignore storage access errors
        }
        sessionStorage.setItem('lts_auth', 'true');
        onUnlock();
      } else {
        setError(true);
        setPassword('');
      }
    } catch (err) {
      setError(true);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div
      id="password-gate-screen"
      className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 selection:bg-white selection:text-black select-none"
    >
      <div className="w-full max-w-sm flex flex-col items-center text-center">
        {/* Site Title */}
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-6">
          LowTierSite
        </h1>

        {/* Password Entry Form */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col items-center gap-2">
          <div className="w-full relative">
            <input
              id="site-password-input"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(false);
              }}
              placeholder="Enter password..."
              autoFocus
              disabled={isVerifying}
              autoComplete="current-password"
              className={`w-full bg-[#111111] border ${
                error ? 'border-red-500 focus:border-red-500' : 'border-[#262626] focus:border-white'
              } text-white px-4 py-2.5 rounded-lg text-sm text-center outline-none transition-colors placeholder-[#555555] disabled:opacity-50`}
            />
          </div>

          {error && (
            <p id="password-error-msg" className="text-xs text-red-500 font-medium">
              Incorrect password
            </p>
          )}
        </form>
      </div>
    </div>
  );
};
