import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import * as sass from 'sass'
import fs from 'fs'

function compileSassToPublic(entries) {
  return {
    name: 'compile-sass-to-public',
    buildStart() {
      for (const [input, output] of Object.entries(entries)) {
        const result = sass.compile(input)
        fs.writeFileSync(output, result.css)
      }
    },
    handleHotUpdate({ file, server }) {
      for (const [input, output] of Object.entries(entries)) {
        if (file === input) {
          const result = sass.compile(input)
          fs.writeFileSync(output, result.css)
          server.ws.send({ type: 'full-reload' })
          return []
        }
      }
    }
  }
}

// In production the backend serves the built games.html at the extensionless
// /games. The dev server would instead hand /games to the SPA history fallback,
// so rewrite it before that middleware sees it and the two match.
function extensionlessPage(urlPath, file) {
  return {
    name: 'extensionless-page',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url === urlPath) req.url = file
        next()
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    extensionlessPage('/games', '/games.html'),
    compileSassToPublic({
      [path.resolve(__dirname, 'src/landing.scss')]: path.resolve(__dirname, 'public/landing.css')
    })
  ],
  server: {
    proxy: {
      '^/$': process.env.BACKEND_URL || 'http://localhost:8000',
      '/auth': process.env.BACKEND_URL || 'http://localhost:8000',
      '/invitation-lists': process.env.BACKEND_URL || 'http://localhost:8000',
      '/family-structure': process.env.BACKEND_URL || 'http://localhost:8000',
      '/seating-arrangement': process.env.BACKEND_URL || 'http://localhost:8000',
      '/finance': process.env.BACKEND_URL || 'http://localhost:8000',
      '/managed-files': process.env.BACKEND_URL || 'http://localhost:8000'
      // '/games' is intentionally NOT proxied: it is a Vite entry point of its
      // own (see build.rollupOptions.input), so the dev server serves it
      // directly and the game gets HMR.
    },
    watch: {
      usePolling: true,
      interval: 100 // ms
    }
  },
  // Multi-page build: the SPA plus the standalone static games page. Both are
  // emitted as plain HTML into dist/ and served from there by the backend.
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        games: path.resolve(__dirname, 'games.html')
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  test: {
    globals: true,
    environment: 'happy-dom'
  }
})
