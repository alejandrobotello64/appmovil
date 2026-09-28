import { supabase } from "@/lib/supabase/client";
import {
  isServicePasswordType,
  type ServicePassword,
  type ServicePasswordInput,
  type ServicePasswordLogAction,
  type ServicePasswordLogEntry,
  type VaultCredentials,
} from "@/lib/service-passwords/types";

export class VaultAuthError extends Error {}

function toError(error: { message: string; code?: string }, fallback: string) {
  if (error.code === "28P01") return new VaultAuthError(error.message || "Contraseña incorrecta.");
  if (error.code === "42501") return new Error(error.message || "No tienes permiso para esta acción.");
  if (["22023", "P0002"].includes(error.code ?? "")) return new Error(error.message);
  if (/fetch|network/i.test(error.message)) {
    return new Error("No se pudo conectar con la base de datos. Intenta de nuevo.");
  }
  return new Error(fallback);
}

function auth(credentials: VaultCredentials) {
  return { p_username: credentials.username, p_password: credentials.password };
}

export async function listServicePasswords(
  credentials: VaultCredentials
): Promise<ServicePassword[]> {
  const { data, error } = await supabase.rpc("service_vault_list", auth(credentials));
  if (error) throw toError(error, "No se pudieron cargar las contraseñas.");
  return (data ?? []).map((row) => ({
    id: row.id,
    passwordType: isServicePasswordType(row.password_type) ? row.password_type : "servicio",
    title: row.title,
    equipmentType: row.equipment_type,
    brand: row.brand,
    model: row.model,
    softwareVersion: row.software_version,
    clientName: row.client_name,
    accessUser: row.access_user,
    notes: row.notes,
    createdByName: row.created_by_name,
    updatedByName: row.updated_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revealCount: Number(row.reveal_count ?? 0),
    lastRevealedAt: row.last_revealed_at,
  }));
}

export async function revealServicePassword(
  credentials: VaultCredentials,
  id: string
): Promise<string> {
  const { data, error } = await supabase.rpc("service_vault_reveal", {
    ...auth(credentials),
    p_id: id,
  });
  if (error) throw toError(error, "No se pudo mostrar la contraseña.");
  return data ?? "";
}

export async function saveServicePassword(
  credentials: VaultCredentials,
  id: string | null,
  input: ServicePasswordInput
): Promise<string> {
  const { data, error } = await supabase.rpc("service_vault_save", {
    ...auth(credentials),
    p_id: id,
    p_data: {
      password_type: input.passwordType,
      title: input.title,
      equipment_type: input.equipmentType,
      brand: input.brand,
      model: input.model,
      software_version: input.softwareVersion,
      client_name: input.clientName,
      access_user: input.accessUser,
      notes: input.notes,
      secret: input.secret,
    },
  });
  if (error) throw toError(error, "No se pudo guardar la contraseña.");
  return data;
}

export async function deleteServicePassword(credentials: VaultCredentials, id: string) {
  const { error } = await supabase.rpc("service_vault_delete", {
    ...auth(credentials),
    p_id: id,
  });
  if (error) throw toError(error, "No se pudo eliminar la contraseña.");
}

export async function getServicePasswordLog(
  credentials: VaultCredentials,
  id: string | null = null
): Promise<ServicePasswordLogEntry[]> {
  const { data, error } = await supabase.rpc("service_vault_log", {
    ...auth(credentials),
    p_id: id,
  });
  if (error) throw toError(error, "No se pudo cargar la bitácora.");
  return (data ?? []).map((row) => ({
    id: Number(row.id),
    passwordId: row.password_id,
    passwordTitle: row.password_title,
    action: row.action as ServicePasswordLogAction,
    userName: row.user_name,
    createdAt: row.created_at,
  }));
}
