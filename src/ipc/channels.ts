export const CHANNELS = {
  getAppInfo: "system:getAppInfo",
  isDarkTheme: "system:isDarkTheme",
  themeChange: "system:themeChange",
  listReleases: "updates:listReleases",
  install: "updates:install",
  progress: "updates:progress",
  checkForUpdates: "menu:checkForUpdates",
  beforeQuit: "app:beforeQuit",
  quitAck: "app:quitAck",
} as const;
