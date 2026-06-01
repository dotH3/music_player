// Shared, side-effect-free contract between the scanner (main thread) and the
// tag-parsing Web Worker. Keep this free of DOM / worker globals so both sides
// can import it.

// Compact subset of music-metadata's `common` tags — only what albums need.
// Sent back from the worker instead of the full (large) result object.
export interface TagSummary {
  album?: string;
  albumartist?: string;
  artist?: string;
  year?: number;
  title?: string;
  trackNo: number | null;
  diskNo: number | null;
}

// Embedded cover art as raw bytes, so the main thread can build the object URL
// (a URL created inside a worker isn't usable by the document).
export interface CoverBytes {
  data: ArrayBuffer;
  format: string;
}

// A cover tied to the file index (within ScanJob.files) it was read from, so
// each split album in a mixed folder gets its own art.
export interface CoverEntry extends CoverBytes {
  index: number;
}

// One unit of work = one album folder.
export interface ScanJob {
  jobId: number;
  dir: string;
  files: File[];
  // Whether to read embedded cover art. False when the folder already has a
  // cover.jpg/folder.jpg image, so we skip the (expensive) picture read.
  wantCover: boolean;
}

// Final reply for a job. `summaries` is aligned 1:1 with `ScanJob.files`.
// `covers` holds one entry per distinct album found in the folder.
export interface ScanResult {
  jobId: number;
  summaries: Array<TagSummary | null>;
  covers: CoverEntry[];
}

// Lightweight progress ping, one per parsed file.
export interface ProgressMsg {
  tick: number;
}

// Structural shape of the fields we read off music-metadata's `common`.
export interface CommonLike {
  album?: string;
  albumartist?: string;
  artist?: string;
  year?: number;
  title?: string;
  track?: { no?: number | null };
  disk?: { no?: number | null };
}

export function summarize(c: CommonLike): TagSummary {
  return {
    album: c.album,
    albumartist: c.albumartist,
    artist: c.artist,
    year: c.year,
    title: c.title,
    trackNo: c.track?.no ?? null,
    diskNo: c.disk?.no ?? null,
  };
}

// Copies into a fresh, exact-length ArrayBuffer so the result is both a valid
// BlobPart and transferable across the worker boundary.
export function toArrayBuffer(data: Uint8Array | ArrayLike<number>): ArrayBuffer {
  return new Uint8Array(data).buffer as ArrayBuffer;
}
