# warp-engine-client — the WarpEngine Client app

The client for a WarpEngine store: the catalog as a grid of cards, one click to install
a title into your own application menu, one to play it, one to remove it. Linux, macOS
and Windows.

**The store engine is part of this application.** Reading the catalog, choosing which
release fits this machine, unpacking it, writing the menu entry and remembering what
went where all happen in process — there is no interpreter to find and no child process
to parse. What lands on disk has not changed: `config.json` and `state.json` keep the
shape the shell engine wrote, so a machine whose library was installed by the CLI keeps
it, and the engine's own defaults still decide everything a store does not configure.

That also makes this the only install path that needs nothing of the machine. The shell
store's installer was `curl … | sh`, which Windows does not have.

Which store it installs is not baked in: the client asks a registry — `GET
/api/stores` on the site — and each record says what the store is called, which
catalog it serves and where its configuration lives.

## What it needs

- **Nothing.** No interpreter, no package manager, no admin rights: the app carries its
  own runtime and the store installs under your own user account.

To *develop* it you also need **Node 22 or newer** — see below — and nothing else: the
toolchain (TypeScript, ESLint, esbuild, electron-builder) installs with `make setup`.

## Install

Grab the package for your machine from the
[releases](https://git.teletypegames.org/stores/warp-engine-client/releases)
and open it. On first run, if there is no store on the machine yet, the window
offers to download one — that is the whole setup.

### Opening it on macOS

The build is ad-hoc signed but **not notarised**, so macOS asks before running a
copy that came from a browser. The reliable way through:

```sh
xattr -dr com.apple.quarantine "/Applications/WarpEngine Client.app"
```

If macOS offers *Open Anyway* under **System Settings ▸ Privacy & Security** after
a blocked attempt, that works as well. Notarisation is the only thing that removes
the step entirely, and it needs a paid Apple Developer ID.

Nothing the store itself downloads is affected: the app fetches those files over its
own HTTP client, which does not set the quarantine flag.

**v1.0.0 could not be opened at all** — it reported *"is damaged"*. The bundle had
never been signed; only its main executable carried the linker's ad-hoc signature,
so there was no resource seal and Gatekeeper refused it outright rather than
asking. `scripts/after-pack.js` signs the bundle during the build now, and the
result verifies as `valid on disk`.

## Signing in, and titles that cost money

**Nothing in this client knows anything about a particular store.** What a title costs,
whether it needs an account, where to buy it and where to sign in all arrive from the
catalog's own server — WarpEngine 0.5 answers `GET /api/service` with what it offers, and
puts an `access` block on every catalog entry. A client that carried those facts would
work for exactly one shop; this one asks.

Where the server offers no sign-in — every WarpEngine before 0.5, and any store that
sells nothing — the window shows none, and behaves exactly as it always did.

Where it does:

- the side menu grows an **Account** block: *Sign in…*, and *Sign out* once you are;
- signing in shows a **short code**. Your browser opens on the store's own page and you
  type the code there; approving it signs this device in. Nothing is typed into this
  window, and no password ever reaches it — that is the whole reason for the detour;
- the token is kept in the **OS keychain** (Keychain, libsecret, DPAPI) through
  Electron's `safeStorage`, one per store. Where no keychain is available it is not
  stored at all rather than written out in the clear: the cost is signing in again next
  run.

On a card, what you may do with a title is separate from what this machine can run:

- **owned** or free → *Install*, as before;
- **not owned** → the **price** on the card and a **Buy** button, which opens the store's
  page in your browser. Buying happens there, not here — a checkout rebuilt in this
  window would be a second place to get card handling wrong. **Refresh** afterwards and
  the card becomes an *Install*;
- **signed out, catalog gates it** → *Sign in to install*, because the catalog cannot say
  whether it is yours until it knows who is asking.

Two new categories go with it: **Owned** and **To buy**. Owning something is not the
same as having installed it, which is the point of the first one.

A title nobody has bought is **not** dimmed. That treatment belongs to what this
*machine* cannot do — an unsupported platform, no build for this architecture — and
there is nothing wrong with the machine here.

## Which store it installs

On first run the client fetches the registry and offers what it finds. One store
and there is nothing to decide; several and the setup screen shows a picker.

```json
[
  { "name": "Teletype Games", "catalogUrl": "https://teletypegames.org" },
  { "name": "Some Other Store", "catalogUrl": "https://games.example.org" }
]
```

**A name and a catalog are the whole record.** The store engine's built-in defaults
already cover the host-to-asset mapping, the install modes, the platforms and the
behaviour, so what is actually missing from them is identity — and identity is all a
registry says. Nothing a record carries decides where files go: how a store behaves is
fixed per installed client, which knows its own machine, and a copy of that on a server
would be a second authority over decisions this side has already made.

From a record the client works out the rest:

- **the store id** — which names the store home and the folder games land in — is a slug
  of the catalog host (`teletypegames.org` becomes `teletypegames`), or of the display
  name if that fails. Derived from the *catalog* on purpose: the catalog is what a store
  is, so two records naming the same one are the same store and land in the same place.
  Reinstalling therefore never orphans what is already installed.
- **the games folder** is that same slug inside the OS's usual place for programs, and it
  is the only subtree this store will ever delete from. That is the whole of how two
  stores on one machine stay out of each other's files: a subfolder, derived here.
- **released, archived and demo** titles are listed, where the engine alone would show
  released and archived only — a catalog that publishes a demo means it to be played.

Because a record has no paths in it and no config, there is nothing for the window to
tamper with: `RegistryStoreDtoMapper.toModel` can take its choice at face value, and the
config that lands on disk is written by the installer from the engine's own defaults.

What the defaults produce, for a record with no repository: the games land in a
folder named after the store id, and released, archived **and demo** titles are
listed — a catalog that publishes a demo means it to be played.

The registry address is the single thing about a particular site left in the client,
and it is decided in three places, most specific first:

```sh
STORES_API=http://127.0.0.1:8731/stores npm start   # runtime: for trying something out
make dist STORES_API=https://games.example.org/api/stores   # build: for shipping it
```

The build variant is baked into the packaged app's own `package.json`
(`warpEngine.registryUrl`, written by `electron-builder --config.extraMetadata`), so a
client built for somebody else's catalog needs no source change and no environment on the
user's machine. With neither set, the address is ours.

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
- **Account** appears only where the catalog offers a sign-in, and holds *Sign in…* or
  *Sign out* — see above.
- **Actions** holds **Refresh**, which re-reads the catalog. Titles are installed
  one at a time from their own cards; there is no install-everything button.
- **Categories** narrows the grid, one category at a time, with the count next to
  each: *Everything*, *Installed*, *Updates*, *Not installed*, then a row per
  **platform** (`godot`, `tic80`, `love`, …) and per **kind** (native or hosted).
  Where the catalog gates anything, **Owned** and **To buy** join them.
  The axes are built from what the catalog actually contains — a platform with no
  titles is not listed, and a category that disappears under you falls back to
  *Everything* rather than leaving an empty grid. There is no genre in a
  WarpEngine catalog, so these are the categories there are.
- **Log** opens the store's own output — its words, verbatim — together with the two
  folders everything lands in. Off screen until asked for: the window has no footer,
  because a permanent bar of absolute paths is not what a store is for.
- **Language** follows the system and can be switched; **English and Hungarian**.

In the grid, a card's button is **Install**, **Update**, or **Play** / **Open**
once it is there. **Remove** takes a title back out. Each card says whether it is
**native** — unpacked and run locally, works offline — or **hosted**: a browser
build the catalog serves rather than packages, so its entry opens a page and needs
the network.

**Everything in the catalog is listed, including what this machine cannot install.**
Those cards are dimmed, carry an *unsupported platform* or *no build for this machine*
badge with the engine's own explanation under it, and have nothing to press. A store
that hides them leaves you wondering whether the catalog is small or your machine is
unusual; this way it says which. They have a category of their own — *Not for this
machine* — and they are left out of the native/hosted counts, because a title with no
build has no mode to be counted under.

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

### Continuous integration

`.woodpecker.yaml` builds the **Linux and Windows** packages, and on a tag attaches
them to the Gitea release. The pipeline is in this repository rather than served by the
update server's `/build/config` extension: that extension serves game-platform
pipelines, which build a cartridge and publish it into the site's catalog, and this
builds an application and publishes to a release.

| Step | Image | What it does |
|---|---|---|
| `check` | `electronuserland/builder:22` | `npm ci`, type-check, lint, and the smoke test |
| `linux` | `electronuserland/builder:22` | AppImage and deb |
| `windows` | `electronuserland/builder:22-wine` | the NSIS installer and the portable exe, built through Wine |
| `release` | `alpine` | on a tag only: **creates the release** and attaches what this pipeline built |

**macOS stays a local build.** Apple's toolchain and its signing only exist on a Mac.
So the whole of a release is:

1. bump the version, commit, and push the tag: `git tag v1.4.0 && git push origin v1.4.0`;
2. the pipeline builds Linux and Windows, **creates the release** with `RELEASE_NOTES.md`
   as its body, and attaches those four packages;
3. on a Mac, `make release` builds the macOS package and pushes it onto the same release.

The window test is local as well: it needs a display and a store on the machine.

The `release` step needs a **`gitea_token`** repository secret — a Gitea token with
write access to this repository:

```sh
woodpecker-cli repo secret add --repository stores/warp-engine-client \
  --name gitea_token --value <token> --event tag
```

Woodpecker does hand steps a forge credential of its own, and the script uses it when the
secret is absent, but that is not something to rely on: a **manual** build has it and a
build started by the **tag webhook** does not, which is how the first tag build failed —
after building all four packages. Gitea takes either credential as `token …` or
`Bearer …` depending on how it was issued, so the script probes which of the two `/user`
accepts instead of assuming, and logs which one it used.

There are two publishers on purpose: `scripts/release.sh` drives `tea`, which is logged
in on a workstation, and `scripts/ci-upload.sh` speaks the API with whatever credential
CI has. Each is short enough to read in full; one script with two ways to authenticate
would not be.

Both build steps end by checking what they produced: a package under 10 MB did not
finish. That check exists because a half-finished Wine build leaves a stub *named* like
the real installer — 162 KB of it — and `ls` is perfectly happy with that.

**The Windows step cannot be rehearsed on an Apple Silicon Mac.** Wine assumes 4 KB
memory pages and this host has 16 KB ones, so an emulated amd64 container dies with
`anon_mmap_fixed: Assertion failed`. It is a property of the machine, not of the
pipeline; the x86_64 runner is where that step is proven. The Linux step was rehearsed
locally in the same image and produced both packages.

The Windows installer is **not signed**: Windows will warn about an unknown publisher
until there is a code-signing certificate. Linux packages carry no signature by
convention.

### Publishing a release

```sh
make release
```

This is the **macOS half** of a release; the Linux and Windows packages come from the
pipeline when the tag is pushed (see above). The tag comes from `package.json`, so
`npm version patch` is the only place a version is set. The release is created if it is
not there yet — either half can go first — and an attachment whose name is already on it
is **replaced** rather than refused, so a rebuild and a second `make publish` lands
rather than erroring.

Release notes come from `RELEASE_NOTES.md` when the file is present, otherwise the
release gets a one-line note. The repository is read from `origin`, so a fork
publishes to the fork.

Each upload is retried up to three times, and the existing attachment is dropped
before every attempt so a retry cannot leave two copies. A 100 MB upload does fail
on its own: publishing 1.2.0 got *"invalid username, password or token"* on the
second package while the first had just gone up with the same token, and the same
command succeeded immediately afterwards.

Package names have no spaces in them — `WarpEngineClient-2.3.0-arm64.dmg` — because a
space in a release asset is a space in every `curl`, script and shell command that ever
touches it. The app itself is still called **WarpEngine Client**: that name is what
appears in the Dock and in `/Applications`, and only the file names were the problem.

The list of files is still passed one path per line rather than as one string, since a
path given on the command line can contain a space even when a built one cannot;
splitting it on whitespace is what broke the first attempt at publishing 1.1.0.

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
| `src/domain/` | models, ports and errors — no Electron, no Node |
| `src/application/` | services and the domain → DTO mappers |
| `src/infrastructure/` | the adapters: the store engine, HTTP, the archive reader, the filesystem, Electron itself |
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

`NativeStoreCatalogGateway` is the engine behind the `StoreCatalogGateway` port, and
`src/infrastructure/engine/` is the engine itself: the catalog client, the release
picker, the host match, the payload installer, the three launcher writers and the state
file. Above the port nothing knows any of that exists, which is the point — a second
host would be a second gateway, not a second code path.

`STORE_ENGINES` has one entry today. A RetroArch store writes playlists rather than
menu entries, so it would be an entry there and a gateway of its own.

### Reading a zip without a dependency

Node has no zip reader and this application has **no runtime dependencies**, so
`src/infrastructure/archive/ZipArchive.ts` is one over `node:zlib` — about 150 lines that
walk the central directory, inflate `stored` and `deflate` entries, and restore the
executable bit from each entry's external attributes. That last part is not a detail: the
archive records it, and without it nothing the store installs can start.

It reads what our own release pipeline produces and refuses the rest: a zip64 archive, an
unknown compression method and a path that would escape the destination are all errors
rather than best guesses.

### Which WarpEngine served the catalog

Every WarpEngine API response carries a `WarpEngine-Version` header, so the client knows
the engine's age without asking. `SUPPORTED_WARP_ENGINE_VERSIONS` lists the versions this
client is written against, and `selectCatalogDialect` maps each one to the `CatalogDialect`
that reads its catalog shape.

The switch over that list is exhaustive, which is the whole mechanism: adding a version to
the array stops the build — in the type checker *and* in the linter — until somebody says
what it reads like. A new engine version cannot arrive silently.

| What the header says | What happens |
|---|---|
| a supported version | its dialect reads the catalog, and the log names it |
| nothing at all | read as the oldest supported version, which is what an engine older than 0.4.0 is |
| older than anything supported | the same, and the log says so |
| newer than anything supported | the newest dialect is tried anyway, with a warning that titles may be missed |

Three versions share one dialect today, because the catalog's shape has not changed
across them. One class serving three versions is the honest way to say that.

## Verified, and not

**2.2.0** — the registry record was cut back to a name and a catalog, so the whole
install path was measured again against a local registry serving exactly that. The slug
came out `teletypegames` from the catalog host, the home `teletypegames-desktop`, the
games subfolder `teletypegames`, and installing the same record twice landed in the same
home. A record carrying `config` and `storeRepositoryUrl` — the fields a stale client or a
tampering renderer might still send — changed nothing, because neither exists in the model
any more. The site side was migrated and its specs re-run; the frontend was built, which
first required removing a dead `engines` list that had been failing `vue-tsc` on master.

Older entries below describe what was verified for the version they name, and some of
them predate the store engine moving into this application.

The pipeline's commands were run in the same containers it uses, before the pipeline was
committed: `electronuserland/builder:22` installs, type-checks, lints, passes the smoke
test (registry reached, store skipped as it should be on a machine that has none) and
produces the AppImage (128 MB) and the deb (100 MB). The Wine step could not be
rehearsed here — see above — and the size check that guards it was tested against both
outcomes: it rejects the 162 KB stub the failed Wine build left and accepts the two real
Linux packages.

A store with no repository was installed end to end from a local registry serving
one record with `storeRepositoryUrl: null`: the id came out as `teletypegames`, the
engine and the shared core downloaded, the written config had the three sections,
engine 1.1.0 accepted it, and it listed the same ten titles the configured store
does — then a hosted title synced into a sandbox and its menu entry appeared. The
setup gate was also photographed on a machine with no store at all.

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
