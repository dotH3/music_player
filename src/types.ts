// Shared domain types for the app.

export interface Track {
  title: string;
  no: number | null;
  disc: number | null;
  file: File;
}

export interface Palette {
  bg1: string;
  bg2: string;
  accent: string;
  ink: string;
  inkSoft: string;
  isDark: boolean;
}

export interface Album {
  id: string;
  name: string;
  artist: string;
  year: string;
  cover: string | null;
  tracks: Track[];
  palette: Palette | null; // computed lazily when opened
}
