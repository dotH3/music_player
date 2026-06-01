// The little player bar shown over the library while something is playing.
// Tapping it returns to the full player; the round button toggles playback.
import { player } from '../lib/player';
import { usePlayer } from '../hooks/usePlayer';
import * as Icon from '../ui/icons';

export function MiniBar({ onOpen }: { onOpen: (id: string) => void }) {
  usePlayer(['state', 'track']);

  const album = player.album;
  if (!album) return null;

  return (
    <button
      onClick={() => onOpen(album.id)}
      className="absolute left-3 right-3 bottom-3 z-20 flex items-center gap-3 rounded-2xl bg-white/10 backdrop-blur-xl px-3 py-2.5 text-left active:scale-[0.98] transition border border-white/10 cover-shadow safe-b"
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
  );
}
