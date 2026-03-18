import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    server: {
        port: 15173,
        proxy: {
            '/admin-api': {
                target: 'http://localhost:13000',
                changeOrigin: true,
                rewrite: function (path) { return path.replace(/^\/admin-api/, ''); },
            },
            '^/lobster.*': {
                target: 'http://localhost:13000',
                changeOrigin: true,
                rewrite: function (path) { return path; },
            },
        },
    },
});
