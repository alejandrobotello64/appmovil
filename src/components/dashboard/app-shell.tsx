"use client";

import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/dashboard/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { clearSession, getSession } from "@/lib/auth";
import { GlobalSearch } from "@/components/dashboard/global-search";

type AppShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function AppShell({ title, subtitle, children }: AppShellProps) {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/");
      return;
    }
    setUsername(session.username);
  }, [router]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    setSidebarOpen(media.matches);

    function handleChange(event: MediaQueryListEvent) {
      setSidebarOpen(event.matches);
    }

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  function handleLogout() {
    clearSession();
    router.replace("/");
  }

  if (!username) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
        Cargando...
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh bg-background">
      <Suspense fallback={<aside className="hidden w-72 border-r border-border lg:block" />}>
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </Suspense>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="app-header sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/95 backdrop-blur sm:gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((current) => !current)}
              className="touch-target inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-muted"
              aria-label={sidebarOpen ? "Ocultar menú" : "Mostrar menú"}
              aria-expanded={sidebarOpen}
            >
              <Menu className="size-5" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-[10px] tracking-wide text-muted-foreground uppercase sm:text-xs">
                {subtitle ?? "Panel interno"}
              </p>
              <h1 className="truncate text-base font-semibold text-foreground sm:text-lg">
                {title}
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            <GlobalSearch />
            <ThemeToggle
              showLabel={false}
              className="touch-target size-11 justify-center px-0 py-0 sm:size-auto sm:px-3 sm:py-1.5"
            />
            <span className="hidden max-w-[140px] truncate text-sm text-muted-foreground lg:inline">
              {username}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="touch-target h-11 px-3 sm:h-9 sm:px-3"
            >
              <LogOut className="size-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Salir</span>
            </Button>
          </div>
        </header>

        <main className="app-main flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
