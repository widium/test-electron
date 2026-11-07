#!/bin/sh
set -eu

product="Test Electron"
# The repository and the DMG name of versioning/config.ts, copied: curl downloads this script alone.
dmg_url="https://github.com/widium/test-electron/releases/latest/download/TestElectron-darwin-arm64.dmg"
installed_app="/Applications/$product.app"
quit_wait_seconds=60

# UTC, like the app's own lines in update.log.
say() {
  printf '%s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$1"
}

version_of() {
  /usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' "$1/Contents/Info.plist"
}

fail() {
  say "$1" >&2
  exit 1
}

# The one bundle replacement: the old bundle is set aside, and put back if the copy fails.
replace() {
  new_app="$1"
  target="$2"
  backup="$target.old"
  rm -rf "$backup"
  if [ -e "$target" ] && ! mv "$target" "$backup"; then
    say "Could not move the old app aside: nothing changed."
    return 1
  fi
  if ditto "$new_app" "$target"; then
    rm -rf "$backup"
    return 0
  fi
  rm -rf "$target"
  if [ -e "$backup" ]; then mv "$backup" "$target"; fi
  say "The copy failed: the previous version is back in place."
  return 1
}

install_latest() {
  [ "$(uname -s)" = Darwin ] || fail "macOS only."
  [ "$(uname -m)" = arm64 ] || fail "Apple Silicon only, there is no Intel build."
  [ -w "$(dirname "$installed_app")" ] || fail "$(dirname "$installed_app") is not writable by $(id -un)."
  if pgrep -f "$installed_app/Contents/MacOS/$product" >/dev/null; then
    fail "$product is running. Quit it, then run this again."
  fi

  tmp="$(mktemp -d)"
  mount="$tmp/mount"
  trap 'hdiutil detach "$mount" -quiet 2>/dev/null || true; rm -rf "$tmp"' EXIT

  say "Downloading $product..."
  curl -fL --progress-bar "$dmg_url" -o "$tmp/app.dmg" || fail "The download failed."
  hdiutil attach "$tmp/app.dmg" -nobrowse -readonly -quiet -mountpoint "$mount" ||
    fail "Could not open the DMG."
  replace "$mount/$product.app" "$installed_app" || exit 1

  say "Installed $product $(version_of "$installed_app") in $(dirname "$installed_app")."
}

# Started by the app, already verified, right before it quits: wait for it, replace, relaunch.
update_from() {
  new_app="$1"
  target="$2"
  pid="$3"
  trap 'rm -rf "$new_app"; rmdir "$(dirname "$new_app")" 2>/dev/null || true' EXIT

  waited=0
  while kill -0 "$pid" 2>/dev/null; do
    [ "$waited" -lt "$quit_wait_seconds" ] ||
      fail "The app was still running after ${quit_wait_seconds} s: update cancelled."
    sleep 1
    waited=$((waited + 1))
  done

  if replace "$new_app" "$target"; then
    say "Updated $target to $(version_of "$target")."
    open "$target"
  else
    # The flag the updater reads at launch (UPDATE_FAILED_FLAG): the app tells the user.
    open "$target" --args --update-failed
  fi
}

case $# in
  0) install_latest ;;
  3) update_from "$1" "$2" "$3" ;;
  *) fail "Usage: install.sh, or install.sh <new app> <installed app> <app pid>" ;;
esac
