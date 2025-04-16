import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        port: 5173,
        open: true
    },
    resolve: {
        alias: {
            'ammo.js': 'ammo.js/ammo.js'
        }
    },
    optimizeDeps: {
        include: ['three', 'ammo.js']
    },
    build: {
        sourcemap: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    three: ['three'],
                    ammo: ['ammo.js']
                }
            }
        }
    }
}); 