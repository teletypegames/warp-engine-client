The client no longer carries a store address. It asks the site which stores exist
— `GET /api/stores` — and installs what comes back: one record and there is
nothing to decide, several and the setup screen shows a picker.

Adding a store is now a database row on the site, maintained from its admin panel,
rather than a release of this app.

### What a record gives it

- **`storeRepositoryUrl`** → the store's `config.json`, which stays the authority
  on how that store behaves: platforms, statuses, where things land.
- **`catalogUrl`** and **`name`** override the config's `store.base_url` and
  `store.name` — the registry is what says which catalog a store is *for*.
- **the store id**, from the repository name: `ttg-desktop-store` becomes `ttg`.

A store repository with no `config.json` still installs. The engine merges
whatever it is handed onto its own defaults, so the client writes a three-field
config and the store behaves like the default one pointed at that catalog.

`STORES_API` overrides the registry address, which is the one thing about a
particular site left in the client.

### Opening it on macOS

Ad-hoc signed, **not notarised**, so macOS asks first:

```sh
xattr -dr com.apple.quarantine "/Applications/WarpEngine Store.app"
```

*Open Anyway* under **System Settings ▸ Privacy & Security** works as well.
Nothing the store itself downloads is affected — Python fetches those, and Python
does not set the quarantine flag.

### What is attached

**macOS arm64 only**, the machine this was built and verified on. Windows and
Linux packages need a build on those platforms (`make dist-win` / `dist-linux`).

### Verified

Against a local endpoint serving the same payload the site returns, with two
records — one store whose repository has a `config.json` and one without. Both
installed, and the engine listed all ten titles with the synthesised config. The
window was checked on both outcomes: the grid with a store present, the setup gate
with a populated picker when there is none.
