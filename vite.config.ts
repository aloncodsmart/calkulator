import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Relative base so the build works from any static host path (e.g. GitHub Pages).
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    // The main chunk deliberately bundles the whole content database (theorems, concepts, diagrams) for offline use.
    chunkSizeWarningLimit: 1600,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
