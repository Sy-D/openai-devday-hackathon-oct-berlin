import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'API_');
  return { server: { port: 5173, strictPort: true, proxy: { '/api': `http://127.0.0.1:${env.API_PORT || 8789}` } } };
});
