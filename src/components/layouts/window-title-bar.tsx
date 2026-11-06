import type { CSSProperties, ReactElement, ReactNode } from "react";

// React's CSSProperties has no WebkitAppRegion.
const drag = { WebkitAppRegion: "drag" } as CSSProperties;
const noDrag = { WebkitAppRegion: "no-drag" } as CSSProperties;

// The window has no native title bar: this one drags the window, and `pl-20` keeps clear of the
// traffic lights. Anything clickable goes in the no-drag slot, or a click starts a drag.
export function WindowTitleBar({ children }: { children?: ReactNode }): ReactElement {
  return (
    <div
      className="flex h-[30px] w-full shrink-0 items-center justify-end pr-2 pl-20 select-none"
      style={drag}
    >
      <div style={noDrag}>{children}</div>
    </div>
  );
}
