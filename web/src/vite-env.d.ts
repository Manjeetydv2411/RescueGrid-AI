/// <reference types="vite/client" />

/**
 * The environment variables the dashboard reads at build time.
 *
 * `VITE_*` variables are inlined by Vite when the app is built, so they are
 * part of the shipped bundle rather than a runtime secret. Only values that
 * are safe to expose to the browser belong here.
 *
 * Vite's own `ImportMetaEnv` declares an index signature, so these two
 * variables are already permitted by it. Naming them here makes the contract
 * visible in the editor and gives them a precise type instead of `any`.
 */
interface ImportMetaEnv {
  /** Base URL of the REST API. */
  readonly VITE_API_URL?: string;
  /** Socket.IO origin. Falls back to `VITE_API_URL` when unset. */
  readonly VITE_SOCKET_URL?: string;
}
