# WarpEngine Client 2.2.0

**A registry record is a name and a catalog.** Nothing else. The `config` field added in
2.1.0 is gone, and so is `storeRepositoryUrl` — along with the two store repositories they
pointed at, which have been deleted.

2.1.0 had the registry say how each store behaves. That was the wrong shape. How a store
behaves is fixed per installed client: this application carries its own store engine and
is the only thing that can see the machine it is running on. A copy of that on a server
was a second authority over decisions this side had already made correctly — including
which directories the store is allowed to delete from — and a second authority is a way
for the two to disagree.

Keeping two stores on one machine out of each other's files needs none of it. It is a
subfolder, and the client derives it:

| | |
|---|---|
| **store id** | a slug of the catalog host — `teletypegames.org` becomes `teletypegames` |
| **store home** | `<id>-desktop`, under the usual store root |
| **games folder** | `<id>`, inside the OS's usual place for programs |
| **delete boundary** | that same folder, and nothing outside it |

Derived from the *catalog* on purpose: the catalog is what a store is, so two records
naming the same one are the same store and land in the same place. Installing the same
store twice is idempotent rather than a way to orphan what is already there.

**Existing installations are untouched.** A store already on the machine is recognised by
the `config.json` in its own home and keeps the identity written there — a store installed
as `ttg` stays `ttg`, in `ttg-desktop`, with its games where they are. Only a *new* install
derives its id from the catalog.

### Also

The public `/stores` page loses its desktop card, which advertised a `curl … | sh` for a
repository that no longer exists; an ordinary computer is served by the app. The `/desktop`
URL now lands on the app rather than on a device tab, so what someone typing it wants is
what they get.

### Opening it on macOS

Ad-hoc signed, **not notarised**, so macOS asks first:

```sh
xattr -dr com.apple.quarantine "/Applications/WarpEngine Client.app"
```

### What is attached

The macOS package, built and verified on a Mac, plus the Linux (AppImage, deb) and
Windows (installer, portable) packages the pipeline builds when the tag is pushed.

### Verified

`make check` is clean: typecheck, lint, the headless smoke test and the window self-test.

The install path was measured end to end against a local registry serving exactly the new
record shape. The slug came out `teletypegames`, the home `teletypegames-desktop`, the
games subfolder `teletypegames`, and installing the same record twice landed in the same
home. A record carrying `config` and `storeRepositoryUrl` — what a stale registry or a
tampering renderer might still send — changed nothing on disk, because neither field exists
in the model any more.

On this machine the check also shows both halves of the compatibility claim at once: the
registry's new slug reads `teletypegames`, while the store that was installed before today
is still found as `ttg` in `ttg-desktop`, listing its ten installed titles from
`Application Support/teletypegames`.

The site side was migrated and its specs re-run, and the frontend was built — which first
required removing a dead `engines` list that had been failing `vue-tsc` on master, so that
page could not be built to check at all.
