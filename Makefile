# WarpEngine Store GUI — the front door to the npm scripts.
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

# The version is package.json's, so the release tag never drifts from the app.
VERSION := $(shell python3 -c 'import json; print(json.load(open("package.json"))["version"])')
TAG ?= v$(VERSION)

.DEFAULT_GOAL := help

.PHONY: help setup node-check build typecheck lint lint-fix check start smoke uitest test \
        dist dist-mac dist-win dist-linux release publish clean distclean version

help: ## List available targets
	@echo "WarpEngine Store GUI $(VERSION) — usage: make <target>"
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
check: typecheck lint test ## Type-check, lint, and run both test suites

start: ## Run the app against whatever store is installed
	npm start

smoke: ## Drive the store bridge with no window at all
	npm run smoke

uitest: ## Load the window once and report what rendered
	npm run uitest

test: smoke uitest ## Both checks

dist: node-check ## Package for this machine
	npm run dist

dist-mac: node-check ## Package for macOS (ad-hoc signed, see the README)
	npm run dist:mac

dist-win: node-check ## Package for Windows
	npm run dist:win

dist-linux: node-check ## Package for Linux
	npm run dist:linux

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
	@printf "python3    "; python3 --version 2>/dev/null || echo "missing"
