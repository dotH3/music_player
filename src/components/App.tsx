// Top-level controller: owns app state (library / now-playing), the folder
// picker, and ties the audio player to the views.
import { useCallback, useEffect, useRef, useState } from 'react';
import { scanFiles } from '../lib/scanner';
import { extractPalette } from '../lib/color';
import type { Album } from '../types';
import { Library } from './Library';
import { NowPlaying } from './NowPlaying';
import { MiniBar } from './MiniBar';

export type Status = 'empty' | 'loading' | 'ready';
type View = 'library' | 'now';

export function App() {
  const [status, setStatus] = useState<Status>('empty');
  const [albums, setAlbums] = useState<Album[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [view, setView] = useState<View>('library');
  const [openId, setOpenId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // The folder picker needs non-standard attributes set imperatively.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.setAttribute('webkitdirectory', '');
    el.setAttribute('directory', '');
  }, []);

  const handleFiles = useCallback(async (files: FileList) => {
    setStatus('loading');
    setProgress({ done: 0, total: 0 });

    let last = 0;
    const result = await scanFiles(files, (done, total) => {
      const now = Date.now();
      if (now - last > 200) {
        last = now;
        setProgress({ done, total });
      }
    });

    setAlbums(result);
    setStatus(result.length ? 'ready' : 'empty');
    setView('library');
  }, []);

  const pickFolder = useCallback(() => inputRef.current?.click(), []);

  const openAlbum = useCallback(
    async (id: string) => {
      const album = albums.find((a) => a.id === id);
      if (!album) return;
      if (!album.palette) album.palette = await extractPalette(album.cover);
      // Open the album without auto-playing — the user picks a track (or play).
      setOpenId(id);
      setView('now');
    },
    [albums]
  );

  const goLibrary = useCallback(() => setView('library'), []);

  const openAlbumObj = albums.find((a) => a.id === openId) ?? null;

  return (
    <div className="relative h-full w-full">
      {view === 'now' && openAlbumObj ? (
        <NowPlaying album={openAlbumObj} onBack={goLibrary} />
      ) : (
        <>
          <Library
            albums={albums}
            status={status}
            progress={progress}
            onPick={pickFolder}
            onOpen={openAlbum}
          />
          {status === 'ready' && <MiniBar onOpen={openAlbum} />}
        </>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          const f = e.target.files;
          if (f?.length) void handleFiles(f);
        }}
      />
    </div>
  );
}
