import { RendererApplication } from './RendererApplication'

// The renderer's entry point. Errors here would otherwise be invisible: the main
// process log stays empty when the page throws, so the window says it out loud.
void new RendererApplication().start().catch((error: unknown): void => {
  console.error(error instanceof Error ? error.message : String(error))
})
