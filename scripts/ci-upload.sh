#!/bin/sh
# Attach built packages to the Gitea release for this tag.
#
# The local publisher (scripts/release.sh) drives `tea`, which is logged in
# interactively on a workstation. CI has no such session: it has a token and curl. The
# two are deliberately separate scripts rather than one with two ways to authenticate —
# each is short enough to read in full.
#
#   GITEA_TOKEN=… scripts/ci-upload.sh                  every package in dist/
#   GITEA_TOKEN=… scripts/ci-upload.sh dist/one.deb     just these
#
# Creates the release when the tag has none, with RELEASE_NOTES.md as its body. That is
# the flow: a `vX.Y.Z` tag starts this pipeline, which publishes the release with the
# Linux and Windows packages in it, and the macOS package is pushed on top afterwards by
# `make release` from a Mac.
set -eu

FORGE="${FORGE_API:-https://git.teletypegames.org/api/v1}"
REPO="${REPO:-${CI_REPO:-}}"
TAG="${TAG:-${CI_COMMIT_TAG:-}}"
DIST="${DIST:-dist}"
NOTES="${NOTES:-RELEASE_NOTES.md}"

say() { echo "[ci-upload] $*"; }
die() { echo "[ci-upload] error: $*" >&2; exit 1; }

[ -n "${GITEA_TOKEN:-}" ] || die "GITEA_TOKEN is not set — add the gitea_token secret to the repository"
[ -n "$REPO" ] || die "cannot work out the repository — set REPO=owner/name"
[ -n "$TAG" ] || die "cannot work out the tag — set TAG=v1.2.3"

api() {
  method="$1"; path="$2"; shift 2
  curl -fsS -X "$method" -H "Authorization: token $GITEA_TOKEN" "$FORGE$path" "$@"
}

# Package names contain spaces — "WarpEngine Store Setup 1.4.0.exe" does — so the list
# lives one path per line in a file and is read with `while IFS= read -r`. A single
# variable looped over with $list splits on the space and uploads nothing.
LIST="$(mktemp)"
trap 'rm -f "$LIST"' EXIT
if [ "$#" -gt 0 ]; then
  for given in "$@"; do printf '%s\n' "$given"; done > "$LIST"
else
  # What this pipeline builds. The macOS packages are attached from the Mac that can
  # sign them, so they are not listed here even when they happen to be present.
  find "$DIST" -maxdepth 1 -type f \
    \( -name '*.AppImage' -o -name '*.deb' -o -name '*.exe' \) 2>/dev/null | sort > "$LIST" || true
fi
[ -s "$LIST" ] || die "no Linux or Windows packages in $DIST"

say "$REPO $TAG"

# `curl -f` fails on the 404 a missing release answers, so the lookup is allowed to
# fail and judged by what came back rather than by its exit status.
release_id="$(curl -sS -H "Authorization: token $GITEA_TOKEN" \
  "$FORGE/repos/$REPO/releases/tags/$TAG" | jq -r '.id // empty')"

if [ -z "$release_id" ]; then
  say "no release for $TAG yet — creating it"
  title="$(jq -r '(.productName // .name) + " " + (.version)' package.json)"
  notes=''
  [ -f "$NOTES" ] && notes="$(cat "$NOTES")"
  # The body goes through jq rather than string concatenation: release notes are
  # markdown with quotes and newlines in them.
  payload="$(jq -n --arg tag "$TAG" --arg title "$title" --arg body "$notes" \
    '{tag_name: $tag, name: $title, body: $body, draft: false, prerelease: false}')"
  release_id="$(api POST "/repos/$REPO/releases" \
    -H 'Content-Type: application/json' -d "$payload" | jq -r '.id // empty')"
  [ -n "$release_id" ] || die "the release for $TAG could not be created"
else
  say "the release already exists"
fi

while IFS= read -r asset; do
  [ -n "$asset" ] || continue
  [ -f "$asset" ] || die "no such file: $asset"
  name="$(basename "$asset")"
  encoded="$(printf '%s' "$name" | jq -sRr @uri)"

  # Replace rather than refuse, so re-running a build lands.
  existing="$(api GET "/repos/$REPO/releases/$release_id/assets" |
    jq -r --arg name "$name" '.[] | select(.name == $name) | .id')"
  for id in $existing; do
    say "replacing $name"
    api DELETE "/repos/$REPO/releases/$release_id/assets/$id" >/dev/null
  done

  say "uploading $name"
  api POST "/repos/$REPO/releases/$release_id/assets?name=$encoded" \
    -F "attachment=@$asset" >/dev/null
done < "$LIST"

say "done:"
api GET "/repos/$REPO/releases/$release_id" |
  jq -r '.assets[] | "  \(.name)  \(.size / 1000000 | floor) MB"'
