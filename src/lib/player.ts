// Thin wrapper around a single <audio> element. Plays one album (queue)
// at a time and broadcasts state changes to subscribers.

import type { Album, Track } from '../types';

export type PlayerEventName = 'state' | 'track' | 'time';

class Player extends EventTarget {
  readonly audio = new Audio();
  album: Album | null = null;
  index = -1;
  private _url: string | null = null;

  constructor() {
    super();
    this.audio.preload = 'metadata';

    const emit = () => this.dispatchEvent(new Event('state'));
    this.audio.addEventListener('play', emit);
    this.audio.addEventListener('pause', emit);
    this.audio.addEventListener('loadedmetadata', emit);
    this.audio.addEventListener('timeupdate', () =>
      this.dispatchEvent(new Event('time'))
    );
    this.audio.addEventListener('ended', () => this.next());
    this.audio.addEventListener('error', emit);

    this._setupMediaSession();
  }

  get current(): Track | null {
    return this.album?.tracks[this.index] ?? null;
  }
  get isPlaying(): boolean {
    return !this.audio.paused && !this.audio.ended;
  }
  get duration(): number {
    return this.audio.duration || 0;
  }
  get position(): number {
    return this.audio.currentTime || 0;
  }

  playAlbum(album: Album, index = 0): void {
    this.album = album;
    this._load(index);
  }

  private _load(index: number): void {
    if (!this.album || index < 0 || index >= this.album.tracks.length) return;
    this.index = index;
    const track = this.album.tracks[index];
    if (this._url) URL.revokeObjectURL(this._url);
    this._url = URL.createObjectURL(track.file);
    this.audio.src = this._url;
    this.audio.play().catch(() => {});
    this._updateMediaSession();
    this.dispatchEvent(new Event('track'));
  }

  toggle(): void {
    if (this.isPlaying) this.audio.pause();
    else this.audio.play().catch(() => {});
  }
  next(): void {
    if (!this.album) return;
    if (this.index < this.album.tracks.length - 1) this._load(this.index + 1);
    else {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
  }
  prev(): void {
    if (!this.album) return;
    if (this.position > 3 || this.index === 0) this.audio.currentTime = 0;
    else this._load(this.index - 1);
  }
  seek(seconds: number): void {
    if (Number.isFinite(seconds)) this.audio.currentTime = seconds;
  }

  private _setupMediaSession(): void {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    ms.setActionHandler('play', () => this.toggle());
    ms.setActionHandler('pause', () => this.toggle());
    ms.setActionHandler('nexttrack', () => this.next());
    ms.setActionHandler('previoustrack', () => this.prev());
  }
  private _updateMediaSession(): void {
    if (!('mediaSession' in navigator) || !this.current || !this.album) return;
    const artwork = this.album.cover
      ? [{ src: this.album.cover, sizes: '512x512', type: 'image/jpeg' }]
      : [];
    navigator.mediaSession.metadata = new MediaMetadata({
      title: this.current.title,
      artist: this.album.artist,
      album: this.album.name,
      artwork,
    });
  }
}

export const player = new Player();

export function fmtTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
