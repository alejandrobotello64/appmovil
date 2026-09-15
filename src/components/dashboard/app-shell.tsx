"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Menu, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/dashboard/sidebar";
import { useTheme } from "@/components/theme-provider";
import { clearSession, getSession } from "@/lib/auth";

type AppShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function AppShell({ title, subtitle, children }: AppShellProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [username, setUsername] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Cargando...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((current) => !current)}
              className="inline-flex size-10 items-center justify-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-muted"
              aria-label={sidebarOpen ? "Ocultar menú" : "Mostrar menú"}
            >
              <Menu className="size-5" />
            </button>
            <div>
              <p className="text-xs tracking-wide text-muted-foreground uppercase">
                {subtitle ?? "Panel interno"}
              </p>
              <h1 className="text-lg font-semibold text-foreground">{title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              role="group"
              aria-label="Elegir tema"
              className="hidden items-center gap-1 rounded-full border border-border bg-card p-1 sm:inline-flex"
            >
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${
                  theme === "light"
                    ? "bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                    : "text-muted-foreground"
                }`}
              >
                <Sun className="size-3.5" />
                Claro
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${
                  theme === "dark"
                    ? "bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                    : "text-muted-foreground"
                }`}
              >
                <Moon className="size-3.5" />
                Oscuro
              </button>
            </div>
            <span className="hidden text-sm text-muted-foreground md:inline">
              {username}
            </span>
            <Button variant="outline" onClick={handleLogout}>
              Salir
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
