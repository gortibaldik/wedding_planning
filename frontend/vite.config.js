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

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
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
      '/seating-arrangement': process.env.BACKEND_URL || 'http://localhost:8000'
    },
    watch: {
      usePolling: true,
      interval: 100 // ms
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
