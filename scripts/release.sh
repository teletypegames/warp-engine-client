#!/bin/sh
# Publish the built packages as a Gitea release.
#
# The version comes from package.json, so the tag follows whatever `npm version`
# set — there is nothing to keep in sync by hand. The release is created if it is
# not there yet, and an attachment with a name already on it is replaced rather
# than refused, which is what makes a rebuild-and-upload repeatable.
#
#   scripts/release.sh                 every package in dist/
#   scripts/release.sh dist/foo.dmg    just these
#
# Assumes `tea` is installed and logged in (see the devarea repo: `make tea`).
set -eu

LOGIN="${TEA_LOGIN:-ttg}"
NOTES="${NOTES:-RELEASE_NOTES.md}"
DIST="${DIST:-dist}"

say() { echo "[release] $*"; }
die() { echo "[release] error: $*" >&2; exit 1; }

command -v tea >/dev/null 2>&1 || die "tea is not installed — see the devarea repo, 'make tea'"
command -v node >/dev/null 2>&1 || die "node is required"
[ -f package.json ] || die "run this from the repository root"

# Version and title from package.json, read with node. This project needs no interpreter
# beyond the one it already builds with — the app itself carries no Python any more, and
# neither should the script that ships it.
VERSION="$(node -p 'require("./package.json").version')"
TITLE="$(node -p 'const d = require("./package.json"); (d.productName || d.name) + " " + d.version')"
TAG="${TAG:-v$VERSION}"
[ -n "$VERSION" ] || die "cannot read the version from package.json"
[ -n "$TITLE" ] || die "cannot work out a release title"

# The repository is whatever this checkout pushes to, so a fork publishes to the
# fork without editing anything.
REPO="${REPO:-$(git remote get-url origin 2>/dev/null |
  sed -e 's#.*[:/]\([^/]*/[^/]*\)$#\1#' -e 's#\.git$##')}"
[ -n "$REPO" ] || die "cannot work out the Gitea repo — set REPO=owner/name"

# What to upload: the arguments, or the packages in dist/ that belong to *this*
# version. Two things this has to get right:
#
#   - the version filter, because dist/ keeps whatever earlier builds left there
#     and a release would quietly get the previous version's files attached;
#   - the spaces. The built names have none since 2.3.0 — `WarpEngineClient-2.3.0-arm64.dmg`
#     — but a path given as an argument still can, so the list stays one path per line in
#     a file, read with `while IFS= read -r`. Holding it in a single variable and looping
#     over $list splits it on the space, and publishes nothing.
LIST="$(mktemp)"
trap 'rm -f "$LIST"' EXIT
if [ "$#" -gt 0 ]; then
  for given in "$@"; do printf '%s\n' "$given"; done > "$LIST"
else
  find "$DIST" -maxdepth 1 -type f -name "*$VERSION*" \
    \( -name '*.dmg' -o -name '*-mac.zip' -o -name '*.exe' -o -name '*.AppImage' -o -name '*.deb' \) \
    2>/dev/null | sort > "$LIST" || true
fi
[ -s "$LIST" ] || die "no $VERSION packages in $DIST — run 'make dist' first"

say "$REPO $TAG (version $VERSION), login $LOGIN"

# The release id, or empty when there is no such tag. `tea api` exits 0 even for a
# 404 — it answers {"message":"not found"} — so the body is what has to be read.
release_id() {
  tea api "/repos/$REPO/releases/tags/$TAG" 2>/dev/null | node -e '
try {
  console.log(JSON.parse(require("fs").readFileSync(0, "utf8")).id || "")
} catch {
  // Not JSON, or no such release: an empty answer is the "no release yet" case.
}
'
}

# --- the release itself ----------------------------------------------------
if [ -n "$(release_id)" ]; then
  say "the release already exists"
else
  say "creating the release: $TITLE"
  if [ -f "$NOTES" ]; then
    tea releases create --login "$LOGIN" --repo "$REPO" --tag "$TAG" \
      --title "$TITLE" --note-file "$NOTES" >/dev/null
  else
    say "no $NOTES — the release gets a one-line note"
    tea releases create --login "$LOGIN" --repo "$REPO" --tag "$TAG" \
      --title "$TITLE" --note "Packages built from $TAG." >/dev/null
  fi
fi

RELEASE_ID="$(release_id)"
[ -n "$RELEASE_ID" ] || die "the release $TAG could not be created or found"

# --- the attachments -------------------------------------------------------
# Anything already attached under this name, dropped: replacing rather than
# refusing is what makes a rebuild-and-upload repeatable. Called before every
# attempt, so a retry cannot leave two copies behind.
drop_existing() {
  ids="$(tea api "/repos/$REPO/releases/$RELEASE_ID/assets" | node -e '
const name = process.argv[1]
for (const asset of JSON.parse(require("fs").readFileSync(0, "utf8"))) {
  if (asset.name === name) console.log(asset.id)
}
' -- "$1")"
  for id in $ids; do
    say "replacing $1"
    tea api -X DELETE "/repos/$REPO/releases/$RELEASE_ID/assets/$id" >/dev/null
  done
}

while IFS= read -r asset; do
  [ -n "$asset" ] || continue
  [ -f "$asset" ] || die "no such file: $asset"
  name="$(basename "$asset")"
  size="$(node -e 'console.log((require("fs").statSync(process.argv[1]).size / 1e6).toFixed(0) + " MB")' -- "$asset")"

  # Retried, because a 100 MB upload does fail on its own: publishing 1.2.0 got
  # "invalid username, password or token" on the second package while the first
  # had just gone up with the same token, and the identical command succeeded on
  # the next run. One flake should not cost a rebuild.
  attempt=1
  while :; do
    drop_existing "$name"
    say "uploading $name ($size) — large packages take a few minutes"
    if tea releases assets create --login "$LOGIN" --repo "$REPO" "$TAG" "$asset" >/dev/null; then
      break
    fi
    [ "$attempt" -lt 3 ] || die "$name could not be uploaded after $attempt attempts"
    attempt=$((attempt + 1))
    say "that failed — attempt $attempt of 3"
  done
done < "$LIST"

say "done:"
tea api "/repos/$REPO/releases/$RELEASE_ID" | node -e '
const release = JSON.parse(require("fs").readFileSync(0, "utf8"))
for (const asset of release.assets || []) {
  console.log(`  ${asset.name}  ${(asset.size / 1e6).toFixed(0)} MB`)
}
console.log(`  ${release.html_url}`)
'
