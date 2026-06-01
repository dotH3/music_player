// Turns a picked directory (FileList) into a list of albums.
// Albums are grouped by their containing folder — matching how the user
// stores music ("one folder per album") — and enriched with ID3 tags
// and embedded cover art.
//
// Tag parsing is CPU-bound, so it runs across a pool of Web Workers: one job
// per album folder, spread over `navigator.hardwareConcurrency` threads. This
// keeps the main thread (and the UI) free and uses every core. If workers are
// unavailable we fall back to parsing on the main thread.

import { parseBlob } from 'music-metadata';
import type { Album, Track } from '../types';
import type { CoverBytes, ProgressMsg, ScanJob, ScanResult, TagSummary } from './scan-protocol';
import { summarize, toArrayBuffer } from './scan-protocol';

const AUDIO_RE = /\.(mp3|m4a|aac|flac|wav|ogg|oga|opus|mp4|webm)$/i;
const IMAGE_RE = /\.(jpe?g|png|webp|gif|bmp)$/i;
const COVER_HINT = /(cover|folder|front|album|art)/i;

// Cap the pool so high-core desktops don't spin up dozens of workers (each one
// loads its own copy of the parser). Phones sit well under this anyway.
const MAX_WORKERS = 8;

type RelFile = File & { webkitRelativePath?: string };

const relPath = (f: File) => (f as RelFile).webkitRelativePath || f.name;
const parentDir = (f: File) => {
  const parts = relPath(f).split('/');
  parts.pop();
  return parts.join('/') || '·';
};
const folderName = (f: File) => {
  const parts = relPath(f).split('/').filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : parts[0] || 'Álbum';
};

// Most frequent non-empty value in a list.
function mode(values: Array<string | number | null | undefined | false>): string | null {
  const counts = new Map<string, number>();
  let best: string | null = null;
  let bestN = 0;
  for (const raw of values) {
    if (!raw) continue;
    const v = String(raw);
    const n = (counts.get(v) || 0) + 1;
    counts.set(v, n);
    if (n > bestN) {
      bestN = n;
      best = v;
    }
  }
  return best;
}

type ProgressFn = (done: number, total: number) => void;

// Parsed tags for one album folder. `summaries` is aligned 1:1 with `files`;
// `covers` is keyed by file index (one per distinct album in the folder).
interface FolderData {
  files: File[];
  summaries: Array<TagSummary | null>;
  covers: Map<number, CoverBytes>;
}

