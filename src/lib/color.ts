// Pulls a palette out of an album cover so the UI can "bleed" its colors.
// Pure canvas, no dependencies. Returns CSS-ready strings.

import type { Palette } from '../types';

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}

function hslToCss(h: number, s: number, l: number, a = 1): string {
  return `hsl(${h.toFixed(0)} ${(s * 100).toFixed(0)}% ${(l * 100).toFixed(0)}% / ${a})`;
}

const DEFAULT: Palette = {
  bg1: 'hsl(240 12% 16% / 1)',
  bg2: 'hsl(240 14% 6% / 1)',
  accent: 'hsl(240 10% 70% / 1)',
  ink: '#f5f5f7',
  inkSoft: 'rgba(245,245,247,0.62)',
  isDark: true,
};

interface Bucket {
  w: number;
  h: number;
  s: number;
  l: number;
  n: number;
}

export async function extractPalette(src: string | null): Promise<Palette> {
  if (!src) return DEFAULT;
  let img: HTMLImageElement;
  try {
    img = await loadImage(src);
  } catch {
    return DEFAULT;
  }

  const size = 40;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return DEFAULT;
  ctx.drawImage(img, 0, 0, size, size);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, size, size).data;
  } catch {
    return DEFAULT; // tainted canvas — shouldn't happen with object URLs
  }

  // Histogram, weighted toward colorful + mid-bright pixels so the bleed
  // doesn't end up muddy brown or pure black/white.
  const buckets = new Map<string, Bucket>();
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 125) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const [h, s, l] = rgbToHsl(r, g, b);
    if (l > 0.95 || l < 0.05) continue; // ignore near white/black
    const weight = (0.25 + s) * (1 - Math.abs(l - 0.5) * 0.8);
    const key = `${Math.round(h / 12)}|${Math.round(s * 6)}|${Math.round(l * 6)}`;
    const cur = buckets.get(key);
    if (cur) {
      cur.w += weight;
      cur.h += h;
      cur.s += s;
      cur.l += l;
      cur.n += 1;
    } else {
      buckets.set(key, { w: weight, h, s, l, n: 1 });
    }
  }

  if (buckets.size === 0) return DEFAULT;

  let best: Bucket | null = null;
  for (const v of buckets.values()) {
    if (!best || v.w > best.w) best = v;
  }
  if (!best) return DEFAULT;
  const h = best.h / best.n;
  const s = best.s / best.n;

  // Build a comfortable dark bleed: vivid top color, deep bottom color.
  const accentS = Math.min(0.85, Math.max(0.45, s));
  const bg1 = hslToCss(h, Math.min(0.7, accentS), 0.22);
  const bg2 = hslToCss(h, Math.min(0.5, accentS * 0.7), 0.07);
  const accent = hslToCss(h, accentS, 0.62);

  return {
    bg1,
    bg2,
    accent,
    ink: '#f5f5f7',
    inkSoft: 'rgba(245,245,247,0.62)',
    isDark: true,
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export const DEFAULT_PALETTE = DEFAULT;
