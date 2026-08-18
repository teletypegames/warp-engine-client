# WarpEngine Store 1.4.0

**A store no longer needs a repository of its own.** Until now every store in the
registry pointed at a repository holding its `config.json`, and the client read that
file to know what to install. It turns out almost nothing in there was necessary: the
store engine's built-in defaults already cover the host-to-asset mapping, the install
modes, the platforms and the behaviour. What defaults cannot know is *identity* — a
slug, a name and a catalog URL — and that is exactly what a registry record carries.

So `storeRepositoryUrl` is now optional. A record with a name and a catalog URL is a
complete store: the client derives the slug from the catalog host
(`teletypegames.org` → `teletypegames`), writes a small config and installs. Given a
repository it still reads it, and that file remains the authority on how the store
behaves — which platforms it offers, which statuses it shows, where things land. A
repository without a `config.json` is treated as no repository at all.

With the defaults, games land in a folder named after the store id and released,
archived **and demo** titles are listed: a catalog that publishes a demo means it to
be played.

The site's registry endpoint changed to match — `storeRepositoryUrl` answers `null`
when there is none — and adding a store is now genuinely one database row with two
fields filled in.

**The "Install all" button is gone.** Titles are installed one at a time from their
own cards.

**No footer.** The window carried a bar at the bottom at all times — a toggle and a
line of absolute paths — for something most sessions never need. The log is still
there, with the two folder buttons in it, but it lives behind a quiet switch at the
bottom of the side menu and takes no room until it is opened. The grid gets the height
back.

**The repository is now `warp-engine-client`.** The app has always been called
WarpEngine Store; `warp-engine-desktop-gui` described the role rather than the
product, and the host-specific engines keep their own shape
(`warp-engine-desktop-store`, `-retroarch-store`, `-batocera-store`). Gitea keeps a
redirect from the old path, and the releases and tags moved with the repository, so
existing links and clones still resolve.

### Three things a screenshot found

Photographing the setup screen — which no automated count had ever looked at — turned
up three faults that every check had passed:

- the store badge in the bar rendered as an empty pill when no store was open;
- the gate's store picker showed as an empty dropdown stub, because an explicit
  `display` in the stylesheet beats the browser's own `[hidden]` rule;
- the gate went up while the *"No installable titles in the catalog"* line stayed on
  screen underneath it.

The last one was a design fault, not a typo: whether the gate is up was an imperative
call on a view rather than state, so the gate and the grid could disagree. The setup
screen is now a field in the state store, and that one field decides which of the two
is drawn. The window test's gate assertion was wrong too — it demanded a store picker,
which only appears when the registry offers more than one store, so a perfectly good
window failed it.

### Linux and Windows packages now come from CI

`.woodpecker.yaml` builds the AppImage, the deb, the NSIS installer and the portable
exe — Windows through Wine — and on a tag attaches them to this release. macOS stays a
local build, because Apple's toolchain and its signing exist only on a Mac, so a full
release is one local `make release` plus the pipeline. The Windows installer is not
signed: Windows will warn about an unknown publisher until there is a certificate.

### Opening it on macOS

Ad-hoc signed, **not notarised**, so macOS asks first:

```sh
xattr -dr com.apple.quarantine "/Applications/WarpEngine Store.app"
```

### What is attached

The macOS arm64 package, built and verified here, plus whatever the pipeline attaches
for Linux (AppImage, deb) and Windows (installer, portable).

### Verified

A repository-less store was installed end to end against a local registry serving one
record with `storeRepositoryUrl: null`: the id came out as `teletypegames`, the engine
and the shared core downloaded, the written config had three sections, engine 1.1.0
accepted it, it listed the same ten titles the configured store does, and a hosted
title synced into a sandbox with its menu entry written. `make check` is clean, and
the setup gate was photographed on a machine with no store at all.
