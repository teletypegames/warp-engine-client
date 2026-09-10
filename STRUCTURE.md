# Structure

This is the map of the client: which layer may know about which, what every kind of
class is called, and which pattern is used where. It is written to be read before
adding anything — the point of the layout is that a new feature has an obvious place.

The application drives a program that **installs and deletes files**. That is why the
rules below are strict rather than tasteful: an implicit `any` or a filesystem path
that reaches the window is a safety question, not a style one.

## The layers

```
shared      ← contracts and strings both sides need (no logic, no I/O)
domain      ← models, ports, errors. Knows nothing about Electron or Node
application ← services and DTO mappers. Orchestrates the domain through its ports
infrastructure ← adapters: the store engine, HTTP, the filesystem, Electron itself
main        ← the Electron host: window, IPC controllers, composition root
preload     ← the bridge, and only the bridge
renderer    ← the window: state store, views, controllers
```

**The dependency rule: imports point inward.** `domain` imports nothing but `shared`.
`application` imports `domain` and `shared`. `infrastructure` implements `domain`
ports. `main`, `preload` and `renderer` are hosts: they may import inward, and nothing
imports them. There is no barrel file and no `index.ts` re-export — every import names
the module it needs, so a cycle is visible in the diff that creates it.

Two consequences worth stating, because they are the reason the layout pays for
itself:

- **`domain` and `application` never import `electron`.** The smoke test assembles the
  same services with no Electron at all (`src/scripts/SmokeTest.ts`), which is how the
  catalog is exercised in a terminal.
- **The renderer never receives a filesystem path it could act on.** `GameDto` has no
  paths; a launch is asked for by name and resolved in the main process.

## The tree

```
src/
  shared/
    contracts/
      IpcChannels.ts          every channel name, frozen, in one table
      BridgeApi.ts            the whole surface the window gets
      dto/                    what crosses the bridge: plain, JSON-safe data
    i18n/
      EnglishMessages.ts      the key set, and the English bundle
      HungarianMessages.ts    typed against those keys
      MessageBundle.ts        MessageBundle, Locale, LOCALES
      TranslationCatalog.ts   locale resolution and bundle lookup
  domain/
    models/                   Game, InstalledStore, RegistryStore, StorePaths, Brand, CatalogPage, …
    ports/                    the interfaces the application depends on
    errors/                   DomainError and its subclasses, each with a code
  application/
    services/                 CatalogService, StoreSelectionService, …
    mappers/                  domain → DTO: Game, InstalledStore, RegistryStore, Brand,
                              StorePaths, Account
  infrastructure/
    engine/                   the store engine, in process
      NativeStoreCatalogGateway   the StoreCatalogGateway port: every catalog operation
      CatalogClient           the catalog and its files over HTTP, cached beside the store
      CatalogSurveyor         which titles this machine can install, and why not the rest
      ReleasePicker           the release carrying the asset kind the host wants
      HostMachineDetector     the operating system and architecture, as the store names them
      DesktopLayoutResolver   where payloads, icons and menu entries go on this host
      GameInstaller           install, upgrade, remove, prune — the writes
      PayloadInstaller        download, unpack, find the program to launch
      StoreConfigurationReader  config.json → StoreConfiguration
      StoreStateRepository    state.json → InstalledRecord, and back
      EngineGameMapper        survey entry + installed record + labels → Game
      PlatformLabels, PlatformLabelsClient  what the catalog calls its platforms (GET /api/builds)
      CatalogVocabulary, VocabularyClient  what the catalog calls its categories (GET /api/software/vocabulary)
      ServiceDescriptorClient what the catalog's server says it offers (GET /api/service)
      DeviceSignInClient      the device authorization grant, client side
      dialects/               one per WarpEngine version's catalog shape
      launchers/              .desktop, .app bundle, .lnk — the three hosts
    archive/                  ZipArchive: a zip reader over node:zlib
    files/                    StoreFileSystem: atomic writes and the delete guard;
                              Paths: home and variable expansion, the containment check
    repositories/             the port implementations, including the null credential
                              store a headless run is wired with
    http/                     HttpTextClient, StoreHttpClient, HttpStatusError
    json/                     JsonRecord: reading data that came from elsewhere
    config/                   BuildConfiguration: what was decided when this was packaged
    electron/                 ApplicationEnvironment, GameLauncher, and the keychain
                              credential store
  main/
    main.ts                   the entry point: one line of work
    ElectronApplication.ts    lifecycle, single instance, self-test mode
    MainWindowFactory.ts      the window and its security settings
    composition/              ServiceContainer: the composition root
    ipc/                      IpcRouter, the controllers, the guard, argument readers
    streams/                  WindowStreamBroadcaster: the four one-way streams
    diagnostics/              SelfTestRunner
  preload/
    preload.ts                implements BridgeApi over ipcRenderer
  renderer/
    main.ts                   the entry point
    RendererApplication.ts    wires views and controllers, owns the boot decision
    BridgeAccess.ts           the typed window.storeApi
    state/                    AppStore, CatalogFilter, GatePresentation,
                              ClientUpdatePresentation, SettingsTab
    views/                    one class per region of the window, the settings dialog
                              included; Listing is what the grid and the list share
    controllers/              one class per group of actions
    dom/                      Dom.ts: the DOM chores; Icon.ts: the drawn glyphs
    index.html, style.css     copied into the build as-is
  scripts/
    SmokeTest.ts              the second composition root, with no window
    StoreLifecycleTest.ts     the third: adding and removing a store under a temporary root
```

