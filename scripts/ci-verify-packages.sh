#!/bin/sh
# Fail on a package that is too small to be one.
#
# Written after a Wine build died halfway and left a 162 KB stub named like the real
# installer: `ls` was happy, the step passed, and the release would have carried a file
# that cannot be run. An Electron package is ~100 MB — anything under a tenth of that
# did not finish.
#
#   scripts/ci-verify-packages.sh '*.AppImage' '*.deb'
set -eu

DIST="${DIST:-dist}"
MIN_BYTES="${MIN_BYTES:-10000000}"

die() { echo "[verify] error: $*" >&2; exit 1; }

[ "$#" -gt 0 ] || die "no patterns given"

for pattern in "$@"; do
  found=0
  # One path per line: package names contain spaces.
  find "$DIST" -maxdepth 1 -type f -name "$pattern" | sort > /tmp/verify-list
  while IFS= read -r file; do
    [ -n "$file" ] || continue
    found=1
    size="$(wc -c < "$file" | tr -d ' ')"
    if [ "$size" -lt "$MIN_BYTES" ]; then
      die "$file is only $size bytes — the build did not finish"
    fi
    echo "[verify] $(basename "$file"): $size bytes"
  done < /tmp/verify-list
  [ "$found" -eq 1 ] || die "no $pattern in $DIST"
done

rm -f /tmp/verify-list
