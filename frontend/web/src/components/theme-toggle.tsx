"use client";

import React from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-8.5 h-8.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" />;
  }

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200 flex items-center justify-center shadow-sm"
      title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      {theme === "light" ? (
        <Moon className="w-4.5 h-4.5 text-slate-700" />
      ) : (
        <Sun className="w-4.5 h-4.5 text-amber-400 animate-pulse" />
      )}
    </button>
  );
}
