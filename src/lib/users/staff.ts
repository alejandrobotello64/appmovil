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