export async function scanFiles(
  fileList: FileList | File[],
  onProgress?: ProgressFn
): Promise<Album[]> {
  const files = Array.from(fileList);
  const audio = files.filter((f) => AUDIO_RE.test(f.name));

  // Loose images sitting next to the audio, kept as a per-folder cover fallback.
  const imagesByDir = new Map<string, File[]>();
  for (const f of files) {
    if (!IMAGE_RE.test(f.name)) continue;
    pushTo(imagesByDir, parentDir(f), f);
  }

  // Bucket audio by folder — each bucket is one unit of parallel work.
  const filesByDir = new Map<string, File[]>();
  for (const f of audio) pushTo(filesByDir, parentDir(f), f);

  // Folders that already ship a cover image don't need embedded-art reads.
  const imageDirs = new Set(imagesByDir.keys());

  const total = audio.length;
  let done = 0;
  const tick = () => onProgress?.(++done, total);

  let folders: Map<string, FolderData>;
  try {
    folders = await parseInWorkers(filesByDir, imageDirs, tick);
  } catch {
    if (import.meta.env.DEV) {
      console.log('%c⚠ Sin workers — parseando en el hilo principal (secuencial)', 'color:#fdd663');
    }
    done = 0; // restart the progress count for the fallback pass
    folders = await parseOnMainThread(filesByDir, imageDirs, tick);
  }

  const albums: Album[] = [];
  for (const [dir, fd] of folders) {
    if (!fd.files.length) continue;
    const entries: Entry[] = fd.files.map((file, i) => ({ file, sum: fd.summaries[i], index: i }));
    const folderImg = imagesByDir.get(dir);

    // How many distinct album names live in this folder?
    const distinct = new Set(
      entries.map((e) => e.sum?.album?.trim()).filter((a): a is string => !!a)
    );

    // The usual case ("one folder per album", or no tags at all) → one album.
    if (distinct.size <= 1) {
      albums.push(makeAlbum(dir, entries, fd.covers, folderImg));
      continue;
    }

    // Mixed folder (loose tracks from several albums) → split by album tag.
    // Tracks without an album tag are treated as standalone singles.
    const byTag = new Map<string, Entry[]>();
    const strays: Entry[] = [];
    for (const e of entries) {
      const tag = e.sum?.album?.trim();
      if (tag) pushTo(byTag, tag, e);
      else strays.push(e);
    }
    for (const [tag, ents] of byTag) {
      albums.push(makeAlbum(`${dir}::${tag}`, ents, fd.covers, folderImg, tag));
    }
    strays.forEach((e, k) => {
      const name = e.sum?.title || prettyName(e.file.name);
      albums.push(makeAlbum(`${dir}::~${k}`, [e], fd.covers, folderImg, name));
    });
  }

  albums.sort((a, b) => a.artist.localeCompare(b.artist) || a.name.localeCompare(b.name));
  return albums;
}

// A file paired with its parsed tags and its index within the folder.
interface Entry {
  file: File;
  sum: TagSummary | null;
  index: number;
}

// Build one Album from a set of entries. The cover is the first of these
// entries that has embedded art. `forcedName` overrides the derived name
// (used when splitting a mixed folder, where the tag is the album name).
function makeAlbum(
  id: string,
  entries: Entry[],
  covers: Map<number, CoverBytes>,
  imageFiles: File[] | undefined,
  forcedName?: string
): Album {
  const sums = entries.map((e) => e.sum);
  let embedded: CoverBytes | null = null;
  for (const e of entries) {
    const c = covers.get(e.index);
    if (c) {
      embedded = c;
      break;
    }
  }
  const name = forcedName || mode(sums.map((x) => x?.album)) || folderName(entries[0].file);
  const artist =
    mode(sums.map((x) => x?.albumartist)) ||
    mode(sums.map((x) => x?.artist)) ||
    'Artista desconocido';
  const year = mode(sums.map((x) => x?.year && String(x.year)));

  const tracks: Track[] = entries
    .map(({ file, sum }) => ({
      title: sum?.title || prettyName(file.name),
      no: sum?.trackNo ?? null,
      disc: sum?.diskNo ?? null,
      file,
    }))
    .sort((a, b) => {
      if (a.disc !== b.disc) return (a.disc ?? 0) - (b.disc ?? 0);
      if (a.no != null && b.no != null) return a.no - b.no;
      return a.title.localeCompare(b.title);
    });

  return {
    id,
    name,
    artist,
    year: year || '',
    cover: pickCover(embedded, imageFiles),
    tracks,
    palette: null, // computed lazily when opened
  };
}

function pushTo<V>(map: Map<string, V[]>, key: string, value: V) {
  const bucket = map.get(key);
  if (bucket) bucket.push(value);
  else map.set(key, [value]);
}

// --- Worker pool ---------------------------------------------------------

function createWorker(): Worker {
  return new Worker(new URL('./scan-worker.ts', import.meta.url), { type: 'module' });
}

