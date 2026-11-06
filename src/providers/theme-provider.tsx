import { type PropsWithChildren, type ReactNode, useEffect } from "react";

// shadcn's dark variant keys on the `dark` class of <html>; the main owns the OS theme.
export function ThemeProvider({ children }: PropsWithChildren): ReactNode {
  useEffect(() => {
    const apply = (isDark: boolean): void => {
      document.documentElement.classList.toggle("dark", isDark);
    };
    void window.electronAPI.system.isDarkTheme().then(apply);
    return window.electronAPI.system.onThemeChange(apply);
  }, []);

  return children;
}
