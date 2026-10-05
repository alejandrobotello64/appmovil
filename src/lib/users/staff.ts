import { supabase } from "@/lib/supabase/client";
import { normalizeRole } from "@/lib/auth/permissions";

export type StaffMember = {
  id: string;
  username: string;
  fullName: string;
  role: string;
  isTechnician: boolean;
  isServiceAdvisor: boolean;
  isActive: boolean;
};

export function staffDisplayName(fullName: string | null | undefined, username: string) {
  return (fullName ?? "").trim() || username;
}

function actorMatchesStaff(
  member: StaffMember,
  actor: { id?: string; username?: string; fullName?: string | null }
) {
  const fullName = (actor.fullName ?? "").trim();
  return (
    member.id === actor.id ||
    member.username === actor.username ||
    (fullName !== "" && member.fullName === fullName)
  );
}

export function isActorServiceAdvisor(
  staff: StaffMember[],
  actor: { id?: string; username?: string; fullName?: string | null; role?: string } | null
) {
  if (!actor) return false;
  if (
    staff.some((member) => member.isServiceAdvisor && actorMatchesStaff(member, actor))
  ) {
    return true;
  }
  const catalogHasAdvisor = staff.some((member) => member.isServiceAdvisor);
  if (!catalogHasAdvisor && normalizeRole(actor.role) === "administrador") {
    return true;
  }
  return false;
}

export type StaffProfile = {
  fullName: string;
  jobTitle: string;
  department: string;
  employeeNumber: string;
  phone: string;
  email: string;
};

function foldName(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

/** Carga el directorio una vez y devuelve un buscador por nombre completo o usuario. */
export async function loadStaffProfileLookup(): Promise<(name: string) => StaffProfile | null> {
  const { data, error } = await supabase.rpc("list_app_users");
  const rows = error || !data ? [] : data;
  return (name: string) => {
    const target = foldName(name);
    if (!target) return null;
    const row = rows.find(
      (item) => foldName(item.full_name) === target || foldName(item.username) === target
    );
    if (!row) return null;
    return {
      fullName: staffDisplayName(row.full_name, row.username),
      jobTitle: row.job_title ?? "",
      department: row.department ?? "",
      employeeNumber: row.employee_number ?? "",
      phone: row.phone ?? "",
      email: row.email ?? "",
    };
  };
}

/** Busca la ficha de un colaborador por nombre completo o usuario; `null` si no existe. */
export async function findStaffProfile(name: string): Promise<StaffProfile | null> {
  if (!foldName(name)) return null;
  return (await loadStaffProfileLookup())(name);
}

export async function listStaffMembers(): Promise<StaffMember[]> {
  const { data, error } = await supabase.rpc("list_app_users");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    username: row.username,
    fullName: staffDisplayName(row.full_name, row.username),
    role: String(row.role ?? ""),
    isTechnician: Boolean(row.is_technician),
    isServiceAdvisor: Boolean(row.is_service_advisor),
    isActive: Boolean(row.is_active),
  }));
}
