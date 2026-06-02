// "Vinyl" browse mode: a horizontal cover-flow where the centered album sits
// flat and big while its neighbours swing back in 3D. Tap the centered cover to
// open it; tap a side cover to bring it to the center. Below it sits a scrubber strip
// holding the whole catalog (first on the left, last on the right) — drag a
// finger across it to fly through the library; the cover-flow tracks live.
import { useEffect, useRef, useState } from 'react';
import type { Album } from '../types';
import * as Icon from '../ui/icons';

export function VinylFlow({ albums, onOpen }: { albums: Album[]; onOpen: (id: string) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const scrubRef = useRef<HTMLDivElement>(null);
  const scrubbing = useRef(false);
  const activeRef = useRef(0); // current centered index, read by tap handler
  const [active, setActive] = useState(0);

  // Center cover-flow item `i` instantly (used while scrubbing) or smoothly.
  const seekToIndex = (i: number, smooth = false) => {
    const track = trackRef.current;
    if (!track) return;
    const item = track.querySelectorAll<HTMLElement>('.cf-item')[i];
    if (!item) return;
    if (smooth) {
      item.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      return;
    }
    const tr = track.getBoundingClientRect();
    const ir = item.getBoundingClientRect();
    track.scrollLeft += ir.left + ir.width / 2 - (tr.left + tr.width / 2);
  };

  // Map a pointer x within the scrubber to an album and jump the cover-flow.
  const scrubTo = (clientX: number) => {
    const el = scrubRef.current;
    if (!el || albums.length < 2) return seekToIndex(0);
    const r = el.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    seekToIndex(Math.round(f * (albums.length - 1)));
  };

  // Recompute the 3D transforms from each cover's distance to the viewport
  // center. Driven by scroll (rAF-throttled) and layout changes.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let raf = 0;

    const apply = () => {
      raf = 0;
      const mid = track.getBoundingClientRect().left + track.clientWidth / 2;
      const items = track.querySelectorAll<HTMLElement>('.cf-item');
      let bestI = 0;
      let bestD = Infinity;

      items.forEach((item, i) => {
        const r = item.getBoundingClientRect();
        const delta = (r.left + r.width / 2 - mid) / r.width; // in cover-widths
        const c = Math.max(-2.4, Math.min(2.4, delta));
        const edge = Math.min(Math.abs(c), 1);

        // Stack whole items, not covers: `.cf-item` carries `perspective`, which
        // makes it a stacking context, so a z-index on the inner `.cf-cover` only
        // orders that cover's own children — between items the covers would fall
        // back to DOM order and a later neighbour would paint over the centered
        // disc. Putting z-index on the flex item is what actually layers them.
        item.style.zIndex = String(1000 - Math.round(Math.abs(delta) * 100));

        const cover = item.querySelector<HTMLElement>('.cf-cover');
        if (cover) {
          const ry = c * 42; // side covers swing on the vertical axis (kept < edge-on)
          const tx = -c * 16; // pull neighbours inward so they overlap a touch
          const sc = 1 - edge * 0.18; // the centered cover is the largest
          // Fade out anything past the first neighbour so distant, near-edge-on
          // covers don't show up as glitchy slivers on wide (desktop) viewports.
          const fade = Math.max(0, 1 - Math.max(0, Math.abs(delta) - 1) * 0.85);
          cover.style.transform = `translateX(${tx}%) rotateY(${ry}deg) scale(${sc})`;
          cover.style.opacity = String(fade);
        }

        const ad = Math.abs(delta);
        if (ad < bestD) {
          bestD = ad;
          bestI = i;
        }
      });

      if (bestI !== activeRef.current) {
        activeRef.current = bestI;
        setActive(bestI);
      }
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };

    apply();
    track.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      track.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [albums]);

  // Snap back to the first cover whenever the list changes (e.g. a new search).
  useEffect(() => {
    activeRef.current = 0;
    setActive(0);
    trackRef.current?.scrollTo({ left: 0 });
  }, [albums]);

  const handleTap = (i: number, id: string) => {
    if (i === activeRef.current) {
      onOpen(id);
      return;
    }
    trackRef.current
      ?.querySelectorAll<HTMLElement>('.cf-item')
      [i]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  };

  const current = albums[active];

  return (
    <div className="h-full flex flex-col">
      <div ref={trackRef} className="cf-track no-scrollbar flex-1">
        {albums.map((album, i) => (
          <button
            key={album.id}
            data-i={i}
            onClick={() => handleTap(i, album.id)}
            aria-label={`${album.name} — ${album.artist}`}
            className="cf-item"
          >
            <div className="cf-cover cover-shadow">
              {album.cover ? (
                <img src={album.cover} alt="" className="cf-art" />
              ) : (
                <div className="cf-art grid place-items-center bg-white/5 text-white/25">
                  <span className="w-14 h-14">
                    <Icon.Disc />
                  </span>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {current && (
        <div key={current.id} className="song-in text-center px-6 pt-3 pb-2">
          <p className="text-[17px] font-semibold leading-tight truncate">{current.name}</p>
          <p className="text-white/50 text-[14px] truncate">
            {current.artist}
            {current.year ? ` · ${current.year}` : ''}
          </p>
        </div>
      )}

      {/* Scrubber: the full catalog as a draggable strip of cover slivers. */}
      <div className="px-4 pb-28 pt-1">
        <div
          ref={scrubRef}
          role="slider"
          aria-label="Recorrer álbumes"
          aria-valuemin={0}
          aria-valuemax={albums.length - 1}
          aria-valuenow={active}
          className="cf-scrub"
          onPointerDown={(e) => {
            scrubbing.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            scrubTo(e.clientX);
          }}
          onPointerMove={(e) => {
            if (scrubbing.current) scrubTo(e.clientX);
          }}
          onPointerUp={() => {
            scrubbing.current = false;
            seekToIndex(activeRef.current, true);
          }}
          onPointerCancel={() => {
            scrubbing.current = false;
          }}
        >
          {albums.map((album, i) => (
            <span
              key={album.id}
              className={`cf-scrub-tile${i === active ? ' is-active' : ''}`}
            >
              {album.cover ? (
                <img src={album.cover} alt="" draggable={false} />
              ) : (
                <span className="cf-scrub-blank" />
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
