// The little player bar shown over the library while something is playing.
// Tapping it returns to the full player; the round button toggles playback.
import { player } from '../lib/player';
import { usePlayer } from '../hooks/usePlayer';
import * as Icon from '../ui/icons';

export function MiniBar({ onOpen }: { onOpen: (id: string) => void }) {
  usePlayer(['state', 'track', 'time']);

  const album = player.album;
  if (!album) return null;

  const progress = player.duration > 0 ? player.position / player.duration : 0;
  const deg = progress * 360;
  const accent = album.palette?.accent ?? 'rgba(255,255,255,0.75)';

  return (
    <div
      className="absolute left-3 right-3 bottom-3 z-20 rounded-2xl p-[3px] cover-shadow active:scale-[0.98] transition"
      style={{
        background: `linear-gradient(to right, ${accent} ${progress * 100}%, rgba(255,255,255,0.12) ${progress * 100}%)`,
      }}
    >
      <button
        onClick={() => onOpen(album.id)}
        className="w-full flex items-center gap-3 rounded-[13px] bg-black/40 backdrop-blur-xl px-3 py-2.5 text-left safe-b"
      >
        <div className="w-11 h-11 rounded-lg overflow-hidden bg-white/10 shrink-0">
          {album.cover && <img src={album.cover} className="w-full h-full object-cover" alt="" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium truncate">{player.current?.title || album.name}</p>
          <p className="text-[12px] text-white/50 truncate">{album.artist}</p>
        </div>
        <span
          role="button"
          aria-label="Reproducir/Pausar"
          onClick={(e) => {
            e.stopPropagation();
            player.toggle();
          }}
          className="w-9 h-9 grid place-items-center rounded-full bg-white text-black shrink-0"
        >
          <span className="w-5 h-5">{player.isPlaying ? <Icon.Pause /> : <Icon.Play />}</span>
        </span>
      </button>
    </div>
  );
}
