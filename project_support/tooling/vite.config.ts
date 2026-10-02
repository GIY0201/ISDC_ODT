import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
export default defineConfig({
  root: path.join(root, 'user_application/web'),
  resolve: { alias: [
    { find: '/static/communication', replacement: path.join(root, 'communication/browser') },
    { find: '/static/simulation', replacement: path.join(root, 'digital_twin/simulation/browser') },
    { find: '/static/visualization', replacement: path.join(root, 'digital_twin/visualization') },
    { find: '/static/scripts', replacement: path.join(root, 'user_application/web/scripts') },
    { find: '/static/styles', replacement: path.join(root, 'user_application/web/styles') },
    { find: '/static/assets', replacement: path.join(root, 'user_application/web/assets') },
  ] },
  server: { host: '127.0.0.1', port: 5173, proxy: {
    '/api': 'http://127.0.0.1:8776', '/ws': { target: 'ws://127.0.0.1:8776', ws: true }
  } },
  build: { outDir: path.join(root, 'project_support/build/web'), emptyOutDir: true },
});
