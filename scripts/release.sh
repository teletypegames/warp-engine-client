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
command -v python3 >/dev/null 2>&1 || die "python3 is required"
[ -f package.json ] || die "run this from the repository root"

VERSION="$(python3 -c 'import json; print(json.load(open("package.json"))["version"])')"
TAG="${TAG:-v$VERSION}"

# The repository is whatever this checkout pushes to, so a fork publishes to the
# fork without editing anything.
REPO="${REPO:-$(git remote get-url origin 2>/dev/null |
  sed -e 's#.*[:/]\([^/]*/[^/]*\)$#\1#' -e 's#\.git$##')}"
[ -n "$REPO" ] || die "cannot work out the Gitea repo — set REPO=owner/name"

# What to upload: the arguments, or every package dist/ holds.
if [ "$#" -gt 0 ]; then
  ASSETS="$*"
else
  ASSETS="$(find "$DIST" -maxdepth 1 -type f \
    \( -name '*.dmg' -o -name '*-mac.zip' -o -name '*.exe' -o -name '*.AppImage' -o -name '*.deb' \) \
    2>/dev/null | sort || true)"
fi
[ -n "$ASSETS" ] || die "no packages in $DIST — run 'make dist' first"

say "$REPO $TAG (version $VERSION), login $LOGIN"

# --- the release itself ----------------------------------------------------
if tea api "/repos/$REPO/releases/tags/$TAG" >/dev/null 2>&1; then
  say "the release already exists"
else
  say "creating the release"
  if [ -f "$NOTES" ]; then
    tea releases create --login "$LOGIN" --repo "$REPO" --tag "$TAG" \
      --title "$(python3 -c 'import json; d=json.load(open("package.json")); print(f"{d.get(\"productName\") or d[\"name\"]} {d[\"version\"]}")')" \
      --note-file "$NOTES" >/dev/null
  else
    say "no $NOTES — the release gets a one-line note"
    tea releases create --login "$LOGIN" --repo "$REPO" --tag "$TAG" \
      --title "$(python3 -c 'import json; d=json.load(open("package.json")); print(f"{d.get(\"productName\") or d[\"name\"]} {d[\"version\"]}")')" \
      --note "Packages built from $TAG." >/dev/null
  fi
fi

RELEASE_ID="$(tea api "/repos/$REPO/releases/tags/$TAG" |
  python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')"

# --- the attachments -------------------------------------------------------
for asset in $ASSETS; do
  [ -f "$asset" ] || die "no such file: $asset"
  name="$(basename "$asset")"

  # Replacing rather than refusing: a second run after a rebuild should land.
  old="$(tea api "/repos/$REPO/releases/$RELEASE_ID/assets" | python3 -c "
import json, sys
name = sys.argv[1]
for a in json.load(sys.stdin):
    if a['name'] == name:
        print(a['id'])
" "$name")"
  for id in $old; do
    say "replacing $name"
    tea api -X DELETE "/repos/$REPO/releases/$RELEASE_ID/assets/$id" >/dev/null
  done

  size="$(python3 -c "import os,sys; print(f'{os.path.getsize(sys.argv[1])/1e6:.0f} MB')" "$asset")"
  say "uploading $name ($size) — large packages take a few minutes"
  tea releases assets create --login "$LOGIN" --repo "$REPO" "$TAG" "$asset" >/dev/null
done

say "done:"
tea api "/repos/$REPO/releases/$RELEASE_ID" | python3 -c "
import json, sys
r = json.load(sys.stdin)
for a in r.get('assets') or []:
    print(f\"  {a['name']}  {a['size']/1e6:.0f} MB\")
print(f\"  {r['html_url']}\")"
