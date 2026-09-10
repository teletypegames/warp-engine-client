import type { EngineProgressListener } from '../../domain/models/EngineProgress'
import type { InstalledStore } from '../../domain/models/InstalledStore'
import type { RegistryStore } from '../../domain/models/RegistryStore'
import { deriveStoreId } from '../../domain/models/StoreIdentity'
import type { InstalledStoreRepository } from '../../domain/ports/InstalledStoreRepository'
import type { StoreEngineInstaller } from '../../domain/ports/StoreEngineInstaller'
import type { StoreCatalogGateway } from '../../domain/ports/StoreCatalogGateway'
import type { StoreRegistryRepository } from '../../domain/ports/StoreRegistryRepository'
import type { StoreSelectionService } from './StoreSelectionService'

/**
 * Getting a store onto this machine.
 *
 * Which stores exist is the site's answer — this asks the registry and installs
 * what was chosen, into the folder the shell installer would have used. The newly
 * installed store becomes the open one, so the window can carry straight on.
 */
export class StoreProvisioningService {
  public constructor (
    private readonly registry: StoreRegistryRepository,
    private readonly installer: StoreEngineInstaller,
    private readonly stores: InstalledStoreRepository,
    private readonly selection: StoreSelectionService,
    private readonly catalogGateway: StoreCatalogGateway
  ) {}

  public get registryUrl (): string {
    return this.registry.sourceUrl
  }

  public async listAvailableStores (): Promise<readonly RegistryStore[]> {
    return this.registry.listStores()
  }

  /**
   * Install the chosen store.
   *
   * The window's choice is taken at face value, which is safe because a record is only a
   * name and a catalog: there is no path in it and nothing that decides what may be
   * deleted. The store's own configuration is written by the installer from the engine's
   * defaults, so the renderer cannot influence where anything lands.
   */
  public async installStore (
    store: RegistryStore,
    progress?: EngineProgressListener
  ): Promise<InstalledStore> {
    const home = this.stores.resolveDefaultHome(deriveStoreId(store))
    const installed = await this.installer.installEngine(home, store, progress)
    return this.selection.adoptStore(installed)
  }

  /**
   * A catalog the registry does not offer.
   *
   * Nothing about installing changes — a record is still a name and a catalog, and the
   * configuration still comes from the engine's defaults. What differs is only where
   * the two fields came from, which is why this hands the same record to the same
   * method rather than growing a second path.
   *
   * The name is derived from the host when none is given: it is a label for the picker,
   * and asking somebody to invent one before they can try a URL is a question with no
   * useful answer.
   */
  public async installCatalog (
    catalogUrl: string,
    name: string | null = null,
    progress?: EngineProgressListener
  ): Promise<InstalledStore> {
    const url = normaliseCatalogUrl(catalogUrl)
    const chosen: RegistryStore = { name: name?.trim() ?? '', catalogUrl: url }
    return await this.installStore(
      chosen.name.length > 0 ? chosen : { ...chosen, name: readHostName(url) },
      progress
    )
  }

  /**
   * Remove a store: everything it installed, then the store itself.
   *
   * Whichever store is open afterwards is decided by re-reading the disk rather than
   * guessed at here — removing the open one has to leave the window pointing at
   * something that exists, and that answer lives in one place.
   */
  public async removeStore (store: InstalledStore, progress?: EngineProgressListener): Promise<void> {
    await this.catalogGateway.removeStore(store, progress)
    this.selection.forgetStore(store)
  }

  /**
   * Give a store another name.
   *
   * Only the name: the catalog is what a store *is*, and the id, the home and the game
   * folder are all derived from it, so changing it would leave a store's files under
   * another store's identity. Somebody who wants a different catalog removes this one
   * and adds that one. The open store is re-adopted so the cached record says the new
   * name too.
   */
  public renameStore (store: InstalledStore, name: string, progress?: EngineProgressListener): InstalledStore {
    const renamed = this.stores.renameStore(store.home, name, progress)
    if (this.selection.readCurrentStore()?.home === renamed.home) this.selection.adoptStore(renamed)
    return renamed
  }
}

/**
 * What somebody typed, as a URL this can be used as.
 *
 * Two liberties taken on purpose, because both are what a person means: a bare host
 * gets https, and a trailing slash goes. Anything still unparseable is refused here
 * rather than at the first fetch — a store home written for a bad URL is a directory
 * somebody has to find and delete.
 */
function normaliseCatalogUrl (value: string): string {
  const trimmed = value.trim()
  if (trimmed.length === 0) throw new Error('a catalog address is needed')

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  let parsed: URL
  try {
    parsed = new URL(withScheme)
  } catch {
    throw new Error(`not a usable address: ${value}`)
  }
  // A URL can parse and still have no host — `http://` does. That one used to slip
  // through and become a store called "http", because the trailing slashes were being
  // stripped *before* the scheme was checked, turning `http://` into `http:` and then
  // into `https://http:`.
  if (parsed.hostname.length === 0) throw new Error(`not a usable address: ${value}`)

  // Rebuilt from the parsed URL rather than from the string: it drops the query and
  // the fragment — a catalog is a base address, not a request — and settles the
  // trailing slash in one place instead of at every call site that appends a path.
  return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '')
}

function readHostName (catalogUrl: string): string {
  try {
    return new URL(catalogUrl).hostname.replace(/^www\./, '')
  } catch {
    return catalogUrl
  }
}
