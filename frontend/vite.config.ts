/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const BACKEND_URL = 'http://127.0.0.1:8000';

export default defineConfig({
  plugins: [react()],
  // UI Kit подключён симлинком (file:) и не имеет своего node_modules:
  // preserveSymlinks заставляет искать react и lucide-react в frontend/node_modules,
  // dedupe не даёт попасть в бандл второй копии React.
  resolve: { dedupe: ['react', 'react-dom'], preserveSymlinks: true },
  server: { proxy: { '/api': BACKEND_URL } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    server: { deps: { inline: ['@universityrt/ui-kit'] } },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/test/**', 'src/**/*.test.{ts,tsx}'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
