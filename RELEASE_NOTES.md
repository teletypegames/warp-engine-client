# WarpEngine Client 2.1.0

**A store's configuration now comes from the registry itself.** `GET /api/stores`
records carry a `config` field — the same thing a store's `config.json` held, moved into
the record that already says what the store is. The client applies it directly, so
installing a store no longer depends on a second repository existing and staying
reachable, and a store can be configured entirely from the site's admin.

The old path still works. Where a record has no `config` but names a repository, the
client reads `…/raw/branch/master/config.json` from it exactly as before, so a registry
whose stores have not moved over is unaffected. With neither, the engine's defaults
carry the store, as they always have. The order is: registry config, then repository
file, then defaults.

**The window cannot supply a store config.** It is handed stores to show and hands one
back to install, but only as an identity — the config is dropped on the way in, and the
main process reads the record again from the registry before installing anything. This
is not tidiness: a config decides where files are written and, through
`paths.subfolder`, which subtree the store may later delete from. That is not a decision
the renderer gets to make, for the same reason a `GameDto` carries no paths.

### Also

The headless check now reports *which* source configured a store — registry, repository
or defaults — and names the resulting prune boundary, because "it installed" and "it
installed where I meant" are different claims.

### Opening it on macOS

Ad-hoc signed, **not notarised**, so macOS asks first:

```sh
xattr -dr com.apple.quarantine "/Applications/WarpEngine Client.app"
```

### What is attached

The macOS package, built and verified on a Mac, plus the Linux (AppImage, deb) and
Windows (installer, portable) packages the pipeline builds when the tag is pushed.

### Verified

`make check` is clean: typecheck, lint, the headless smoke test and the window
self-test.

All three configuration sources were exercised end to end against the real serializer
output, with the client's own classes and a sandbox store root:

| Registry record | What configured the store | Prune boundary written |
|---|---|---|
| `config` present | the registry, with no extra request | `teletypegames` |
| `config: null`, repository given | the repository's `config.json` | `teletypegames` |
| neither | the engine's defaults | `teletypegames` |

The renderer barrier was tested adversarially rather than assumed: an install started
from a record carrying `paths.subfolder: "ATTACKER"` and `paths.install_root:
"/tmp/pwned"` wrote `subfolder: teletypegames` and `install_root: null` to disk, because
the service re-read the registry and the mapper had already dropped the config.
