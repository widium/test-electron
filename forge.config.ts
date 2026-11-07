import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { MakerDMG } from "@electron-forge/maker-dmg";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { PublisherGitHub } from "@electron-forge/publisher-github";
import type { ForgeConfig } from "@electron-forge/shared-types";

const run = promisify(execFile);

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    appBundleId: "com.bidium.test-electron",
  },
  hooks: {
    // Flipping fuses invalidates the signature, and an unsigned arm64 binary does not run:
    // sign the whole bundle ad-hoc again once it is fully assembled.
    postPackage: async (_config, { outputPaths, platform }) => {
      if (platform !== "darwin") return;
      for (const outputPath of outputPaths) {
        const bundle = (await fs.readdir(outputPath)).find((entry) => entry.endsWith(".app"));
        if (bundle)
          await run("codesign", [
            "--force",
            "--deep",
            "--sign",
            "-",
            path.join(outputPath, bundle),
          ]);
      }
    },
  },
  // A fixed file name: install.sh and the in-app updater download the DMG by this name.
  makers: [new MakerDMG({ name: "TestElectron-darwin-arm64", title: "Test Electron" })],
  publishers: [
    new PublisherGitHub({
      repository: { owner: "widium", name: "test-electron" },
      draft: true,
      generateReleaseNotes: true,
    }),
  ],
  plugins: [
    new VitePlugin({
      build: [
        { entry: "src/main.ts", config: "config/vite.main.config.ts" },
        { entry: "src/preload.ts", config: "config/vite.preload.config.ts" },
      ],
      renderer: [{ name: "main_window", config: "config/vite.renderer.config.ts" }],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      resetAdHocDarwinSignature: true,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableCookieEncryption]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