A second `scripts/` sits beside `src/` and is not part of the application: the esbuild
and icon build steps, the packaging hook and the release shell scripts.

## Patterns

Every pattern in the codebase is listed here. If a change needs a pattern that is not
on this list, it belongs on this list.

### Ports and adapters

`domain/ports/*` are interfaces; `infrastructure/*` implements them; the composition
root is the only file that knows which implementation is in use. This is what makes the
store engine, the registry HTTP call and Electron's `shell` replaceable — by a stub in a
test, by a local endpoint in development, by a second host's engine later.

It has already paid for itself once: the engine used to be a Python CLI driven as a child
process, and replacing it with one that runs in process was a new adapter behind the same
port. Nothing in `application`, `main` or `renderer` changed shape for it.

### Repository and Gateway

Both are ports; the distinction is what is behind them.

- **Repository** — a store of records this application owns the shape of:
  `InstalledStoreRepository`, `PreferencesRepository`, `StoreRegistryRepository`.
- **Gateway** — something with a protocol of its own, whether or not it is another
  process: `StoreCatalogGateway` (the store engine), which today is
  `NativeStoreCatalogGateway` in this application and was a Python CLI before it. The port
  stays async because the work is: it downloads and unpacks. `ClientReleaseGateway` is the
  forge's release list, read by `HttpClientReleaseGateway` for the update check.

### Service

`application/services/*` — one service per area of behaviour, no HTTP, no `fs`, no
`child_process`. A service may depend on ports and on other services, never on a
controller or a view.

### DTO and Mapper

Data crossing a boundary is a DTO, and a mapper converts. Two boundaries, two
directions:

- `infrastructure/engine/dialects/*` — catalog JSON → typed catalog records. These are
  the only files that know a WarpEngine version's field names.
- `infrastructure/engine/StoreConfigurationReader`, `StoreStateRepository` — the two
  snake_case files on disk → domain models. These are the only files that know the on-disk
  field names, which are the shell engine's and stay that way.
- `application/mappers/*DtoMapper` — domain model → DTO for the bridge. Decisions the
  window must not make live here: the absolute box-art URL, whether a title can be
  launched at all.

### Composition root

`main/composition/ServiceContainer.ts` for the application, `scripts/SmokeTest.ts` for
the headless check, `scripts/StoreLifecycleTest.ts` for the store lifecycle under a
sandbox. Wiring happens in exactly these three places. No service constructs its own
adapter, no constructor parameter has a default that is an adapter, and there is no
service locator or global registry — dependencies arrive through constructors.

### Controller and Router

`main/ipc/*IpcController` register their channels on `IpcRouter` and translate a
channel invocation into one service call. They validate their arguments
(`IpcArguments.ts`) and map results through DTO mappers. The router normalises errors
so a `DomainError` crosses as `CODE: message`.

Renderer controllers (`renderer/controllers/*`) are the mirror image: a user action
becomes one bridge call and one write to the state store.

