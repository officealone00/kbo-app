import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

import aitDevtools from "@apps-in-toss/devtools/unplugin";

// devtools(브라우저용 mock SDK·패널)는 개발 모드에서만 켠다 — 출시 번들에 섞이지 않게
export default defineConfig(({ mode }) => ({
  plugins: [mode === 'development' && aitDevtools.vite(), react()].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}));
