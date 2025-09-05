import { defineConfig } from 'vite';

// We emit into ./dist and will keep index.html at root for now so existing tests keep working.
// All legacy script tags can progressively be replaced by a single entry bundle once migration is complete.
export default defineConfig({
  root: '.',
  server: {
    // Use the same port as the legacy python static server so existing bookmarks/tests keep working.
    port: 8080,
    strictPort: true
  },
  preview: {
    port: 8080,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      input: 'index.html'
    }
  }
});
