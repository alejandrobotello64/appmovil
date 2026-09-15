"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Check, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import {
  clearRememberedCredentials,
  createSession,
  getRememberedCredentials,
  loginWithCredentials,
  saveRememberedCredentials,
} from "@/lib/auth";
import { cn } from "@/lib/utils";

export function LoginForm() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const remembered = getRememberedCredentials();
    if (!remembered) return;
    setUsername(remembered.username);
    setPassword(remembered.password);
    setRemember(true);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const user = await loginWithCredentials(username, password);
      if (!user) {
        setError("Usuario o contraseña incorrectos.");
        return;
      }

      createSession(user);

      if (remember) {
        saveRememberedCredentials({
          username: username.trim(),
          password,
        });
      } else {
        clearRememberedCredentials();
      }

      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo conectar con Supabase. Intenta de nuevo."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-full flex-1 items-center justify-center px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(59,70,165,0.22),transparent_50%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.12),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(59,70,165,0.28),transparent_45%)]"
      />

      <div className="relative w-full max-w-[420px]">
        <div className="mb-6 flex justify-end">
          <div
            role="group"
            aria-label="Elegir tema"
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card/80 p-1 shadow-sm backdrop-blur"
          >
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                theme === "light"
                  ? "bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Sun className="size-3.5" />
              Claro
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                theme === "dark"
                  ? "bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Moon className="size-3.5" />
              Oscuro
            </button>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border/80 bg-card/90 p-8 shadow-[0_20px_60px_-28px_rgba(59,70,165,0.45)] backdrop-blur-sm dark:shadow-[0_20px_60px_-28px_rgba(0,191,255,0.25)]"
        >
          <div className="mb-8 flex flex-col items-center text-center">
            <Image
              src="/assets/logo.jpg"
              alt="Medical Advanced Supplies"
              width={280}
              height={120}
              priority
              className="h-auto w-[240px] object-contain dark:brightness-110"
            />
            <p className="mt-4 text-sm text-muted-foreground">
              Accede al panel de administración
            </p>
          </div>

          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">Usuario / correo</span>
              <input
                type="text"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="correo@empresa.com"
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/25 dark:focus:border-[#00BFFF]"
                required
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">
                Contraseña
              </span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/25 dark:focus:border-[#00BFFF]"
                required
              />
            </label>

            <label className="flex cursor-pointer items-center gap-2.5 select-none">
              <span className="relative inline-flex size-5 shrink-0 items-center justify-center">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  className="peer sr-only"
                />
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-md border-2 transition-colors",
                    remember
                      ? "border-[#3B46A5] bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                      : "border-[#3B46A5]/70 bg-background dark:border-[#00BFFF]/70"
                  )}
                  aria-hidden
                >
                  {remember ? <Check className="size-3.5 stroke-[3]" /> : null}
                </span>
              </span>
              <span className="text-sm text-foreground">
                Recordar datos de inicio
              </span>
            </label>

            {error ? (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-11 w-full rounded-lg border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white shadow-md hover:opacity-90"
            >
              {isSubmitting ? "Ingresando..." : "Iniciar sesión"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
