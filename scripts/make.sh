#!/bin/sh
set -eu
cd "$(dirname "$0")/.."

fail() {
  printf 'make: %s\n' "$1" >&2
  exit 1
}

new_version="${1:-}"
if [ -n "$new_version" ]; then
  current="$(node -p 'require("./package.json").version')"
  highest="$(printf '%s\n%s\n' "$current" "$new_version" | sort -V | tail -n 1)"
  if [ "$new_version" = "$current" ] || [ "$highest" != "$new_version" ]; then
    fail "$new_version is not above the current version $current."
  fi
  npm version "$new_version" --no-git-tag-version >/dev/null || fail "$new_version is not a valid next version."
  git add package.json package-lock.json
  git commit -q -m "$new_version"
fi

electron-forge make

version="$(node -p 'require("./package.json").version')"
product="$(node -p 'require("./package.json").productName')"
dmg="out/make/dmg/arm64/$product-$version-arm64.dmg"
[ -f "$dmg" ] || fail "Forge did not write $dmg."

# What publish releases: this exact DMG, built from this exact commit. Uncommitted changes make the
# build unpublishable, so they never ship without a commit behind them.
commit="$(git rev-parse HEAD)"
[ -z "$(git status --porcelain)" ] || commit="$commit-dirty"
printf "VERSION='%s'\nCOMMIT='%s'\nDMG='%s'\n" "$version" "$commit" "$dmg" >out/make/build.env

printf '\nBuilt %s %s: %s\n' "$product" "$version" "$dmg"