async function parseInWorkers(
  filesByDir: Map<string, File[]>,
  imageDirs: Set<string>,
  tick: () => void
): Promise<Map<string, FolderData>> {
  if (typeof Worker === 'undefined') throw new Error('Web Workers unavailable');

  const jobs: ScanJob[] = [];
  let id = 0;
  for (const [dir, files] of filesByDir) {
    jobs.push({ jobId: id++, dir, files, wantCover: !imageDirs.has(dir) });
  }

  const out = new Map<string, FolderData>();
  if (!jobs.length) return out;

  let next = 0;
  const takeJob = () => (next < jobs.length ? jobs[next++] : undefined);

  const poolSize = Math.min(navigator.hardwareConcurrency || 4, MAX_WORKERS, jobs.length);
  const totalFiles = jobs.reduce((n, j) => n + j.files.length, 0);
  const log = createScanLog(jobs.length, totalFiles, poolSize);

  await Promise.all(
    Array.from({ length: poolSize }, (_, laneId) => runWorkerLane(laneId, takeJob, out, tick, log))
  );

  log?.finish();
  return out;
}

// Drives a single worker: hand it one folder, await the reply, then feed it the
// next, until the shared queue is drained.
function runWorkerLane(
  laneId: number,
  takeJob: () => ScanJob | undefined,
  out: Map<string, FolderData>,
  tick: () => void,
  log: ScanLog | null
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const worker = createWorker();
    let current: ScanJob | undefined;

    const dispatch = () => {
      current = takeJob();
      if (!current) {
        worker.terminate();
        resolve();
        return;
      }
      log?.folderStart(laneId, current.dir, current.files.length);
      worker.postMessage(current);
    };

    worker.onmessage = (e: MessageEvent<ProgressMsg | ScanResult>) => {
      const data = e.data;
      if ('tick' in data) {
        tick();
        log?.tick();
        return;
      }
      if (current) {
        out.set(current.dir, {
          files: current.files,
          summaries: data.summaries,
          covers: new Map(
            data.covers.map((c): [number, CoverBytes] => [c.index, { data: c.data, format: c.format }])
          ),
        });
        log?.folderDone(laneId, current.dir, current.files.length);
      }
      dispatch();
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(err instanceof ErrorEvent ? (err.error ?? err) : err);
    };

    dispatch();
  });
}

// --- Main-thread fallback ------------------------------------------------

async function parseOnMainThread(
  filesByDir: Map<string, File[]>,
  imageDirs: Set<string>,
  tick: () => void
): Promise<Map<string, FolderData>> {
  const out = new Map<string, FolderData>();
  const flat: Array<{ dir: string; i: number; file: File }> = [];
  for (const [dir, files] of filesByDir) {
    out.set(dir, { files, summaries: new Array(files.length).fill(null), covers: new Map() });
    files.forEach((file, i) => flat.push({ dir, i, file }));
  }

  // Pass 1 — tags only.
  await mapPool(flat, 6, async ({ dir, i, file }) => {
    const fd = out.get(dir)!;
    try {
      const meta = await parseBlob(file, { duration: false, skipCovers: true });
      fd.summaries[i] = summarize(meta.common || {});
    } catch {
      /* unreadable / unsupported — fall back to filename */
    }
    tick();
  });

  // Pass 2 — one cover per distinct album (folders with an image are skipped).
  // Each group is scanned until a track yields art.
  const groups: Array<{ dir: string; indices: number[] }> = [];
  for (const [dir] of filesByDir) {
    if (imageDirs.has(dir)) continue;
    const fd = out.get(dir)!;
    const byTag = new Map<string, number[]>();
    fd.files.forEach((_file, i) => {
      const tag = fd.summaries[i]?.album?.trim();
      if (!tag) {
        groups.push({ dir, indices: [i] });
        return;
      }
      const existing = byTag.get(tag);
      if (existing) existing.push(i);
      else {
        const indices = [i];
        byTag.set(tag, indices);
        groups.push({ dir, indices });
      }
    });
  }

  await mapPool(groups, 6, async ({ dir, indices }) => {
    const fd = out.get(dir)!;
    for (const i of indices) {
      try {
        const meta = await parseBlob(fd.files[i], { duration: false, skipCovers: false });
        const pic = meta.common?.picture?.[0];
        if (pic?.data) {
          fd.covers.set(i, { data: toArrayBuffer(pic.data), format: pic.format || 'image/jpeg' });
          break;
        }
      } catch {
        /* try the next track in this album */
      }
    }
  });

  return out;
}

