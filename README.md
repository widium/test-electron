# Test Electron

A throwaway test bench for releases and in-app updates of an Electron app (macOS, Apple Silicon).

Install or update:

```bash
curl -fsSL https://raw.githubusercontent.com/widium/test-electron/main/versioning/install.sh | sh
```

Build locally to try the app, then release a version:

```bash
npm run make               # builds the DMG of the current state, as often as needed
npm run publish -- <x.y.z> # versions, tags, pushes, builds and releases on GitHub
```
