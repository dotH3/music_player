// Generates the PWA icons from an inline SVG. Run with: npm run icons
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

// A "cover bleeding its color" — gradient square with a disc/play motif.
const svg = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b0b0f"/>
      <stop offset="1" stop-color="#0b0b0f"/>
    </linearGradient>
    <radialGradient id="bleed" cx="0.32" cy="0.28" r="0.9">
      <stop offset="0" stop-color="#ff5d73"/>
      <stop offset="0.45" stop-color="#7c5cff"/>
      <stop offset="1" stop-color="#1b1b6b"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" rx="${pad ? 0 : 112}" fill="url(#bg)"/>
  <rect x="${96}" y="${96}" width="320" height="320" rx="56" fill="url(#bleed)"/>
  <circle cx="256" cy="256" r="86" fill="#0b0b0f" fill-opacity="0.28"/>
  <circle cx="256" cy="256" r="26" fill="#fff" fill-opacity="0.9"/>
  <circle cx="256" cy="256" r="9" fill="#0b0b0f"/>
</svg>`;

async function main() {
  await mkdir(outDir, { recursive: true });
  await sharp(Buffer.from(svg(false))).resize(192, 192).png().toFile(join(outDir, 'icon-192.png'));
  await sharp(Buffer.from(svg(false))).resize(512, 512).png().toFile(join(outDir, 'icon-512.png'));
  await sharp(Buffer.from(svg(true))).resize(512, 512).png().toFile(join(outDir, 'icon-maskable-512.png'));
  console.log('icons written to', outDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
