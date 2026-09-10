# WarpEngine Client — the front door to the npm scripts.
#
# Everything here is a thin wrapper: the app is an Electron project, so npm still
# does the work. The Makefile exists so the useful sequences have names, and so
# `make release` is one command rather than a build followed by remembered tea
# invocations.
#
#   make            list the targets
#   make setup      install the dependencies
#   make check      typecheck, lint and both test suites
#   make dist       package for this machine
#   make release    package and publish to Gitea
#
# Publishing assumes `tea` is installed and logged in — the devarea repo has
# `make tea` for that.

SHELL := /bin/sh
SCRIPTS := scripts
NODE_MIN := 22

# The version is package.json's, so the release tag never drifts from the app. Read with
# node, which this project already requires — nothing here needs an interpreter the app
# itself no longer depends on.
VERSION := $(shell node -p 'require("./package.json").version')
TAG ?= v$(VERSION)

# Which site's store registry a packaged build reads. Empty means the default in
# package.json (ours); set it to build a client for somebody else's catalog:
#
#   make dist STORES_API=https://games.example.org/api/stores
#
# It is baked into the package's own package.json, so the built app carries it. A runtime
# STORES_API still overrides it, which is for trying something out rather than shipping.
STORES_API ?=

# A brand: a name for the window and a store to install first, baked in the same way.
# Optional, all of it — without BRAND_NAME the build is the generic WarpEngine Client.
# BRAND_ID names the appId and the package files, so a branded and a generic client can
# live on one machine; RELEASES_API is where the branded build's own releases are listed.
#
#   make dist BRAND_NAME="Teletype Games Store" BRAND_STORE=https://teletypegames.org BRAND_ID=teletype-store
#
# A runtime BRAND_NAME + BRAND_STORE pair overrides the baked brand, for trying one out.
BRAND_NAME ?=
BRAND_STORE ?=
BRAND_ID ?=
RELEASES_API ?=

REGISTRY_ARGS := $(if $(STORES_API),--config.extraMetadata.warpEngine.registryUrl=$(STORES_API),)
BRAND_ARGS := $(if $(BRAND_NAME),--config.extraMetadata.warpEngine.brand.name="$(BRAND_NAME)" --config.productName="$(BRAND_NAME)",) \
              $(if $(BRAND_STORE),--config.extraMetadata.warpEngine.brand.catalogUrl=$(BRAND_STORE),) \
              $(if $(RELEASES_API),--config.extraMetadata.warpEngine.releasesUrl=$(RELEASES_API),) \
              $(if $(BRAND_ID),--config.appId=org.teletypegames.warpstore.gui.$(BRAND_ID) \
                --config.mac.artifactName='$(BRAND_ID)-$${version}-$${arch}-mac.$${ext}' \
                --config.dmg.artifactName='$(BRAND_ID)-$${version}-$${arch}.$${ext}' \
                --config.nsis.artifactName='$(BRAND_ID)-Setup-$${version}-$${arch}.$${ext}' \
                --config.portable.artifactName='$(BRAND_ID)-Portable-$${version}-$${arch}.$${ext}' \
                --config.appImage.artifactName='$(BRAND_ID)-$${version}-$${arch}.$${ext}',)
BUILDER_ARGS := $(if $(strip $(REGISTRY_ARGS) $(BRAND_ARGS)),-- $(REGISTRY_ARGS) $(BRAND_ARGS),)

.DEFAULT_GOAL := help

.PHONY: help setup node-check build typecheck lint lint-fix check start smoke uitest storetest icons test \
        dist dist-mac dist-win dist-linux release publish clean distclean version

help: ## List available targets
	@echo "WarpEngine Client $(VERSION) — usage: make <target>"
	@echo
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  %-12s %s\n", $$1, $$2}'
	@echo
	@echo "  Variables: TAG=$(TAG)  TEA_LOGIN=ttg  REPO=<owner/name>  NOTES=RELEASE_NOTES.md"

node-check: ## Check the Node version Electron's installer needs
	@node -e 'const [maj] = process.versions.node.split("."); \
		if (Number(maj) < $(NODE_MIN)) { \
			console.error("Node $(NODE_MIN)+ is needed to install Electron (found " + process.versions.node + \
				"): its installer is ESM-only. The packaged app carries its own runtime."); \
			process.exit(1); \
		} else { console.log("node " + process.versions.node + " ok"); }'

setup: node-check ## Install the dependencies
	npm install

build: ## Compile TypeScript and bundle the preload and the renderer
	npm run build

typecheck: ## Type-check everything, emitting nothing
	npm run typecheck

lint: ## Lint with the strict rule set
	npm run lint

lint-fix: ## Lint and fix what can be fixed automatically
	npm run lint:fix

# The order is deliberate: a type error explains a lint error, and both explain a
# failing test, so the cheapest check that can fail runs first.
check: typecheck lint test ## Type-check, lint, and run every test suite

start: ## Run the app against whatever store is installed
	npm start

smoke: ## Drive the store bridge with no window at all
	npm run smoke

uitest: ## Load the window once and report what rendered
	npm run uitest

icons: ## Render every icon format from resources/icon.svg
	npm run icons

storetest: ## Add and remove a store in a sandbox (the only code that deletes a tree)
	npm run storetest

test: smoke storetest uitest ## All three checks

dist: node-check ## Package for this machine
	npm run dist $(BUILDER_ARGS)

dist-mac: node-check ## Package for macOS (ad-hoc signed, see the README)
	npm run dist:mac $(BUILDER_ARGS)

dist-win: node-check ## Package for Windows
	npm run dist:win $(BUILDER_ARGS)

dist-linux: node-check ## Package for Linux
	npm run dist:linux $(BUILDER_ARGS)

publish: ## Upload the packages already in dist/ to the Gitea release
	@TAG=$(TAG) $(SCRIPTS)/release.sh

# clean first: dist/ keeps earlier builds, and a release should be made of exactly
# what this version produced.
release: clean dist publish ## Package for this machine and publish it

clean: ## Remove the compiled output and the built packages
	rm -rf build dist

distclean: clean ## Remove the packages and the dependencies
	rm -rf node_modules

version: ## Show the versions involved
	@echo "app        $(VERSION) (tag $(TAG))"
	@printf "node       "; node --version 2>/dev/null || echo "missing"
	@printf "npm        "; npm --version 2>/dev/null || echo "missing"
	@printf "electron   "; node -p "require('./package.json').devDependencies.electron" 2>/dev/null || echo "missing"
	@printf "typescript "; npx tsc --version 2>/dev/null || echo "missing"
	@printf "eslint     "; npx eslint --version 2>/dev/null || echo "missing"
	@printf "tea        "; tea --version 2>/dev/null | head -1 || echo "missing — devarea: make tea"
	@printf "registry   "; node -p 'require("./package.json").warpEngine.registryUrl'
	@if [ -n "$(STORES_API)" ]; then printf "  build override: %s\n" "$(STORES_API)"; fi
	@if [ -n "$(BRAND_NAME)" ]; then printf "  brand:          %s → %s (%s)\n" "$(BRAND_NAME)" "$(BRAND_STORE)" "$(BRAND_ID)"; fi
