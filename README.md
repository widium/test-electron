# Test Electron

A throwaway test bench for releases and in-app updates of an Electron app (macOS, Apple Silicon).

Install or update:

```bash
curl -fsSL https://raw.githubusercontent.com/widium/test-electron/main/install.sh | sh
```

Build locally, as many times as needed, then publish what was tested:

```bash
npm run make -- <x.y.z>   # moves to a new version, then builds the DMG
npm run make              # rebuilds the current version
npm run publish           # releases the last build on GitHub
```
