// The player. Big cover, transport, and a track list — all sitting on a
// background that bleeds the album's own colors. Every time the song changes
// the title slides in and the new row in the list lights up.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Album } from '../types';
import { player, fmtTime } from '../lib/player';
import { usePlayer } from '../hooks/usePlayer';
import * as Icon from '../ui/icons';

// Allow CSS custom properties in inline styles.
type CSSVars = CSSProperties & Record<`--${string}`, string>;

export function NowPlaying({ album, onBack }: { album: Album; onBack: () => void }) {
  usePlayer(['state', 'track', 'time']);

  const [scrubbing, setScrubbing] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const tracksRef = useRef<HTMLUListElement>(null);

  const pal = album.palette;
  const isActiveAlbum = player.album === album;
  const isPlaying = isActiveAlbum && player.isPlaying;
  const curIndex = player.index;
  // Progress only reflects this album when it's the one actually playing —
  // otherwise the bar/times would track a different album's song.
  const duration = isActiveAlbum ? player.duration : 0;
  const position = isActiveAlbum ? player.position : 0;

  // Slider follows playback, except while the user is dragging it.
  const ratio = scrubbing ? seekValue : duration ? (position / duration) * 1000 : 0;
  const shownTime = scrubbing ? (seekValue / 1000) * duration : position;

  // Replay the row-highlight animation whenever the playing track changes.
  useEffect(() => {
    if (!isActiveAlbum) return;
    const row = tracksRef.current?.querySelector<HTMLElement>(`.track[data-i="${curIndex}"]`);
    if (!row) return;
    row.classList.remove('row-in');
    void row.offsetWidth; // force reflow so the animation restarts
    row.classList.add('row-in');
  }, [curIndex, isActiveAlbum]);

  const commitSeek = () => {
    if (!scrubbing) return;
    if (duration) player.seek((seekValue / 1000) * duration);
    setScrubbing(false);
  };

  const bleedStyle: CSSVars = {
    '--bleed-1': pal?.bg1 || 'hsl(240 12% 16%)',
    '--bleed-2': pal?.bg2 || 'hsl(240 14% 6%)',
  };

  return (
    <div className="relative h-full w-full overflow-hidden" style={bleedStyle}>
      <div className="absolute inset-0 bleed grain" />
      <div className="relative z-10 h-full overflow-y-auto no-scrollbar">
        {/* PLAYER */}
        <section className="min-h-[100dvh] flex flex-col px-6 safe-t safe-b">
          <div className="flex items-center justify-between py-1">
            <button
              onClick={onBack}
              aria-label="Volver"
              className="w-10 h-10 -ml-2 grid place-items-center rounded-full bg-white/10 active:bg-white/20 border border-white/10 backdrop-blur-md transition"
            >
              <span className="w-6 h-6">
                <Icon.Back />
              </span>
            </button>
            <span className="text-[11px] tracking-[0.2em] uppercase text-white/45">Reproduciendo</span>
            <span className="w-10" />
          </div>

          <div className="flex-1 flex items-center justify-center py-4">
            <div className="w-full max-w-[78vw] sm:max-w-sm aspect-square rounded-2xl overflow-hidden cover-shadow bg-black/20 fade-up">
              {album.cover ? (
                <img src={album.cover} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full grid place-items-center text-white/30">
                  <span className="w-20 h-20">
                    <Icon.Disc />
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="pb-2">
            <h2 className="text-[22px] font-semibold leading-tight truncate">{album.name}</h2>
            <p className="text-white/55 text-[15px] truncate">
              {album.artist}
              {album.year ? ` · ${album.year}` : ''}
            </p>

            {/* `key` remounts this on every track change → the song-in animation replays. */}
            <p key={curIndex} className="song-in mt-3 text-[15px] text-white/80 truncate">
              {isActiveAlbum ? player.current?.title ?? '' : ''}
            </p>

            <div className="mt-2">
              <input
                className="seek"
                type="range"
                min={0}
                max={1000}
                value={Math.round(ratio)}
                disabled={!isActiveAlbum}
                style={{ '--p': `${ratio / 10}%` } as CSSVars}
                onChange={(e) => {
                  setScrubbing(true);
                  setSeekValue(Number(e.target.value));
                }}
                onPointerUp={commitSeek}
                onMouseUp={commitSeek}
                onTouchEnd={commitSeek}
                onKeyUp={commitSeek}
              />
              <div className="flex justify-between text-[12px] text-white/45 -mt-0.5 tabular-nums">
                <span>{fmtTime(shownTime)}</span>
                <span>{fmtTime(duration)}</span>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-center gap-8">
              <button
                onClick={() => isActiveAlbum && player.prev()}
                aria-label="Anterior"
                className={`w-12 h-12 grid place-items-center rounded-full bg-white/10 border border-white/10 backdrop-blur-md text-white/85 active:bg-white/20 active:scale-90 transition ${
                  isActiveAlbum ? '' : 'opacity-40'
                }`}
              >
                <span className="w-6 h-6">
                  <Icon.Prev />
                </span>
              </button>
              <button
                onClick={() => (isActiveAlbum ? player.toggle() : player.playAlbum(album, 0))}
                aria-label="Reproducir o pausar"
                className="w-16 h-16 grid place-items-center rounded-full bg-white text-black active:scale-95 transition cover-shadow"
              >
                <span className="w-8 h-8">{isPlaying ? <Icon.Pause /> : <Icon.Play />}</span>
              </button>
              <button
                onClick={() => isActiveAlbum && player.next()}
                aria-label="Siguiente"
                className={`w-12 h-12 grid place-items-center rounded-full bg-white/10 border border-white/10 backdrop-blur-md text-white/85 active:bg-white/20 active:scale-90 transition ${
                  isActiveAlbum ? '' : 'opacity-40'
                }`}
              >
                <span className="w-6 h-6">
                  <Icon.Next />
                </span>
              </button>
            </div>
          </div>

          <div className="mt-4 flex justify-center">
            <div className="text-white/35 text-[11px] tracking-wide flex items-center gap-1.5">
              <span className="w-3.5 h-3.5">
                <Icon.Disc />
              </span>{' '}
              {album.tracks.length} pistas · deslizá ↓
            </div>
          </div>
        </section>

        {/* TRACK LIST */}
        <section className="px-4 pb-10">
          <ul ref={tracksRef} className="space-y-0.5">
            {album.tracks.map((t, i) => {
              const on = i === curIndex && isActiveAlbum;
              return (
                <li key={i}>
                  <button
                    data-i={i}
                    onClick={() => player.playAlbum(album, i)}
                    className={`track w-full text-left flex items-center gap-3 rounded-xl px-3 py-2.5 active:bg-white/10 transition ${
                      on ? 'bg-white/8' : ''
                    }`}
                  >
                    <span
                      className={`track-no w-6 text-center text-[13px] text-white/40 tabular-nums ${
                        on ? 'hidden' : ''
                      }`}
                    >
                      {t.no ?? i + 1}
                    </span>
                    <span className="flex-1 truncate text-[15px]">{t.title}</span>
                    <span className={`track-eq w-4 h-4 text-white/80 ${on ? '' : 'hidden'}`}>
                      <Icon.Disc />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
