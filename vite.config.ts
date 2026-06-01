import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  // Make every `react` / `react-dom` import resolve to the same copy, so dev
  // pre-bundling can't end up with two React instances (→ "Invalid hook call").
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: true, // expose on LAN so you can open it from your phone
    port: 5173,
  },
  build: {
    target: 'es2022',
  },
});
