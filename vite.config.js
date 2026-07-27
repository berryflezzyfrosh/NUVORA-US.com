import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    include: ['@supabase/supabase-js'],
  },
  server: {
    host: true,
  },
});
