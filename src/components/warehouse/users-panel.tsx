"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  DesktopTable,
  ResponsiveDataList,
} from "@/components/ui/responsive-data-list";
import { supabase } from "@/lib/supabase/client";
import { ModulePlaceholder } from "@/components/warehouse/module-placeholder";

type ListedUser = {
  id: string;
  username: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
};

export function UsersPanel() {
  const [users, setUsers] = useState<ListedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("operador");
  const [submitting, setSubmitting] = useState(false);

  async function loadUsers() {
    const { data, error: rpcError } = await supabase.rpc("list_app_users");
    if (rpcError) throw new Error(rpcError.message);
    setUsers((data as ListedUser[]) ?? []);
  }

  useEffect(() => {
    void loadUsers()
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "No se pudieron cargar usuarios."
        )
      )
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const { error: rpcError } = await supabase.rpc("create_app_user", {
        p_username: username.trim(),
        p_password: password,
        p_full_name: fullName.trim() || null,
        p_role: role,
      });
      if (rpcError) throw new Error(rpcError.message);
      setFormOpen(false);
      setUsername("");
      setPassword("");
      setFullName("");
      setRole("operador");
      await loadUsers();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo crear el usuario."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModulePlaceholder
      title="Usuarios del sistema interno"
      description="Administra accesos al panel de Medical Advanced Supplies."
    >
      <div className="mb-4 flex justify-end">
        <Button
          onClick={() => setFormOpen(true)}
          className="border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white hover:opacity-90"
        >
          Nuevo usuario
        </Button>
      </div>

      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando usuarios...</p>
      ) : (
        <>
        <ResponsiveDataList
          emptyMessage="No hay usuarios registrados."
          items={users.map((user) => ({
            key: user.id,
            title: user.username,
            subtitle: user.full_name || "Sin nombre",
            badge: (
              <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs capitalize">
                {user.role}
              </span>
            ),
            fields: [
              {
                label: "Estado",
                value: user.is_active ? "Activo" : "Inactivo",
              },
              {
                label: "Alta",
                value: new Date(user.created_at).toLocaleDateString("es-MX"),
              },
            ],
          }))}
        />

        <DesktopTable>
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Usuario</th>
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Rol</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Alta</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-border/70">
                  <td className="px-3 py-2 font-medium">{user.username}</td>
                  <td className="px-3 py-2">{user.full_name || "—"}</td>
                  <td className="px-3 py-2">{user.role}</td>
                  <td className="px-3 py-2">
                    {user.is_active ? "Activo" : "Inactivo"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString("es-MX")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DesktopTable>
        </>
      )}

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"
          >
            <h3 className="text-lg font-semibold">Alta de usuario</h3>
            <div className="mt-4 grid gap-3">
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Usuario / correo</span>
                <input
                  required
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Contraseña</span>
                <input
                  required
                  type="password"
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Nombre</span>
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Rol</span>
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="admin">Administrador</option>
                  <option value="operador">Operador de almacén</option>
                  <option value="lectura">Solo lectura</option>
                </select>
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
              >
                {submitting ? "Guardando..." : "Crear usuario"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </ModulePlaceholder>
  );
}
