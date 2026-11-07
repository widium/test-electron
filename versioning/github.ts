import { VERSIONING } from "./config";

const { owner, name } = VERSIONING.repository;
const RELEASES_URL = `https://api.github.com/repos/${owner}/${name}/releases?per_page=30`;
const DMG_FILE = `${VERSIONING.dmgName}.dmg`;
const DIGEST_PREFIX = "sha256:";

// GitHub refuses API requests without a User-Agent (403).
const HEADERS = { "User-Agent": name, Accept: "application/vnd.github+json" };

export type ReleaseDmg = { url: string; size: number; sha256: string };

export type PublishedRelease = {
  tag: string;
  version: string;
  publishedAt: string;
  pageUrl: string;
  dmg: ReleaseDmg | null;
};

export type ReleasesResult =
  | { ok: true; releases: PublishedRelease[] }
  | { ok: false; reason: "rate_limited" | "unavailable"; error: unknown };

type GitHubAsset = {
  name: string;
  size: number;
  digest: string | null;
  browser_download_url: string;
};

type GitHubRelease = {
  tag_name: string;
  prerelease: boolean;
  published_at: string;
  html_url: string;
  assets: GitHubAsset[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isGitHubAsset(value: unknown): value is GitHubAsset {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.size === "number" &&
    (typeof value.digest === "string" || value.digest === null) &&
    typeof value.browser_download_url === "string"
  );
}

function isGitHubRelease(value: unknown): value is GitHubRelease {
  return (
    isRecord(value) &&
    typeof value.tag_name === "string" &&
    typeof value.prerelease === "boolean" &&
    typeof value.published_at === "string" &&
    typeof value.html_url === "string" &&
    Array.isArray(value.assets) &&
    value.assets.every(isGitHubAsset)
  );
}

function versionOfTag(tag: string): string {
  return tag.replace(/^v/, "");
}

// Without a SHA-256 digest the download cannot be verified, so the release has no installable DMG.
function installableDmg(assets: GitHubAsset[]): ReleaseDmg | null {
  const asset = assets.find((candidate) => candidate.name === DMG_FILE);
  if (!asset?.digest?.startsWith(DIGEST_PREFIX)) return null;
  return {
    url: asset.browser_download_url,
    size: asset.size,
    sha256: asset.digest.slice(DIGEST_PREFIX.length),
  };
}

export async function fetchFromGitHub(url: string): Promise<Response> {
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) throw new Error(`github_http_${response.status} ${url}`);
  return response;
}

// 60 requests per hour without a token; past it GitHub answers 403 or 429 (its documented behavior).
function isRateLimited(response: Response): boolean {
  return (
    response.status === 429 ||
    (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0")
  );
}

// GitHub lists drafts only to authenticated requests, so a publish still uploading never shows.
export async function fetchReleases(): Promise<ReleasesResult> {
  try {
    const response = await fetch(RELEASES_URL, { headers: HEADERS });
    if (isRateLimited(response))
      return { ok: false, reason: "rate_limited", error: `github_rate_limited ${response.status}` };
    if (!response.ok) throw new Error(`github_http_${response.status} ${RELEASES_URL}`);
    const body: unknown = await response.json();
    if (!Array.isArray(body) || !body.every(isGitHubRelease))
      throw new Error("github_invalid_response");
    const releases = body
      .filter((release) => !release.prerelease)
      .map((release) => ({
        tag: release.tag_name,
        version: versionOfTag(release.tag_name),
        publishedAt: release.published_at,
        pageUrl: release.html_url,
        dmg: installableDmg(release.assets),
      }));
    return { ok: true, releases };
  } catch (error) {
    return { ok: false, reason: "unavailable", error };
  }
}
