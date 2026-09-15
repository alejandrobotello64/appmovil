import { supabase } from "@/lib/supabase/client";

const SESSION_KEY = "mas-session";
const REMEMBER_KEY = "mas-remember";

export type AppUser = {
  id: string;
  username: string;
  fullName: string | null;
  role: string;
};

export type RememberedCredentials = {
  username: string;
  password: string;
};

export type SessionData = {
  id: string;
  username: string;
  fullName: string | null;
  role: string;
  loggedInAt: number;
};

export async function loginWithCredentials(
  username: string,
  password: string
): Promise<AppUser | null> {
  const { data, error } = await supabase.rpc("authenticate_user", {
    p_username: username.trim(),
    p_password: password,
  });

  if (error) {
    console.error("Login error:", error.message);
    const message = error.message.toLowerCase();
    if (message.includes("crypt")) {
      throw new Error(
        "Error de autenticación en el servidor. Contacta al administrador."
      );
    }
    if (
      message.includes("failed to fetch") ||
      message.includes("network") ||
      message.includes("fetch")
    ) {
      throw new Error(
        "No se pudo conectar con la base de datos. Recarga la página e inténtalo de nuevo."
      );
    }
    throw new Error("No se pudo iniciar sesión. Intenta de nuevo.");
  }

  const user = data?.[0];
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    role: user.role,
  };
}

export function createSession(user: AppUser) {
  if (typeof window === "undefined") return;
  const session: SessionData = {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    loggedInAt: Date.now(),
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SESSION_KEY);
}

export function getSession(): SessionData | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

export function saveRememberedCredentials(credentials: RememberedCredentials) {
  if (typeof window === "undefined") return;
  localStorage.setItem(REMEMBER_KEY, JSON.stringify(credentials));
}

export function clearRememberedCredentials() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(REMEMBER_KEY);
}

export function getRememberedCredentials(): RememberedCredentials | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(REMEMBER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RememberedCredentials;
  } catch {
    return null;
  }
}
