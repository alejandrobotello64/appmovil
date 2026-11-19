"use client";

import { Moon, Sun } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  className?: string;
  showLabel?: boolean;
};

export function ThemeToggle({ className, showLabel = true }: ThemeToggleProps) {
  const { mode, toggleTheme } = useTheme();
  const { t } = useLocale();
  const isDark = mode === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={
        isDark ? t("account.nightOff") : t("account.nightOn")
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border brand-gradient px-3 py-1.5 text-xs font-medium text-[var(--brand-on)] transition-all hover:opacity-90",
        className
      )}
    >
      {isDark ? (
        <>
          <Moon className="size-3.5" />
          {showLabel ? t("account.nightOn") : null}
        </>
      ) : (
        <>
          <Sun className="size-3.5" />
          {showLabel ? t("account.nightOff") : null}
        </>
      )}
    </button>
  );
}
