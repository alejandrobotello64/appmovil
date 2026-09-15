"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  className?: string;
  showLabel?: boolean;
};

export function ThemeToggle({ className, showLabel = true }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] px-3 py-1.5 text-xs font-medium text-white transition-all hover:opacity-90",
        className
      )}
    >
      {isDark ? (
        <>
          <Moon className="size-3.5" />
          {showLabel ? "Oscuro" : null}
        </>
      ) : (
        <>
          <Sun className="size-3.5" />
          {showLabel ? "Claro" : null}
        </>
      )}
    </button>
  );
}
