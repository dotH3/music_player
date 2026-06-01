// App icons, sourced from lucide-react and re-exported under stable names so
// the rest of the UI doesn't depend on lucide directly. Each icon fills its
// wrapper (w-full h-full), so size it with a sized parent (e.g. w-5 h-5).
import {
  Play as LucidePlay,
  Pause as LucidePause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  Folder as LucideFolder,
  Disc as LucideDisc,
  Disc3 as LucideDisc3,
  Search as LucideSearch,
  X,
  type LucideIcon,
} from 'lucide-react';

// Wrap a lucide icon with our defaults. `solid` fills the shape (used for the
// transport controls, so play/pause read clearly on the white button).
function wrap(Icon: LucideIcon, solid = false) {
  return function WrappedIcon() {
    return (
      <Icon
        className="w-full h-full"
        strokeWidth={1.8}
        {...(solid ? { fill: 'currentColor' } : {})}
      />
    );
  };
}

export const Play = wrap(LucidePlay, true);
export const Pause = wrap(LucidePause, true);
export const Prev = wrap(SkipBack, true);
export const Next = wrap(SkipForward, true);
export const Back = wrap(ChevronLeft);
export const Folder = wrap(LucideFolder);
export const Disc = wrap(LucideDisc);
export const Vinyl = wrap(LucideDisc3);
export const Search = wrap(LucideSearch);
export const Close = wrap(X);
