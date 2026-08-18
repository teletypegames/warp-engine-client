# warp-engine-desktop-gui — a window for the desktop store

A graphical client for
[`warp-engine-desktop-store`](https://git.teletypegames.org/stores/warp-engine-desktop-store):
the catalog as a grid of cards, one click to install a title into your own
application menu, one to play it, one to remove it. Linux, macOS and Windows.

The CLI stays the product; this is its front door. Every action here runs
`desktop_store.py`, so there is one catalog logic, one state file and one delete
guard — the window never touches the filesystem itself.

It is also **the Windows install path**. The store's own installer is
`curl … | sh`, which Windows does not have; this app downloads the store engine
itself, into the same folder the shell installer would use.

Which store it installs is not baked in: the client asks a registry — `GET
/api/stores` on the site — and each record says what the store is called, which
catalog it serves and where its configuration lives.

## What it needs

- **Python 3** on the machine, because the store is a Python program. The app
  looks for `python3`, `python` and `py -3`, and says so plainly if none answer.
- Nothing else at runtime. No Node, no package manager, no admin rights: the
  store installs under your own user account.

To *develop* it you also need **Node 22 or newer** — see below — and nothing else: the
toolchain (TypeScript, ESLint, esbuild, electron-builder) installs with `make setup`.

## Install

Grab the package for your machine from the
[releases](https://git.teletypegames.org/stores/warp-engine-desktop-gui/releases)
and open it. On first run, if there is no store on the machine yet, the window
offers to download one — that is the whole setup.

### Opening it on macOS

The build is ad-hoc signed but **not notarised**, so macOS asks before running a
copy that came from a browser. The reliable way through:

```sh
xattr -dr com.apple.quarantine "/Applications/WarpEngine Store.app"
```

If macOS offers *Open Anyway* under **System Settings ▸ Privacy & Security** after
a blocked attempt, that works as well. Notarisation is the only thing that removes
the step entirely, and it needs a paid Apple Developer ID.

Nothing the store itself downloads is affected: Python fetches those files, and
Python does not set the quarantine flag.

**v1.0.0 could not be opened at all** — it reported *"is damaged"*. The bundle had
never been signed; only its main executable carried the linker's ad-hoc signature,
so there was no resource seal and Gatekeeper refused it outright rather than
asking. `scripts/after-pack.js` signs the bundle during the build now, and the
result verifies as `valid on disk`.

## Which store it installs

On first run the client fetches the registry and offers what it finds. One store
and there is nothing to decide; several and the setup screen shows a picker.

```json
[
  {
    "name": "Teletype Games",
    "catalogUrl": "https://teletypegames.org",
    "storeRepositoryUrl": "https://git.teletypegames.org/stores/ttg-desktop-store"
  }
]
```

From a record the client works out the rest:

- **`storeRepositoryUrl`** → the store's `config.json`, read from
  `…/raw/branch/master/config.json`. That file is the authority on how the store
  behaves: which platforms, which statuses, where things land.
- **`catalogUrl` and `name`** override the config's own `store.base_url` and
  `store.name`. The registry says which catalog this store is *for*, so it wins.
- **the store id** — which names the store home and the folder games land in —
  comes from the repository name: `ttg-desktop-store` becomes `ttg`. A
  `config.json` that sets its own id keeps it.

A repository **without** a `config.json` still works. The engine merges whatever
it is handed onto its own defaults, so the client writes a three-field config and
the store behaves like the default one pointed at that catalog.

The registry address is the single thing about a particular site left in the
client, and `STORES_API` overrides it:

```sh
STORES_API=http://127.0.0.1:8731/stores npm start
```

Adding a store is therefore a database row on the site — see its ActiveAdmin
panel — and not a release of this app.

## Use

Everything that is not a title lives in the **side menu** on the left, and the
`☰` button in the bar folds it away — the state is remembered between runs.

- **Stores** lists every store on this machine, the open one marked. Clicking
  another switches to it: the grid, the categories and the folders all follow, and
  the client reopens on that store next time. Two stores installed from the same
  catalog into different folders show their folder instead of their id, because
  the id would not tell them apart. **Add a store…** brings up the registry
  picker, the same one the first run offers.
- **Actions** holds **Install all**, which fetches everything the catalog offers
  for this machine, and **Refresh**, which re-reads the catalog.
- **Categories** narrows the grid, one category at a time, with the count next to
  each: *Everything*, *Installed*, *Updates*, *Not installed*, then a row per
  **platform** (`godot`, `tic80`, `love`, …) and per **kind** (native or hosted).
  The axes are built from what the catalog actually contains — a platform with no
  titles is not listed, and a category that disappears under you falls back to
  *Everything* rather than leaving an empty grid. There is no genre in a
  WarpEngine catalog, so these are the categories there are.
- **Language** follows the system and can be switched; **English and Hungarian**.

In the grid, a card's button is **Install**, **Update**, or **Play** / **Open**
once it is there. **Remove** takes a title back out. Each card says whether it is
**native** — unpacked and run locally, works offline — or **hosted**: a browser
build the catalog serves rather than packages, so its entry opens a page and needs
the network.

The **Log** drawer at the bottom carries the store's own output verbatim, and next
to it are buttons that open the two folders everything lands in.

Every card carries a band of box art the same height — the first letter of the
title when the catalog has no image — so titles and buttons line up across a row.
Until this was photographed, the grid was quietly broken: the rows split the
window's height evenly instead of following their content, which collapsed the art
to nothing and clipped the buttons out of sight.

While the store is working, only the things that would start a second call are
disabled: the menu, the log drawer and the category filters keep working, because
they change what is on screen and nothing on disk.

Anything installed from the window is a normal menu entry, so it also shows up in
your launcher, Dock or Start menu — the app does not have to be running to play.

## Development

`make` is the front door; it wraps the npm scripts so the useful sequences have
names. `make` on its own lists everything.

| Target | What it does |
|---|---|
| `make setup` | install the dependencies (checks the Node version first) |
| `make build` | compile TypeScript, bundle the preload and the renderer |
| `make typecheck` | type-check everything, emitting nothing |
| `make lint` | the strict rule set (`lint-fix` fixes what it can) |
| `make check` | **typecheck, lint and both test suites** — the gate |
| `make start` | run the app against whatever store is installed |
| `make smoke` | drive the store with no window and no Electron at all |
| `make uitest` | load the window once and report what rendered |
| `SELFTEST_SHOT=shot.png npm run uitest` | the same, and the window photographs itself into that file |
| `make test` | both test suites |
| `make dist` | package for this machine (`dist-mac`, `dist-win`, `dist-linux` to pick) |
| `make publish` | upload the packages already in `dist/` to the Gitea release |
| `make release` | **package and publish in one go** |
| `make clean` | remove `build/` and the packages (`distclean` also drops `node_modules`) |
| `make version` | the versions involved, including whether `tea` is there |

The npm scripts still work directly (`npm start`, `npm run dist:mac`) — the
Makefile adds no logic of its own beyond the release step. Every script that runs the
app builds first, so there is no way to test a stale bundle.

### Publishing a release

```sh
make release
```

The tag comes from `package.json`, so `npm version patch` is the only place a
version is set. The release is created if it is not there yet, and an attachment
whose name is already on it is **replaced** rather than refused — so a rebuild and
a second `make publish` lands rather than erroring.

Release notes come from `RELEASE_NOTES.md` when the file is present, otherwise the
release gets a one-line note. The repository is read from `origin`, so a fork
publishes to the fork.

Each upload is retried up to three times, and the existing attachment is dropped
before every attempt so a retry cannot leave two copies. A 100 MB upload does fail
on its own: publishing 1.2.0 got *"invalid username, password or token"* on the
second package while the first had just gone up with the same token, and the same
command succeeded immediately afterwards.

Package names contain a space — `WarpEngine Store-1.2.0-arm64.dmg` — so the list of
files is passed one path per line rather than as one string; splitting it on
whitespace is what broke the first attempt at publishing 1.1.0.

It needs `tea` installed and logged in — the devarea repo has `make tea` for that.
Overridable: `TAG`, `REPO`, `TEA_LOGIN`, `NOTES`, `DIST`.

```sh
make publish TAG=v1.0.2                 # a tag other than package.json's
scripts/release.sh dist/one-file.dmg    # just one package
```

**Node 22 or newer is needed to install**, not to run: Electron's own installer
is ESM-only, and older Node cannot `require()` it. The packaged app carries its
own runtime.

`npm run uitest` runs with its own user-data directory and without the
single-instance lock. Otherwise a copy the user already has open swallows the test
process, which exits 0 and reads as a pass.

Both test scripts accept a sandbox store instead of the real one, which is how
this repository is tested without touching a working installation:

```sh
STORE_ROOT=/tmp/sandbox-root npm start
SMOKE_HOME=/tmp/sandbox-root/ttg-desktop npm run smoke
```

### How it is put together

TypeScript, in layers, with the dependency rule pointing inward. **[STRUCTURE.md](STRUCTURE.md)
is the map** — the layers, every pattern in use, and the naming rules. The short version:

| Layer | What lives there |
|---|---|
| `src/shared/` | the IPC channel table, the bridge contract, the DTOs, the two message bundles |
| `src/domain/` | models, ports and errors — no Electron, no Node, no Python |
| `src/application/` | services and the domain → DTO mappers |
| `src/infrastructure/` | the adapters: the Python CLI, HTTP, the filesystem, Electron itself |
| `src/main/` | the window, the IPC controllers, the composition root, the self-test |
| `src/preload/` | the bridge, bundled into one file — a sandboxed preload cannot require modules |
| `src/renderer/` | the state store, the views and the renderer controllers |
| `src/scripts/` | the smoke test: the same services with no window at all |
| `scripts/release.sh` | creates the Gitea release and replaces its attachments |
| `scripts/after-pack.js` | ad-hoc signs the macOS bundle during packaging |
| `scripts/build-assets.mjs` | bundles the preload and the renderer, copies the page |

Two properties are worth stating because they are what the layers buy:

- **The catalog can be driven without a window.** `make smoke` assembles the same
  services against the same ports with no Electron in the process at all.
- **The window never receives a filesystem path.** A `GameDto` carries no paths; the
  window asks to launch a title *by name* and the main process resolves what that means
  from the store's own state.

`contextIsolation` is on, `nodeIntegration` off, `sandbox` on, and the page carries a
CSP that allows only its own script and stylesheet plus images over HTTPS. Links open
in the real browser; the window itself never navigates.

`PythonStoreCatalogGateway` is the only class that knows the store is a Python
program. It talks to the CLI through `--json`, which puts data on stdout and the
human-readable log on stderr. That flag arrived with engine **1.1.0**, and the client
checks: an older store is met with an offer to refresh it rather than a failed call.

`STORE_ENGINES` has one entry today. The RetroArch store has the same command shape,
so a second entry is the whole change needed to drive it too — that is why the table is
there.

## Verified, and not

The 1.3.0 refactor was measured rather than trusted: `make check` is clean — no type
errors, no lint findings, both test suites green — the window was photographed before
and after and the two are the same picture, and the packaged 1.3.0 bundle was run from
`dist/` and drove the real store. The published package contains `build/` and
`package.json` and nothing else: 111 entries, no sources, no toolchain.

Exercised on macOS (arm64), with the packaged app from the release rather than a
dev run: the store is discovered, the catalog lists, a sync installs, the window
renders the installed state, and `npm run uitest` passes with the grid rendered
and both languages in the picker. The bootstrap download was run into an empty
directory and the resulting store answered the bridge.

The grid was checked by looking at it, not only by counting nodes: `SELFTEST_SHOT`
has the window capture itself, which is how the collapsed rows were found — the DOM
had ten cards and twenty buttons all along, and every count passed while the page
showed neither art nor buttons. A screenshot from outside the app is not available
here, so the window takes its own.

The side menu was measured with two stores in one root — a sandbox copy alongside
the real install — and `npm run uitest` clicks the store that is not open and
checks that the bar, the grid and the categories follow. With a single store the
switch is skipped, which is what the normal run reports.

The registry path was exercised against a local endpoint serving the same payload
the site returns, with two records: one store whose repository has a `config.json`
and one without. Both installed, and the engine listed all ten titles with the
synthesised config. `npm run uitest` was run twice — with a store present it shows
the grid, with none it shows the setup gate and its picker carries both names —
and once more with the registry unreachable, which produces the retry gate.

The signing was measured rather than assumed, by setting the quarantine flag on a
copy unzipped from the release artifact: `codesign --verify --deep --strict` is
clean, and `syspolicy_check` reports only the expected *"adhoc signed"* warning.
A quarantined copy is still stopped until it is approved — that part is Gatekeeper
policy, not a fault in the package.

**Not tried on Linux or Windows.** The paths and the launch behaviour are written
for them, and the store CLI itself has the same gap — `.desktop` and `.lnk`
launchers have been generated and read, but nobody has clicked one.
