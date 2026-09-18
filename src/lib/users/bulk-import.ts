import { supabase } from "@/lib/supabase/client";
import type { UserExcelRow } from "./excel";

export type BulkUserImportResult = {
  created: number;
  updated: number;
  errors: Array<{ username: string; message: string }>;
};

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function bulkImportUsers(
  rows: UserExcelRow[],
  existingByUsername: Map<string, { id: string; is_active: boolean }>,
  onProgress?: (done: number, total: number) => void
): Promise<BulkUserImportResult> {
  let created = 0;
  let updated = 0;
  const errors: BulkUserImportResult["errors"] = [];

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    onProgress?.(index + 1, rows.length);

    const profile = {
      p_username: row.username,
      p_full_name: row.fullName,
      p_role: row.role,
      p_email: row.email,
      p_phone: row.phone,
      p_employee_number: row.employeeNumber,
      p_curp: row.curp,
      p_rfc: row.rfc,
      p_job_title: row.jobTitle,
      p_department: row.department,
      p_hire_date: emptyToNull(row.hireDate),
      p_birth_date: emptyToNull(row.birthDate),
      p_address: row.address,
      p_notes: row.notes,
      p_blood_type: row.bloodType,
      p_emergency_contact_name: row.emergencyContactName,
      p_emergency_contact_phone: row.emergencyContactPhone,
      p_emergency_contact_relation: row.emergencyContactRelation,
    };

    try {
      const existing = existingByUsername.get(row.username.toLowerCase());
      if (existing) {
        const { error } = await supabase.rpc("update_app_user_profile", {
          p_user_id: existing.id,
          ...profile,
          p_password: row.password.trim() ? row.password : null,
        });
        if (error) throw new Error(error.message);

        if (existing.is_active !== row.isActive) {
          const { error: activeError } = await supabase.rpc(
            "set_app_user_active",
            {
              p_user_id: existing.id,
              p_is_active: row.isActive,
            }
          );
          if (activeError) throw new Error(activeError.message);
        }
        updated += 1;
      } else {
        if (!row.password.trim() || row.password.trim().length < 6) {
          throw new Error(
            "Password obligatorio (mín. 6 caracteres) para usuarios nuevos."
          );
        }
        const { data, error } = await supabase.rpc("create_app_user", {
          p_password: row.password,
          ...profile,
        });
        if (error) throw new Error(error.message);

        const createdRow = Array.isArray(data) ? data[0] : data;
        const newId = createdRow?.id as string | undefined;
        if (newId && !row.isActive) {
          const { error: activeError } = await supabase.rpc(
            "set_app_user_active",
            {
              p_user_id: newId,
              p_is_active: false,
            }
          );
          if (activeError) throw new Error(activeError.message);
        }
        created += 1;
      }
    } catch (err) {
      errors.push({
        username: row.username,
        message: err instanceof Error ? err.message : "Error al importar.",
      });
    }
  }

  return { created, updated, errors };
}
