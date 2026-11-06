import path from "node:path";

// Mirrors `paths` in tsconfig.json: the editor and the build must resolve `@/…` the same way.
export const alias = { "@": path.resolve(import.meta.dirname, "../src") };
