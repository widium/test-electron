#!/bin/sh
# Installs or updates Test Electron from the latest GitHub release. Run it again to update.
set -eu

dmg_url="https://github.com/widium/test-electron/releases/latest/download/TestElectron-darwin-arm64.dmg"
app_dir="/Applications"
app="$app_dir/Test Electron.app"

fail() {
  printf 'test-electron install: %s\n' "$1" >&2
  exit 1
}

[ "$(uname -s)" = Darwin ] || fail "macOS only."
[ "$(uname -m)" = arm64 ] || fail "Apple Silicon only, there is no Intel build."
[ -w "$app_dir" ] || fail "$app_dir is not writable by $(id -un)."
if pgrep -f "$app/Contents/MacOS/Test Electron" >/dev/null; then
  fail "Test Electron is running. Quit it, then run this again."
fi

tmp="$(mktemp -d)"
mount="$tmp/mount"
cleanup() {
  hdiutil detach "$mount" -quiet 2>/dev/null || true
  rm -rf "$tmp"
}
trap cleanup EXIT

printf 'Downloading Test Electron...\n'
curl -fL --progress-bar "$dmg_url" -o "$tmp/app.dmg" || fail "download failed."
hdiutil attach "$tmp/app.dmg" -nobrowse -readonly -quiet -mountpoint "$mount" ||
  fail "could not open the DMG."

# Same replacement as the in-app updater: the old bundle is set aside, and put back if the copy fails.
backup="$app.old"
rm -rf "$backup"
[ -e "$app" ] && mv "$app" "$backup"
if ! ditto "$mount/Test Electron.app" "$app"; then
  rm -rf "$app"
  [ -e "$backup" ] && mv "$backup" "$app"
  fail "copy failed, the previous version is back in place."
fi
rm -rf "$backup"

version="$(/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' "$app/Contents/Info.plist")"
printf 'Installed Test Electron %s in %s.\n' "$version" "$app_dir"
