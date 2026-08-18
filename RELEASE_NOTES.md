# WarpEngine Store 1.3.0

**TypeScript, in layers.** The client was one `main.js`, one `preload.js`, three files
in `lib/` and one renderer script. It is now a typed application with the dependency
rule pointing inward: `domain` (models, ports, errors) knows nothing about Electron,
Node or Python; `application` orchestrates it through those ports; `infrastructure`
holds the adapters — the Python CLI, HTTP, the filesystem, Electron itself — and the
hosts (`main`, `preload`, `renderer`) sit on top. **[STRUCTURE.md](STRUCTURE.md)** is
the map: every layer, every pattern in use, and the naming rules, written to be read
before adding anything.

Nothing about the window changed. Same side menu, same categories, same switcher, same
two languages — this release is the inside of the app.

Two properties came out of the move, and both are worth having:

- **The catalog can be driven with no window and no Electron at all.** `make smoke`
  assembles the same services against the same ports in a plain Node process. It was a
  script that reimplemented the bridge before; now it is a second composition root.
- **The window never receives a filesystem path.** A title crosses the bridge without
  one, and launching is asked for *by name* — the main process resolves what that means
  from the store's own state. Nothing in the renderer can be talked into opening a path.

**A strict linter, and types everywhere.** `strict` plus
`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`,
`noPropertyAccessFromIndexSignature` and friends; typescript-eslint's
`strictTypeChecked` and `stylisticTypeChecked` sets; explicit return types, parameter
types and property types required even where inference would manage; exhaustive
switches; no `any`, no `!`, no casts on foreign data — engine output and the registry
go through readers that turn `unknown` into typed values. The naming patterns are
enforced by `naming-convention` rather than trusted.

Two things the types now catch that a person used to: a translation with a missing key
does not compile, and a channel the preload does not implement does not compile.

**New make targets:** `make build`, `make typecheck`, `make lint`, `make lint-fix` and
`make check` — the gate, which runs the type-check, the linter and both test suites in
that order, cheapest failure first. Every script that runs the app builds first, so a
stale bundle cannot be tested.

### Opening it on macOS

Ad-hoc signed, **not notarised**, so macOS asks first:

```sh
xattr -dr com.apple.quarantine "/Applications/WarpEngine Store.app"
```

*Open Anyway* under **System Settings ▸ Privacy & Security** works as well.

### What is attached

**macOS arm64 only**, the machine this was built and verified on. Windows and Linux
packages need a build on those platforms (`make dist-win` / `make dist-linux`).

### Verified

`make check` is clean: no type errors, no lint findings, the smoke test green against
the real store and against a sandbox one, and the window test green with one store and
with two — where it clicks the store that is not open and checks that the bar, the grid
and the categories follow. The window was photographed before and after the refactor
and the two are the same picture. The packaged app was run from the built bundle, not
from a dev launch.