### Single flight

`SingleFlightGuard` — one engine call at a time, because the store writes files and
two writers would race. It reports its state, which is what lets the window disable
exactly the controls that would start a second call and leave the filters and the log
alive.

### Observer streams

Main pushes four one-way streams — log lines, progress events, busy state, and catalog
pages — through `WindowStreamBroadcaster`, which the engine sees as an
`EngineProgressListener`. The renderer subscribes once, in `EngineStreamController`. The
catalog-page stream carries a whole `CatalogListingDto` built from the pages read so far,
by the same mapping the final answer gets, so the window never has two ways to draw a
title. `Listing.ts` keeps one render-time memory beside the state — which list it last
drew, per container — so a page arriving does not reset a scroll; like
`SideMenuView.renderLocales`, it decides nothing, it only avoids a jump.

### State store and unidirectional flow

`renderer/state/AppStore.ts` holds the whole window state. Every mutator is named
after what it changes and notifies afterwards; `RendererApplication` re-renders every
view from the new state. Views never read each other and never hold state, so a
listing can be thrown away and rebuilt.

Screens are state, not calls. The settings dialog is `settingsOpen` and `settingsTab`,
and the `<dialog>` follows both; its own close reports back rather than acting. The setup screen lives in the state as
`gate: GatePresentation | null`, and that one field decides whether the gate or the
grid is drawn. While it was two imperative calls the two disagreed: the gate went up
and the empty-catalog line stayed on screen underneath it.

### Passive view

`renderer/views/*` — a view takes its DOM nodes and callbacks in the constructor and
has one `render(state)` method. It contains no decisions beyond presentation, and it
never calls the bridge.

### Error hierarchy with codes

`DomainError` is abstract with a `code`; subclasses name a single failure
(`StoreMissingError`, `EngineInvocationError`, `RegistryUnavailableError`, `BusyError`).
The code is what crosses the bridge.

### Frozen constant tables

`IPC_CHANNELS`, `STORE_ENGINES`, the message bundles: `as const` tables with a derived
type, so a typo is a compile error and adding an entry is the whole change. This is
the extension point for a second engine.

### Build-time configuration

`infrastructure/config/BuildConfiguration.ts` reads the packaged `package.json`, which is
where a build records the registry it was made for (`warpEngine.registryUrl`, set by
`make dist STORES_API=…`). Precedence is runtime environment, then build, then the
built-in default — most specific first, and each one is a different audience: someone
trying it out, someone shipping a client for another site, us.

### Untrusted-data readers

Anything parsed from outside — the catalog, a store's config, the state file, the
registry — goes through
`infrastructure/json/JsonRecord.ts`: `unknown` in, a typed value with a stated
fallback out. No `as` casts on foreign data.

## Naming

The names are a pattern, not a preference, and are checked by
`@typescript-eslint/naming-convention` where a linter can check them.

### Files

- One primary export per file; the filename is the subject in `PascalCase`
  (`CatalogService.ts`, `GameDto.ts`).
- A file whose primary export is a constant table is named for the table, and the
  export is its `UPPER_SNAKE_CASE` form (`IpcChannels.ts` exports `IPC_CHANNELS`).
- Directories are lowercase and plural where they hold several of a kind (`models`,
  `ports`, `views`, `services`).

### Types and classes

| Kind | Pattern | Example |
|---|---|---|
| Domain model | plain noun, no suffix | `Game`, `InstalledStore` |
| Port | `<Subject>Repository` / `Gateway` / `Locator` / `Installer` / `Launcher` / `Environment` | `StoreCatalogGateway` |
| Adapter | `<Technology><Port>` | `NativeStoreCatalogGateway`, `HttpStoreRegistryRepository`, `FileSystemInstalledStoreRepository` |
| Service | `<Area>Service` | `CatalogService` |
| Mapper | `<Subject>Mapper` / `<Subject>DtoMapper` | `EngineGameMapper`, `GameDtoMapper` |
| Wire type | `<Subject>Dto` | `CatalogListingDto` |
| IPC controller | `<Domain>IpcController` | `CatalogIpcController` |
| Renderer controller | `<Area>Controller` | `StoreController` |
| View | `<Region>View` | `SideMenuView`, `GameCardView` |
| Factory | `<Product>Factory` | `MainWindowFactory` |
| Error | `<Cause>Error` | `StoreMissingError` |
| Callback bag | `<Owner>Callbacks` | `SideMenuViewCallbacks` |
| Type parameter | `T`-prefixed | `TResult`, `TElement` |

