#!/bin/sh
# Written to disk and started by the app before it quits: replaces the bundle once the app has
# exited, then relaunches it. Usage: swap.sh <app pid> <staged .app> <installed .app> <work dir>
set -u

pid="$1"
staged="$2"
app="$3"
work="$4"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%dT%H:%M:%S')" "$1"
}

# The app quits through its flush; give up after 60 s rather than replace a running bundle.
waited=0
while kill -0 "$pid" 2>/dev/null; do
  if [ "$waited" -ge 600 ]; then
    log "swap_aborted app still running"
    rm -rf "$work"
    exit 1
  fi
  sleep 0.1
  waited=$((waited + 1))
done

# Same replacement as install.sh: the old bundle is set aside, and put back if the copy fails.
backup="$app.old"
rm -rf "$backup"
if ! mv "$app" "$backup"; then
  log "swap_failed could not move the old app aside"
  rm -rf "$work"
  exit 1
fi
if ditto "$staged" "$app"; then
  rm -rf "$backup"
  log "swap_done $app"
else
  rm -rf "$app"
  mv "$backup" "$app"
  log "swap_failed copy failed, old app restored"
fi

rm -rf "$work"
open "$app"
