# Test Electron

A throwaway test bench for releases and in-app updates of an Electron app (macOS, Apple Silicon).

Install or update:

```bash
curl -fsSL https://raw.githubusercontent.com/widium/test-electron/main/install.sh | sh
```

Cut a release:

```bash
npm version <x.y.z>
git push --follow-tags
```
