#!/bin/sh
# node_modules for the pipeline. The check step's image (git.teletypegames.org/build/
# warp-engine-client-ci:node22, built by services/teletypegames ci/warp-engine-client.Dockerfile)
# has them in /ci, installed from the package-lock.json whose sha256 is next to them. When that
# is this package-lock.json they are copied (a second); otherwise `npm ci` installs them.
set -eu

if [ -r /ci/package-lock.sha256 ] &&
  [ "$(sha256sum package-lock.json | cut -d' ' -f1)" = "$(cat /ci/package-lock.sha256)" ]; then
  echo "[ci-npm] node_modules from the CI image"
  rm -rf node_modules
  cp -a /ci/node_modules .
else
  echo "[ci-npm] package-lock.json differs from the CI image's: npm ci"
  npm ci
fi