async function mapPool<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      try {
        await fn(items[idx]);
      } catch {
        /* ignore — fn handles its own failures */
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

// --- Cover art -----------------------------------------------------------

function pickCover(embedded: CoverBytes | null, imageFiles?: File[]): string | null {
  // 1) embedded art from the first track that had it
  if (embedded) return URL.createObjectURL(new Blob([embedded.data], { type: embedded.format }));
  // 2) a cover.jpg / folder.jpg sitting in the album folder
  if (imageFiles?.length) {
    const hinted = imageFiles.find((f) => COVER_HINT.test(f.name)) || imageFiles[0];
    return URL.createObjectURL(hinted);
  }
  return null;
}

function prettyName(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/^\d+\s*[-._)]?\s*/, '') // strip leading track number
    .replace(/_/g, ' ')
    .trim();
}

// --- Dev console logging -------------------------------------------------
// Prints a colored progress bar from each worker lane so the parallel loading
// is visible in DevTools. No-op outside `vite dev`.

interface ScanLog {
  tick(): void;
  folderStart(laneId: number, dir: string, tracks: number): void;
  folderDone(laneId: number, dir: string, tracks: number): void;
  finish(): void;
}

const LANE_COLORS = ['#8ab4f8', '#f28b82', '#81c995', '#fdd663', '#c58af9', '#78d9ec', '#ff8bcb', '#aecbfa'];

function bar(frac: number, width = 22): string {
  const f = Math.max(0, Math.min(1, frac));
  const filled = Math.round(f * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function lastSegment(dir: string): string {
  const parts = dir.split('/').filter(Boolean);
  return parts[parts.length - 1] || dir;
}

function createScanLog(folders: number, totalFiles: number, workers: number): ScanLog | null {
  if (!import.meta.env.DEV) return null;

  const t0 = performance.now();
  let done = 0;
  const lanes = new Map<number, { folders: number; files: number }>();
  const tag = (laneId: number) => `color:${LANE_COLORS[laneId % LANE_COLORS.length]};font-weight:bold`;

  console.log(
    `%c🎵 Cargando música%c · ${folders} carpetas · ${totalFiles} archivos · ${workers} workers en paralelo`,
    'font-weight:bold;color:#8ab4f8',
    'color:inherit'
  );

  return {
    tick() {
      done++;
    },
    folderStart(laneId, dir, tracks) {
      console.log(`%c[W${laneId}]%c ▶ ${lastSegment(dir)} (${tracks} pistas)`, tag(laneId), 'color:inherit');
    },
    folderDone(laneId, dir, tracks) {
      const lane = lanes.get(laneId) ?? { folders: 0, files: 0 };
      lane.folders++;
      lane.files += tracks;
      lanes.set(laneId, lane);
      const frac = totalFiles ? done / totalFiles : 1;
      const pct = String(Math.round(frac * 100)).padStart(3);
      console.log(
        `%c[W${laneId}]%c ${bar(frac)} ${pct}% · ✓ ${lastSegment(dir)} · global ${done}/${totalFiles}`,
        tag(laneId),
        'color:inherit'
      );
    },
    finish() {
      const ms = Math.round(performance.now() - t0);
      console.log(`%c✅ Listo%c · ${totalFiles} archivos en ${ms}ms`, 'font-weight:bold;color:#81c995', 'color:inherit');
      for (const [laneId, l] of [...lanes].sort((a, b) => a[0] - b[0])) {
        console.log(`%c   W${laneId}%c · ${l.folders} carpetas · ${l.files} archivos`, tag(laneId), 'color:inherit');
      }
    },
  };
}
