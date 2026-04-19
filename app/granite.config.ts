import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'kbo-ranking',
  brand: {
    displayName: 'KBO 순위',
    primaryColor: '#3182F6',
    icon: 'https://static.toss.im/appsintoss/24163/20fecae8-68c8-4642-9c76-b62c77c11f00.png',
  },
  web: {
    host: 'localhost',
    port: 5173,
    commands: {
      dev: 'vite',
      build: 'vite build',
    },
  },
  permissions: [],
  outdir: 'dist',
});