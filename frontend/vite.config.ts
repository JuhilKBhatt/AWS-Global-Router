import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey =
    env.VPN_API_KEY ||
    env.VITE_VPN_API_KEY ||
    process.env.VPN_API_KEY ||
    process.env.VITE_VPN_API_KEY ||
    '';

  return {
    plugins: [react()],
    define: {
      __APP_VPN_API_KEY__: JSON.stringify(apiKey),
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      watch: {
        usePolling: true,
      },
      proxy: {
        '/api': {
          target: process.env.BACKEND_URL || 'http://backend:8000',
          changeOrigin: true,
        },
      },
    },
  };
});
