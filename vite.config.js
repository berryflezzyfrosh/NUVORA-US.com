import { defineConfig } from 'vite';

export default defineConfig({
  base: '/NUVORA-US.com/',
  optimizeDeps: {
    include: ['@supabase/supabase-js'],
  },
  server: {
    host: true,
  },
});
