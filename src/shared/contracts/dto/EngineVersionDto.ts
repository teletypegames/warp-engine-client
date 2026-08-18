/** The installed engine's version, and whether this client can drive it. */
export interface EngineVersionDto {
  readonly text: string
  readonly supported: boolean
}
