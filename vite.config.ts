import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  publicDir: 'public',
  // Base path para GitHub Pages (repo: spacetimedb-test)
  base: '/spacetimedb-test/',
});
