// The home screen: a grid of album covers with a search box. Tapping a cover
// opens the player. Empty / loading states share the same bleed background.
import { useState } from 'react';
import type { Album } from '../types';
import type { Status } from './App';
import * as Icon from '../ui/icons';
import { VinylFlow } from './VinylFlow';

type ViewMode = 'grid' | 'vinyl';

interface LibraryProps {
  albums: Album[];
  status: Status;
  progress: { done: number; total: number };
  onPick: () => void;
  onOpen: (id: string) => void;
}

export function Library({ albums, status, progress, onPick, onOpen }: LibraryProps) {
  const [query, setQuery] = useState('');
  const [view, setView] = useState<ViewMode>(
    () => (localStorage.getItem('cb-view') as ViewMode) || 'grid'
  );
  const toggleView = () =>
    setView((v) => {
      const next: ViewMode = v === 'grid' ? 'vinyl' : 'grid';
      localStorage.setItem('cb-view', next);
      return next;
    });

  if (status !== 'ready') {
    return <EmptyState status={status} progress={progress} onPick={onPick} />;
  }

  const q = normalize(query.trim());
  const list = q ? albums.filter((a) => matchesAlbum(a, q)) : albums;

  return (
    <div className="relative h-full w-full bleed grain overflow-hidden">
      <div className="relative z-10 h-full flex flex-col">
        <header className="safe-t px-5 pb-3 flex items-end justify-between">
          <div>
            <h1 className="text-[26px] leading-none font-semibold tracking-tight">Tu música</h1>
            <p className="text-white/45 text-sm mt-1">
              {albums.length} álbum{albums.length === 1 ? '' : 'es'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleView}
              aria-label={view === 'vinyl' ? 'Vista cuadrícula' : 'Vista vinilo'}
              className={`shrink-0 w-10 h-10 grid place-items-center rounded-full transition ${
                view === 'vinyl'
                  ? 'bg-white text-black'
                  : 'bg-white/10 active:bg-white/20 text-white/80'
              }`}
            >
              <span className="w-5 h-5">
                <Icon.Vinyl />
              </span>
            </button>
            <button
              onClick={onPick}
              aria-label="Elegir carpeta"
              className="shrink-0 w-10 h-10 grid place-items-center rounded-full bg-white/10 active:bg-white/20 transition"
            >
              <span className="w-5 h-5 text-white/80">
                <Icon.Folder />
              </span>
            </button>
          </div>
        </header>

        <div className="px-5 pb-3">
          <div className="relative flex items-center">
            <span className="absolute left-3.5 w-[18px] h-[18px] text-white/40 pointer-events-none">
              <Icon.Search />
            </span>
            <input
              type="search"
              enterKeyHint="search"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar álbum, artista o canción"
              className="w-full rounded-full bg-white/10 focus:bg-white/[0.14] border border-white/10 focus:border-white/20 pl-11 pr-11 py-2.5 text-[15px] placeholder:text-white/40 outline-none transition"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2 w-7 h-7 grid place-items-center rounded-full bg-white/10 active:bg-white/20 text-white/70 transition"
              >
                <span className="w-4 h-4">
                  <Icon.Close />
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0">
          {!list.length ? (
            <div className="flex flex-col items-center justify-center text-center pt-24 text-white/45">
              <span className="w-9 h-9 mb-3 text-white/30">
                <Icon.Search />
              </span>
              <p className="text-[15px]">
                Nada coincide con
                <br />
                <span className="text-white/70">“{query.trim()}”</span>
              </p>
            </div>
          ) : view === 'vinyl' ? (
            <VinylFlow albums={list} onOpen={onOpen} />
          ) : (
            <div className="h-full overflow-y-auto no-scrollbar px-5 pb-28 pt-1">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-6">
                {list.map((album) => (
                  <AlbumCard key={album.id} album={album} onOpen={onOpen} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AlbumCard({ album, onOpen }: { album: Album; onOpen: (id: string) => void }) {
  return (
    <button onClick={() => onOpen(album.id)} className="album-card text-left group">
      <div className="aspect-square w-full rounded-xl overflow-hidden bg-white/5 cover-shadow">
        {album.cover ? (
          <img src={album.cover} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center text-white/25">
            <span className="w-10 h-10">
              <Icon.Disc />
            </span>
          </div>
        )}
      </div>
      <div className="mt-2 px-0.5">
        <p className="text-[15px] font-medium leading-tight truncate">{album.name}</p>
        <p className="text-[13px] text-white/45 truncate">{album.artist}</p>
      </div>
    </button>
  );
}

function EmptyState({
  status,
  progress,
  onPick,
}: {
  status: Exclude<Status, 'ready'>;
  progress: { done: number; total: number };
  onPick: () => void;
}) {
  return (
    <div className="relative h-full w-full bleed grain overflow-hidden">
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-8 text-center safe-t safe-b fade-up">
        <div className="mb-8 opacity-90">
          <div className="grid grid-cols-2 gap-2 rotate-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-16 h-16 rounded-lg ${i % 3 === 0 ? 'bg-white/14' : 'bg-white/8'}`}
              />
            ))}
          </div>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mb-2">Cover&nbsp;Bleed</h1>
        <p className="text-[15px] text-white/55 max-w-xs leading-relaxed mb-8">
          {status === 'loading'
            ? `Leyendo tu música… ${progress.total ? `${progress.done}/${progress.total}` : ''}`
            : 'Elegí la carpeta donde guardás tus álbumes y los vas a ver todos acá.'}
        </p>
        {status === 'loading' ? (
          <div className="w-7 h-7 rounded-full border-2 border-white/20 border-t-white/80 spin" />
        ) : (
          <button
            onClick={onPick}
            className="inline-flex items-center gap-2 rounded-full bg-white text-black font-medium px-6 py-3 active:scale-95 transition"
          >
            <span className="w-5 h-5">
              <Icon.Folder />
            </span>{' '}
            Elegir carpeta
          </button>
        )}
      </div>
    </div>
  );
}

// Accent- and case-insensitive substring match across the album's fields.
function matchesAlbum(album: Album, q: string): boolean {
  if (normalize(album.name).includes(q)) return true;
  if (normalize(album.artist).includes(q)) return true;
  if (album.year && String(album.year).includes(q)) return true;
  return album.tracks.some((t) => normalize(t.title).includes(q));
}

function normalize(s = ''): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}
