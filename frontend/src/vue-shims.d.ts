/**
 * `tsc` does not parse .vue files, so it needs a declaration to resolve them.
 * Only TypeScript entry points hit this (the SPA entry is plain JS, which is
 * not type-checked); Vite resolves the real components at build time.
 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<object, object, unknown>
  export default component
}
