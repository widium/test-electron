#!/bin/sh
set -eu
cd "$(dirname "$0")/.."

asset="TestElectron-darwin-arm64.dmg"
build="out/make/build.env"

fail() {
  printf '✗ %s\n' "$1" >&2
  exit 1
}

done_step() {
  printf '✓ %s\n' "$1"
}

[ -f "$build" ] || fail "Nothing built yet: run npm run make first."
. "./$build"
tag="v$VERSION"
head="$(git rev-parse HEAD)"

printf 'Publishing %s\n' "$tag"
[ -z "$(git status --porcelain)" ] || fail "Uncommitted changes: commit them, then npm run make again."
[ "$COMMIT" = "$head" ] || fail "The DMG was not built from the current commit: run npm run make again."
done_step "DMG built from the current commit ($(git rev-parse --short HEAD))"

repo="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
if gh release view "$tag" >/dev/null 2>&1; then fail "$tag is already released."; fi
done_step "$tag is not released yet"

git push -q origin HEAD
if ! git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then git tag "$tag"; fi
[ "$(git rev-list -n 1 "$tag")" = "$head" ] || fail "Tag $tag already points to another commit."
git push -q origin "$tag"
done_step "Pushed $(git branch --show-current) and tag $tag"

# The release stays a draft until its DMG is fully uploaded: the app and install.sh never see a
# release without its DMG. A failed upload deletes the draft, so publish can simply run again.
release_id="$(gh api -X POST "repos/$repo/releases" -f tag_name="$tag" -f name="$tag" \
  -F draft=true -F generate_release_notes=true --jq .id)"
published=""
discard_draft() {
  [ -n "$published" ] || gh api -X DELETE "repos/$repo/releases/$release_id" >/dev/null 2>&1 || true
}
trap discard_draft EXIT

printf 'Uploading %s (%s MB)\n' "$asset" "$(($(stat -f %z "$DMG") / 1000000))"
curl --fail --progress-bar -o /dev/null -X POST -T "$DMG" \
  -H "Authorization: Bearer $(gh auth token)" \
  -H "Content-Type: application/x-apple-diskimage" \
  "https://uploads.github.com/repos/$repo/releases/$release_id/assets?name=$asset" ||
  fail "Upload failed: the draft is deleted, run npm run publish again."
done_step "Uploaded"

url="$(gh api -X PATCH "repos/$repo/releases/$release_id" -F draft=false --jq .html_url)"
published="yes"
done_step "Released: $url"
