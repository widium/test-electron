import { createHash } from "node:crypto";
import { once } from "node:events";
import fs from "node:fs";
import { finished } from "node:stream/promises";

import { fetchFromGitHub, type ReleaseDmg } from "./github";

// Hashes the file as it arrives: a download that does not match the release's digest is refused.
export async function downloadVerified(
  dmg: ReleaseDmg,
  file: string,
  onProgress: (received: number) => void,
): Promise<void> {
  const response = await fetchFromGitHub(dmg.url);
  if (!response.body) throw new Error("download_empty_body");
  const reader = response.body.getReader();
  const hash = createHash("sha256");
  const out = fs.createWriteStream(file);
  let received = 0;
  let reportedPercent = -1;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      hash.update(value);
      received += value.length;
      if (!out.write(value)) await once(out, "drain");
      const percent = Math.floor((received / dmg.size) * 100);
      if (percent !== reportedPercent) {
        reportedPercent = percent;
        onProgress(received);
      }
    }
  } catch (error) {
    // Closes the connection instead of leaving it open until garbage collection.
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    out.end();
    await finished(out);
  }
  if (hash.digest("hex") !== dmg.sha256) throw new Error("download_digest_mismatch");
}
