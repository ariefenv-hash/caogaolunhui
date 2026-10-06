import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' 让构建产物可以在任意静态子路径 / 本地静态服务器下直接运行
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173 },
});
