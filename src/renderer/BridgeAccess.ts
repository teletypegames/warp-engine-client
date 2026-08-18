import { BRIDGE_GLOBAL_NAME, type BridgeApi } from '../shared/contracts/BridgeApi'

declare global {
  interface Window {
    readonly storeApi?: BridgeApi
  }
}

/**
 * The bridge the preload published.
 *
 * Absent means the preload did not run, which is a packaging fault rather than a
 * runtime condition — so it fails here, once, with a sentence that says what happened.
 */
export function requireBridge (): BridgeApi {
  const bridge = window.storeApi
  if (bridge === undefined) {
    throw new Error(`window.${BRIDGE_GLOBAL_NAME} is missing — the preload script did not run`)
  }
  return bridge
}
