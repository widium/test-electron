import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import type { Release } from "../../../versioning/updater";
import { megabytes } from "./megabytes";

type RelationLook = {
  badge: { label: string; className: string } | null;
  accent: string;
  action: string;
  primary: boolean;
};

// GitHub's dark-theme green and blue: the installed version, and the versions newer than it.
const LOOKS: Record<Release["relation"], RelationLook> = {
  current: {
    badge: { label: "Installed", className: "border-[#238636] text-[#3fb950]" },
    accent: "border-l-[#3fb950]",
    action: "Install",
    primary: false,
  },
  newer: {
    badge: { label: "New", className: "border-[#1f6feb] text-[#58a6ff]" },
    accent: "border-l-[#58a6ff]",
    action: "Install",
    primary: true,
  },
  older: { badge: null, accent: "border-l-transparent", action: "Downgrade", primary: false },
};

export function ReleaseRow({
  release,
  busy,
  onInstall,
}: {
  release: Release;
  busy: boolean;
  onInstall: (tag: string) => void;
}): ReactElement {
  const look = LOOKS[release.relation];
  const installable = release.relation !== "current" && release.dmgSize !== null;
  return (
    <li className={`flex items-center justify-between gap-4 border-l-4 px-4 py-3 ${look.accent}`}>
      <div className="flex flex-col">
        <span className="font-medium">
          {release.tag}
          {look.badge && (
            <span
              className={`ml-2 rounded-full border px-2 py-0.5 text-xs ${look.badge.className}`}
            >
              {look.badge.label}
            </span>
          )}
        </span>
        <span className="text-xs text-muted-foreground">
          {new Date(release.publishedAt).toLocaleString()}
          {release.dmgSize === null
            ? " · no verified download"
            : ` · ${megabytes(release.dmgSize)}`}
        </span>
      </div>
      <Button
        size="sm"
        variant={look.primary ? "default" : "outline"}
        disabled={!installable || busy}
        onClick={() => onInstall(release.tag)}
      >
        {look.action}
      </Button>
    </li>
  );
}
