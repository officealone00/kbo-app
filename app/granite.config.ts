import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'kbo-ranking',
  brand: {
    displayName: 'KBO 순위',
    primaryColor: '#3182F6',
    // TODO: 앱인토스 콘솔에서 업로드한 아이콘 URL로 교체
    icon: 'https://static.toss.im/appsintoss/placeholder.png',
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
