import { supabase } from "@/lib/supabase/client";
import {
  parsePermissionOverrides,
  type PermissionOverrides,
} from "@/lib/auth/permissions";

const SESSION_KEY = "mas-session";
const REMEMBER_KEY = "mas-remember";
export const SESSION_CHANGE_EVENT = "mas-session-change";

export type AppUser = {
  id: string;
  username: string;
  fullName: string | null;
  role: string;
  photoUrl?: string;
  permissionOverrides?: PermissionOverrides;
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
  photoUrl?: string;
  permissionOverrides?: PermissionOverrides;
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
      message.includes("jwt") ||
      message.includes("invalid api key") ||
      message.includes("invalid authentication")
    ) {
      throw new Error(
        "La clave de la base de datos no coincide. Revisa NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local."
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
    photoUrl: user.photo_url ?? "",
    permissionOverrides: parsePermissionOverrides(user.permission_overrides),
  };
}

function writeSession(session: SessionData) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
}

export function createSession(user: AppUser) {
  if (typeof window === "undefined") return;
  writeSession({
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    photoUrl: user.photoUrl ?? "",
    permissionOverrides: user.permissionOverrides ?? {},
    loggedInAt: Date.now(),
  });
}

export function clearSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
}

/**
 * Relee rol y permisos desde la base para que los cambios hechos por un
 * administrador apliquen sin volver a iniciar sesión.
 * Devuelve `false` si el usuario ya no existe o fue deshabilitado.
 */
export async function refreshSessionAccess(): Promise<boolean> {
  const current = getSession();
  if (!current) return false;
  const { data, error } = await supabase.rpc("get_app_user_access", {
    p_user_id: current.id,
  });
  if (error) return true;
  const row = data?.[0];
  if (!row || !row.is_active) return false;

  const overrides = parsePermissionOverrides(row.permission_overrides);
  const changed =
    row.role !== current.role ||
    JSON.stringify(overrides) !== JSON.stringify(current.permissionOverrides ?? {});
  if (changed) {
    writeSession({ ...current, role: row.role, permissionOverrides: overrides });
  }
  return true;
}

export function getRawSession(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(SESSION_KEY);
}

export function parseSession(raw: string | null): SessionData | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

export function getSession(): SessionData | null {
  return parseSession(getRawSession());
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
