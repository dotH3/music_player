// "Vinyl" browse mode: a horizontal cover-flow where the centered album sits
// flat and big while its neighbours swing back in 3D, and a spinning record
// slides out from behind the focused cover. Tap the centered cover to open it;
// tap a side cover to bring it to the center.
import { useEffect, useRef, useState } from 'react';
import type { Album } from '../types';
import * as Icon from '../ui/icons';

export function VinylFlow({ albums, onOpen }: { albums: Album[]; onOpen: (id: string) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(0); // current centered index, read by tap handler
  const [active, setActive] = useState(0);

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

        const cover = item.querySelector<HTMLElement>('.cf-cover');
        if (cover) {
          const ry = c * 48; // side covers swing on the vertical axis
          const tx = -c * 16; // pull neighbours inward so they overlap a touch
          const sc = 1 - edge * 0.18; // the centered cover is the largest
          cover.style.transform = `translateX(${tx}%) rotateY(${ry}deg) scale(${sc})`;
          cover.style.zIndex = String(1000 - Math.round(Math.abs(delta) * 100));
        }

        const disc = item.querySelector<HTMLElement>('.cf-disc');
        if (disc) {
          const peek = Math.max(0, 1 - Math.abs(delta) * 1.6); // 1 when centered
          disc.style.transform = `translateZ(-14px) translateX(${18 + peek * 30}%)`;
          disc.style.opacity = String(peek * 0.92);
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
              <div className="cf-disc">
                <div className="cf-disc-face" />
              </div>
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
        <div key={current.id} className="song-in text-center px-6 pb-28 pt-3">
          <p className="text-[17px] font-semibold leading-tight truncate">{current.name}</p>
          <p className="text-white/50 text-[14px] truncate">
            {current.artist}
            {current.year ? ` · ${current.year}` : ''}
          </p>
        </div>
      )}
    </div>
  );
}
