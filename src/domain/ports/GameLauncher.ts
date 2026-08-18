import type { Game } from '../models/Game'

/** Opening things outside this application: a game, a folder, a page. */
export interface GameLauncher {
  launchGame: (game: Game) => Promise<boolean>
  openFolder: (directory: string) => Promise<boolean>
  openUrl: (url: string) => Promise<boolean>
}
