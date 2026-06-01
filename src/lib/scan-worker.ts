// CPU-bound tag parsing, off the main thread. The scanner spins up a pool of
// these (one per core) and feeds them one album folder at a time.
//
// Two passes: first parse every file tags-only (cheap — reads just headers),
// then read embedded art for only the first file of each distinct album. That
// keeps a normal album at one cover read while still giving every album in a
// mixed/loose folder its own art.

import { parseBlob } from 'music-metadata';
import type { CoverEntry, ProgressMsg, ScanJob, ScanResult, TagSummary } from './scan-protocol';
import { summarize, toArrayBuffer } from './scan-protocol';

// `self` is typed as a Window via the DOM lib; narrow it to just what we use so
// we don't need to pull in (and conflict with) the WebWorker lib.
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<ScanJob>) => void) | null;
  postMessage: (message: ScanResult | ProgressMsg, transfer?: Transferable[]) => void;
};

ctx.onmessage = async (e) => {
  const { jobId, files, wantCover } = e.data;

  // Pass 1 — tags only.
  const summaries: Array<TagSummary | null> = [];
  for (const file of files) {
    try {
      const meta = await parseBlob(file, { duration: false, skipCovers: true });
      summaries.push(summarize(meta.common || {}));
    } catch {
      // unreadable / unsupported — main thread falls back to the filename
      summaries.push(null);
    }
    ctx.postMessage({ tick: 1 });
  }

  // Pass 2 — one cover per distinct album (skipped if the folder ships an image).
  // Within an album we scan its tracks until one yields art, so a missing cover
  // on the first track doesn't lose the whole album's art.
  const covers: CoverEntry[] = [];
  const transfer: Transferable[] = [];
  if (wantCover) {
    for (const group of groupByAlbum(summaries)) {
      for (const i of group) {
        try {
          const meta = await parseBlob(files[i], { duration: false, skipCovers: false });
          const pic = meta.common?.picture?.[0];
          if (pic?.data) {
            const data = toArrayBuffer(pic.data);
            covers.push({ index: i, data, format: pic.format || 'image/jpeg' });
            transfer.push(data);
            break; // got this album's art
          }
        } catch {
          /* try the next track in this album */
        }
      }
    }
  }

  ctx.postMessage({ jobId, summaries, covers }, transfer);
};

// Groups file indices by `album` tag (preserving order); untagged tracks each
// form their own group, matching how the main thread splits a mixed folder.
function groupByAlbum(summaries: Array<TagSummary | null>): number[][] {
  const groups: number[][] = [];
  const byTag = new Map<string, number[]>();
  summaries.forEach((s, i) => {
    const tag = s?.album?.trim();
    if (!tag) {
      groups.push([i]);
      return;
    }
    const existing = byTag.get(tag);
    if (existing) existing.push(i);
    else {
      const group = [i];
      byTag.set(tag, group);
      groups.push(group);
    }
  });
  return groups;
}
