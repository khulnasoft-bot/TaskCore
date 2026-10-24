#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PC_INSTALL_DRIVER="${PC_INSTALL_DRIVER:-source}"

PC_TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/taskcore-clean-install.XXXXXX")"
PC_HOME="$PC_TEST_ROOT/home"
PC_CACHE="$PC_TEST_ROOT/npm-cache"
mkdir -p "$PC_HOME" "$PC_CACHE"
trap 'rm -rf "$PC_TEST_ROOT"' EXIT

export HOME="$PC_HOME"
export TASKCORE_HOME="$PC_HOME/.taskcore"
export npm_config_cache="$PC_CACHE"
export npm_config_userconfig="$PC_HOME/.npmrc"
export PATH="$PC_HOME/.local/bin:$PATH"

if [ "$PC_INSTALL_DRIVER" = "published" ]; then
  (cd "$PC_TEST_ROOT" && npx --yes --registry https://registry.npmjs.org taskcore install)
else
  (cd "$REPO_ROOT" && pnpm taskcore install --yes)
fi

test -x "$PC_HOME/.local/bin/taskcore"
test -L "$TASKCORE_HOME/cli/current"
test -f "$TASKCORE_HOME/cli/install.json"
taskcore --version

mkdir -p "$TASKCORE_HOME/instances/default"
touch "$TASKCORE_HOME/instances/default/user-data-marker"
(cd "$REPO_ROOT" && pnpm taskcore uninstall)

test ! -e "$TASKCORE_HOME/cli"
test ! -e "$PC_HOME/.local/bin/taskcore"
test -f "$TASKCORE_HOME/instances/default/user-data-marker"
