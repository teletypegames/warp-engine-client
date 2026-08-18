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

## What it needs

- **Python 3** on the machine, because the store is a Python program. The app
  looks for `python3`, `python` and `py -3`, and says so plainly if none answer.
- Nothing else at runtime. No Node, no package manager, no admin rights: the
  store installs under your own user account.

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

## Use

- **Install all** fetches everything the catalog offers for this machine.
- A card's button is **Install**, **Update**, or **Play** / **Open** once it is
  there. **Remove** takes a title back out.
- Each card says whether it is **native** — unpacked and run locally, works
  offline — or **hosted**: a browser build the catalog serves rather than
  packages, so its entry opens a page and needs the network.
- The **Log** drawer at the bottom carries the store's own output verbatim, and
  next to it are buttons that open the two folders everything lands in.
- The language follows the system and can be switched; **English and Hungarian**.

Anything installed from the window is a normal menu entry, so it also shows up in
your launcher, Dock or Start menu — the app does not have to be running to play.

## Development

```sh
npm install
npm start                  # the window, against whatever store is installed
npm run smoke              # the bridge only: no window, no Electron
npm run uitest             # loads the window once and reports what rendered
npm run dist:mac           # or dist:win / dist:linux
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

| File | What it does |
|---|---|
| `main.js` | the window, the IPC, and the one-call-at-a-time guard |
| `preload.js` | the entire surface the renderer gets — no Node reaches it |
| `lib/store.js` | finds the store and Python, runs the CLI, parses its JSON |
| `lib/bootstrap.js` | downloads the engine, the shared core and a config |
| `lib/i18n.js` | the two string tables |
| `renderer/` | plain HTML, CSS and JS — no framework, no build step |

`contextIsolation` is on, `nodeIntegration` off, `sandbox` on, and the page
carries a CSP that allows only its own script and stylesheet plus images over
HTTPS. Links open in the real browser; the window itself never navigates.

`lib/store.js` talks to the CLI through `--json`, which puts data on stdout and
the human-readable log on stderr. That flag arrived with engine **1.1.0**, and the
client checks: an older store is met with an offer to refresh it rather than a
failed call.

The bridge keeps an `ENGINES` list with one entry today. The RetroArch store has
the same command shape, so a second entry is the whole change needed to drive it
too — that is why the indirection is there.

## Verified, and not

Exercised on macOS (arm64), with the packaged app from the release rather than a
dev run: the store is discovered, the catalog lists, a sync installs, the window
renders the installed state, and `npm run uitest` passes with the grid rendered
and both languages in the picker. The bootstrap download was run into an empty
directory and the resulting store answered the bridge.

The signing was measured rather than assumed, by setting the quarantine flag on a
copy unzipped from the release artifact: `codesign --verify --deep --strict` is
clean, and `syspolicy_check` reports only the expected *"adhoc signed"* warning.
A quarantined copy is still stopped until it is approved — that part is Gatekeeper
policy, not a fault in the package.

**Not tried on Linux or Windows.** The paths and the launch behaviour are written
for them, and the store CLI itself has the same gap — `.desktop` and `.lnk`
launchers have been generated and read, but nobody has clicked one.
