import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'client',
  server: {
    port: 5175,
    host: '127.0.0.1',
    proxy: {
      '/api': 'http://127.0.0.1:5174',
      '/assets': 'http://127.0.0.1:5174',
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
