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
domain      ← models, ports, errors. Knows nothing about Electron, Node or Python
application ← services and DTO mappers. Orchestrates the domain through its ports
infrastructure ← adapters: the Python CLI, HTTP, the filesystem, Electron itself
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
    models/                   Game, InstalledStore, RegistryStore, StorePaths, …
    ports/                    the interfaces the application depends on
    errors/                   DomainError and its subclasses, each with a code
  application/
    services/                 CatalogService, StoreSelectionService, …
    mappers/                  domain → DTO
  infrastructure/
    process/                  Python: locating it, running it, reading its streams
    repositories/             the port implementations
    mappers/                  engine JSON → domain
    http/                     HttpTextClient, HttpStatusError
    json/                     JsonRecord: reading data that came from elsewhere
    electron/                 ApplicationEnvironment and GameLauncher adapters
  main/
    main.ts                   the entry point: one line of work
    ElectronApplication.ts    lifecycle, single instance, self-test mode
    MainWindowFactory.ts      the window and its security settings
    composition/              ServiceContainer: the composition root
    ipc/                      IpcRouter, the controllers, the guard, argument readers
    streams/                  WindowStreamBroadcaster: the three one-way streams
    diagnostics/              SelfTestRunner
  preload/
    preload.ts                implements BridgeApi over ipcRenderer
  renderer/
    main.ts                   the entry point
    RendererApplication.ts    wires views and controllers, owns the boot decision
    BridgeAccess.ts           the typed window.storeApi
    state/                    AppStore, CategoryFilter
    views/                    one class per region of the window
    controllers/              one class per group of actions
    dom/                      Dom.ts: the DOM chores
    index.html, style.css     copied into the build as-is
  scripts/
    SmokeTest.ts              the second composition root, with no window
```

## Patterns

Every pattern in the codebase is listed here. If a change needs a pattern that is not
on this list, it belongs on this list.

### Ports and adapters

`domain/ports/*` are interfaces; `infrastructure/*` implements them; the composition
root is the only file that knows which implementation is in use. This is what makes
the Python CLI, the registry HTTP call and Electron's `shell` replaceable — by a stub
in a test, by a local endpoint in development, by a second engine later.

### Repository and Gateway

Both are ports; the distinction is what is behind them.

- **Repository** — a store of records this application owns the shape of:
  `InstalledStoreRepository`, `PreferencesRepository`, `StoreRegistryRepository`.
- **Gateway** — another program or service with its own protocol:
  `StoreCatalogGateway` (the engine).

### Service

`application/services/*` — one service per area of behaviour, no HTTP, no `fs`, no
`child_process`. A service may depend on ports and on other services, never on a
controller or a view.

### DTO and Mapper

Data crossing a boundary is a DTO, and a mapper converts. Two boundaries, two
directions:

- `infrastructure/mappers/Engine*Mapper` — engine JSON (snake_case) → domain model.
  These are the only files that know the engine's field names.
- `application/mappers/*DtoMapper` — domain model → DTO for the bridge. Decisions the
  window must not make live here: the absolute box-art URL, whether a title can be
  launched at all.

### Composition root

`main/composition/ServiceContainer.ts` for the application, `scripts/SmokeTest.ts` for
the headless check. Wiring happens in exactly these two places. No service constructs
its own adapter, and there is no service locator or global registry — dependencies
arrive through constructors.

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

Main pushes three one-way streams — log lines, progress events, busy state — through
`WindowStreamBroadcaster`, which the engine sees as an `EngineProgressListener`. The
renderer subscribes once, in `EngineStreamController`.

### State store and unidirectional flow

`renderer/state/AppStore.ts` holds the whole window state. Every mutator is named
after what it changes and notifies afterwards; `RendererApplication` re-renders every
view from the new state. Views never read each other and never hold state, so a
listing can be thrown away and rebuilt.

Screens are state, not calls. The setup screen lives in the state as
`gate: GatePresentation | null`, and that one field decides whether the gate or the
grid is drawn. While it was two imperative calls the two disagreed: the gate went up
and the empty-catalog line stayed on screen underneath it.

### Passive view

`renderer/views/*` — a view takes its DOM nodes and callbacks in the constructor and
has one `render(state)` method. It contains no decisions beyond presentation, and it
never calls the bridge.

### Error hierarchy with codes

`DomainError` is abstract with a `code`; subclasses name a single failure
(`PythonMissingError`, `StoreMissingError`, `EngineInvocationError`,
`RegistryUnavailableError`, `BusyError`). The code is what crosses the bridge.

### Frozen constant tables

`IPC_CHANNELS`, `STORE_ENGINES`, the message bundles: `as const` tables with a derived
type, so a typo is a compile error and adding an entry is the whole change. This is
the extension point for a second engine.

### Untrusted-data readers

Anything parsed from outside — engine stdout, the registry — goes through
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
| Port | `<Subject>Repository` / `Gateway` / `Locator` / `Installer` / `Launcher` | `StoreCatalogGateway` |
| Adapter | `<Technology><Port>` | `PythonStoreCatalogGateway`, `HttpStoreRegistryRepository`, `FileSystemInstalledStoreRepository` |
| Service | `<Area>Service` | `CatalogService` |
| Mapper | `<Subject>Mapper` / `<Subject>DtoMapper` | `EngineGameMapper`, `GameDtoMapper` |
| Wire type | `<Subject>Dto` | `CatalogListingDto` |
| IPC controller | `<Domain>IpcController` | `CatalogIpcController` |
| Renderer controller | `<Area>Controller` | `StoreController` |
| View | `<Region>View` | `SideMenuView`, `GameCardView` |
| Factory | `<Product>Factory` | `MainWindowFactory` |
| Error | `<Cause>Error` | `PythonMissingError` |
| Callback bag | `<Owner>Callbacks` | `SideMenuViewCallbacks` |
| Type parameter | `T`-prefixed | `TResult`, `TElement` |

Interfaces carry no `I` prefix: a port is named for what it does, and its
implementations say what they are made of.

### Methods

The verb states the contract, so a caller knows what a name will do before reading it.

| Prefix | Contract |
|---|---|
| `find…` | returns the thing or `null` / an array; absence is normal |
| `require…` | returns the thing or **throws**; absence is a fault |
| `read…` | fetches from a store, a file or a process |
| `list…` | returns a collection from somewhere outside |
| `install…`, `sync…`, `remove…`, `select…`, `update…` | changes something |
| `apply…` | writes to the renderer state store |
| `render…` | draws (views only) |
| `handle…` | an IPC or DOM event handler |
| `on…` | a callback property or subscription |
| `to…` / `from…` | a mapper conversion |
| `is…`, `has…`, `can…` | a boolean |
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

**A new engine (e.g. RetroArch).** Add an entry to `STORE_ENGINES`. The store
discovery, the home suffix and the launcher name all read from that table; the CLI has
the same command shape, so `PythonStoreCatalogGateway` is unchanged.

**A new field from the engine.** `EngineGameMapper` reads it into the model, `GameDto`
and `GameDtoMapper` carry it across if the window needs it, and a view renders it.

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
