// install.sh keeps its own copy of these values: curl downloads it alone, without this file.
export const VERSIONING = {
  repository: { owner: "widium", name: "test-electron" },
  dmgName: "TestElectron-darwin-arm64",
  bundleId: "com.bidium.test-electron",
} as const;
