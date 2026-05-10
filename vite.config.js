import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiBase = env.KYRO_API_BASE_URL || 'https://kyro-hackathon.vercel.app';
  const apiKey = env.KYRO_API_KEY || env.KYRO_API_TOKEN;

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/kyro': {
          target: apiBase,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/kyro/, '/api/v1'),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (apiKey) {
                proxyReq.setHeader('Authorization', `Bearer ${apiKey}`);
              }
            });
          },
        },
      },
    },
  };
});
