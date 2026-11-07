export const CHANNELS = {
  getAppInfo: "system:getAppInfo",
  isDarkTheme: "system:isDarkTheme",
  themeChange: "system:themeChange",
  listReleases: "versioning:listReleases",
  install: "versioning:install",
  lastUpdateFailure: "versioning:lastUpdateFailure",
  progress: "versioning:progress",
  checkForUpdates: "menu:checkForUpdates",
  beforeQuit: "app:beforeQuit",
  quitAck: "app:quitAck",
} as const;
