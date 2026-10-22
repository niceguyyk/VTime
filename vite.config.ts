import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.join(root, 'web'),
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.join(root, 'web', 'src') } },
  build: {
    outDir: path.join(root, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.join(root, 'web', 'index.html'),
        admin: path.join(root, 'web', 'admin', 'index.html')
      }
    }
  }
});
