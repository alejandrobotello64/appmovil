import { supabase } from "@/lib/supabase/client";

export type StaffMember = {
  id: string;
  username: string;
  fullName: string;
  isTechnician: boolean;
  isServiceAdvisor: boolean;
  isActive: boolean;
};

export function staffDisplayName(fullName: string | null | undefined, username: string) {
  return (fullName ?? "").trim() || username;
}

export function isActorServiceAdvisor(
  staff: StaffMember[],
  actor: { id?: string; username?: string; fullName?: string | null } | null
) {
  if (!actor) return false;
  const fullName = (actor.fullName ?? "").trim();
  return staff.some(
    (member) =>
      member.isServiceAdvisor &&
      (member.id === actor.id ||
        member.username === actor.username ||
        (fullName !== "" && member.fullName === fullName))
  );
}

export async function listStaffMembers(): Promise<StaffMember[]> {
  const { data, error } = await supabase.rpc("list_app_users");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    username: row.username,
    fullName: staffDisplayName(row.full_name, row.username),
    isTechnician: Boolean(row.is_technician),
    isServiceAdvisor: Boolean(row.is_service_advisor),
    isActive: Boolean(row.is_active),
  }));
}
