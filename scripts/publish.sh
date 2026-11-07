#!/bin/sh
set -eu
cd "$(dirname "$0")/.."

version="${1:-}"
tag="v$version"

step() {
  printf '\n→ %s\n' "$1"
}

fail() {
  printf '✗ %s\n' "$1" >&2
  exit 1
}

[ -n "$version" ] || fail "Give the version: npm run publish -- <x.y.z>"
[ -z "$(git status --porcelain)" ] || fail "Uncommitted changes: commit them first."

# The tag already on the current commit means an earlier publish stopped after tagging: resume.
if [ "$(git rev-parse -q --verify "refs/tags/$tag^{commit}" || true)" != "$(git rev-parse HEAD)" ]; then
  current="$(node -p 'require("./package.json").version')"
  highest="$(printf '%s\n%s\n' "$current" "$version" | sort -V | tail -n 1)"
  if [ "$version" = "$current" ] || [ "$highest" != "$version" ]; then
    fail "$version is not above the current version $current."
  fi
  step "Version $version"
  npm version "$version"
  git push --follow-tags
fi

# Forge builds the DMG and uploads it to a draft release, invisible to the app and install.sh
# until the DMG is complete.
step "Build and upload"
GITHUB_TOKEN="$(gh auth token)" electron-forge publish

step "Release"
gh release edit "$tag" --draft=false >/dev/null
printf '✓ Released: %s\n' "$(gh release view "$tag" --json url -q .url)"
