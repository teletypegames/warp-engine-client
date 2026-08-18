import type { EngineProgressListener } from '../models/EngineProgress'
import type { InstalledStore } from '../models/InstalledStore'
import type { RegistryStore } from '../models/RegistryStore'

/**
 * Setting up a store where there is none.
 *
 * This is why the client exists on Windows at all: the store's own installer is
 * `curl … | sh`, which Windows does not have.
 */
export interface StoreEngineInstaller {
  installEngine: (
    home: string,
    store: RegistryStore,
    progress?: EngineProgressListener
  ) => Promise<InstalledStore>
}
