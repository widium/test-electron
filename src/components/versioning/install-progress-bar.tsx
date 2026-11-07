import type { ReactElement } from "react";

import type { InstallProgress } from "../../../versioning/updater";
import { megabytes } from "./megabytes";

function progressLabel(progress: InstallProgress | null): string {
  if (!progress) return "starting…";
  if (progress.stage === "download")
    return `downloading ${megabytes(progress.received)} / ${megabytes(progress.total)}`;
  if (progress.stage === "verify") return "checking the download…";
  return "restarting…";
}

function progressPercent(progress: InstallProgress | null): number {
  if (!progress) return 0;
  if (progress.stage === "download") return (progress.received / progress.total) * 100;
  return 100;
}

export function InstallProgressBar({
  tag,
  progress,
}: {
  tag: string;
  progress: InstallProgress | null;
}): ReactElement {
  return (
    <section className="flex flex-col gap-2 rounded-xl border p-4">
      <span>
        Installing {tag}: {progressLabel(progress)}
      </span>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${progressPercent(progress)}%` }}
        />
      </div>
    </section>
  );
}