Interfaces carry no `I` prefix: a port is named for what it does, and its
implementations say what they are made of.

### Methods

The verb states the contract, so a caller knows what a name will do before reading it.

| Prefix | Contract |
|---|---|
| `find…` | returns the thing or `null` / an array; absence is normal, and nothing changes |
| `require…` | returns the thing or **throws**; absence is a fault |
| `read…` | fetches from a store, a file or a process |
| `list…` | returns a collection from somewhere outside |
| `resolve…` | computes a path, a URL or a layout from configuration; no I/O |
| `install…`, `sync…`, `remove…`, `select…`, `update…`, `adopt…`, `forget…` | changes something |
| `offer…`, `toggle…` | changes what is on screen, through the state |
| `apply…` | writes to the renderer state store |
| `publish…` | pushes onto a one-way stream to the window |
| `render…` | draws (views only) |
| `create…` | builds a DOM node (views only) |
| `handle…` | an IPC or DOM event handler |
| `on…` | a callback property or subscription |
| `to…` / `from…` | a mapper conversion |
| `is…`, `has…`, `can…`, `matches…` | a boolean |
| `describe…` | turns something into a message for a person |

Booleans read as assertions (`supported`, `installed`, `launchable`, `busy`), never
`flag` or `status`.

## Type rules

- `strict`, plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `noImplicitOverride`, `noImplicitReturns`, `noPropertyAccessFromIndexSignature`,
  `noFallthroughCasesInSwitch`, `isolatedModules`.
- **Every signature is annotated** — parameters, return types, class properties —
  including where inference would manage: `explicit-function-return-type`,
  `explicit-module-boundary-types` and `typedef` are errors.
- Data is `readonly`: DTO and model fields, and arrays as `readonly T[]`.
- No `any`, no non-null `!`, no unchecked casts. Foreign data goes through
  `JsonRecord`; DOM lookups go through `requireElement`, which checks the element type
  it was asked for.
- Exhaustive `switch` over union types, checked by `switch-exhaustiveness-check` — the
  sync-event union is handled that way on purpose.

`erasableSyntaxOnly` is deliberately **off**: constructor parameter properties are how
dependencies are declared here, and that is worth more than being strippable by
`node --experimental-strip-types`.

## How to add things

**A new bridge call.** Add the channel to `IPC_CHANNELS`, the method to `BridgeApi`,
the implementation to `preload.ts`, a `handle…` method to the right controller, and the
behaviour to a service. The compiler names every file you missed.

**A new engine (e.g. RetroArch).** Add an entry to `STORE_ENGINES` — the store discovery,
the home suffix and the launcher name all read from that table — and a `StoreCatalogGateway`
implementation for that host. Everything above the port is unchanged.

**A new WarpEngine version.** Add it to `SUPPORTED_WARP_ENGINE_VERSIONS`. The build then
fails in `selectCatalogDialect` until the switch says which `CatalogDialect` reads it:
either an existing one, when the catalog's shape did not change, or a new one beside
`SoftwareListCatalogDialect`.

**A new field from the catalog.** The dialect reads it into `CatalogSoftware`,
`CatalogRelease` or `CatalogAsset`; `SelectedGame` and `Game` carry it if the survey or the
window needs it; `GameDto` and `GameDtoMapper` take it across the bridge.

**A new language.** Add `<Language>Messages.ts` typed as `MessageBundle`, add the code
to `LOCALES` and the bundle to `TranslationCatalog`. A missing key will not compile.

## Build layout

`tsc` compiles the main process to CommonJS in `build/`. The preload and the renderer
are **bundled** by esbuild into one file each (`build/preload/preload.js`,
`build/renderer/app.js`), because a sandboxed preload may not require its own modules
and a module script over `file://` is blocked by the page's origin rules. `index.html`
and `style.css` are copied. `electron-builder` ships `build/**` and nothing else.

`make check` is the gate: `typecheck`, `lint`, then the two test suites — the cheapest
check that can fail runs first.
