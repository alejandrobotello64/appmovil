"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LoginBackground } from "@/components/login-background";
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
    <div className="login-shell relative flex min-h-dvh flex-1 items-center justify-center overflow-hidden px-4 py-8">
      <LoginBackground />

      <div className="relative z-10 w-full max-w-[420px]">
        <div className="mb-6 flex justify-end">
          <ThemeToggle className="touch-target border border-white/15 bg-black/35 text-white shadow-sm backdrop-blur-md hover:bg-black/45" />
        </div>

        <form
          method="post"
          action="/"
          onSubmit={handleSubmit}
          className="rounded-2xl border border-white/20 bg-card/85 p-5 shadow-[0_24px_80px_-28px_rgba(0,0,0,0.65)] backdrop-blur-xl sm:p-8 dark:bg-card/75"
        >
          <div className="mb-8 flex flex-col items-center text-center">
            <Image
              src="/assets/logo.png"
              alt="Medical Advanced Supplies"
              width={280}
              height={120}
              priority
              className="h-auto w-full max-w-[220px] object-contain sm:max-w-[240px] dark:brightness-110"
            />
            <p className="mt-4 text-sm text-muted-foreground">
              Accede al panel de administración
            </p>
          </div>

          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">
                Usuario / correo
              </span>
              <input
                type="text"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="correo@empresa.com"
                className="h-11 w-full rounded-lg border border-input bg-background/90 px-3 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/25 dark:focus:border-[#00BFFF]"
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
                className="h-11 w-full rounded-lg border border-input bg-background/90 px-3 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/25 dark:focus:border-[#00BFFF]"
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
