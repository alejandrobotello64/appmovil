"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Shield,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DesktopTable,
  ResponsiveDataList,
} from "@/components/ui/responsive-data-list";
import { supabase } from "@/lib/supabase/client";
import { ModulePlaceholder } from "@/components/warehouse/module-placeholder";
import { ReadOnlyBanner } from "@/components/warehouse/read-only-banner";
import {
  APP_ROLES,
  canWriteModule,
  modulesForRole,
  normalizeRole,
  roleLabel,
  type AppRole,
  type WarehouseModule,
} from "@/lib/auth/permissions";
import { usePermissions } from "@/lib/auth/use-permissions";
import { WAREHOUSE_TABS } from "@/lib/warehouse/tabs";
import { USERS_TABS, type UsersTabId } from "@/lib/users/tabs";
import { cn } from "@/lib/utils";

type ListedUser = {
  id: string;
  username: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  email: string;
  phone: string;
  employee_number: string;
  curp: string;
  rfc: string;
  job_title: string;
  department: string;
  hire_date: string | null;
  birth_date: string | null;
  address: string;
  notes: string;
};

type AltaFormState = {
  fullName: string;
  employeeNumber: string;
  curp: string;
  rfc: string;
  birthDate: string;
  phone: string;
  email: string;
  address: string;
  jobTitle: string;
  department: string;
  hireDate: string;
  role: AppRole;
  username: string;
  password: string;
  notes: string;
};

const EMPTY_ALTA: AltaFormState = {
  fullName: "",
  employeeNumber: "",
  curp: "",
  rfc: "",
  birthDate: "",
  phone: "",
  email: "",
  address: "",
  jobTitle: "",
  department: "",
  hireDate: "",
  role: "almacen",
  username: "",
  password: "",
  notes: "",
};

const MODULE_LABELS: Record<WarehouseModule, string> = {
  ...Object.fromEntries(WAREHOUSE_TABS.map((tab) => [tab.id, tab.label])),
  usuarios: "Usuarios",
} as Record<WarehouseModule, string>;

const PERMISSION_MODULES: WarehouseModule[] = [
  ...(WAREHOUSE_TABS.map((tab) => tab.id) as WarehouseModule[]),
  "usuarios",
];

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm";

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

type UsersPanelProps = {
  activeTab: UsersTabId;
};

export function UsersPanel({ activeTab }: UsersPanelProps) {
  const { canWrite } = usePermissions("usuarios");
  const [users, setUsers] = useState<ListedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [alta, setAlta] = useState<AltaFormState>(EMPTY_ALTA);

  const [selectedUserId, setSelectedUserId] = useState("");
  const [permissionRole, setPermissionRole] = useState<AppRole>("almacen");
  const [permissionName, setPermissionName] = useState("");
  const [permissionEmail, setPermissionEmail] = useState("");
  const [permissionPhone, setPermissionPhone] = useState("");
  const [permissionJobTitle, setPermissionJobTitle] = useState("");
  const [permissionDepartment, setPermissionDepartment] = useState("");

  const tabMeta = USERS_TABS.find((tab) => tab.id === activeTab);

  async function loadUsers() {
    const { data, error: rpcError } = await supabase.rpc("list_app_users");
    if (rpcError) throw new Error(rpcError.message);
    const list = (data as ListedUser[]) ?? [];
    setUsers(list);
    return list;
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

  useEffect(() => {
    setError("");
    setMessage("");
  }, [activeTab]);

  const activeUsers = useMemo(
    () => users.filter((user) => user.is_active),
    [users]
  );
  const inactiveUsers = useMemo(
    () => users.filter((user) => !user.is_active),
    [users]
  );

  const rolesUsed = useMemo(() => {
    const set = new Set(activeUsers.map((user) => normalizeRole(user.role)));
    return set.size;
  }, [activeUsers]);

  const roleBreakdown = useMemo(
    () =>
      APP_ROLES.map((item) => ({
        ...item,
        count: users.filter((user) => normalizeRole(user.role) === item.id)
          .length,
      })),
    [users]
  );

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [users, selectedUserId]
  );

  const previewModules = useMemo(
    () => modulesForRole(permissionRole),
    [permissionRole]
  );

  useEffect(() => {
    if (!selectedUser) return;
    setPermissionRole(normalizeRole(selectedUser.role));
    setPermissionName(selectedUser.full_name ?? "");
    setPermissionEmail(selectedUser.email ?? "");
    setPermissionPhone(selectedUser.phone ?? "");
    setPermissionJobTitle(selectedUser.job_title ?? "");
    setPermissionDepartment(selectedUser.department ?? "");
  }, [selectedUser]);

  useEffect(() => {
    if (selectedUserId) return;
    const first = activeUsers[0] ?? users[0];
    if (first) setSelectedUserId(first.id);
  }, [users, activeUsers, selectedUserId]);

  function updateAlta<K extends keyof AltaFormState>(
    key: K,
    value: AltaFormState[K]
  ) {
    setAlta((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const { error: rpcError } = await supabase.rpc("create_app_user", {
        p_username: alta.username.trim(),
        p_password: alta.password,
        p_full_name: alta.fullName.trim(),
        p_role: alta.role,
        p_email: alta.email.trim(),
        p_phone: alta.phone.trim(),
        p_employee_number: alta.employeeNumber.trim(),
        p_curp: alta.curp.trim(),
        p_rfc: alta.rfc.trim(),
        p_job_title: alta.jobTitle.trim(),
        p_department: alta.department.trim(),
        p_hire_date: emptyToNull(alta.hireDate),
        p_birth_date: emptyToNull(alta.birthDate),
        p_address: alta.address.trim(),
        p_notes: alta.notes.trim(),
      });
      if (rpcError) throw new Error(rpcError.message);
      setAlta(EMPTY_ALTA);
      await loadUsers();
      setMessage("Colaborador dado de alta correctamente.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo crear el usuario."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetActive(user: ListedUser, isActive: boolean) {
    if (!canWrite) return;
    const action = isActive ? "reactivar" : "dar de baja";
    const confirmed = window.confirm(
      `¿Seguro que quieres ${action} a "${user.full_name || user.username}"?`
    );
    if (!confirmed) return;

    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const { error: rpcError } = await supabase.rpc("set_app_user_active", {
        p_user_id: user.id,
        p_is_active: isActive,
      });
      if (rpcError) throw new Error(rpcError.message);
      await loadUsers();
      setMessage(
        isActive
          ? `Colaborador ${user.full_name || user.username} reactivado.`
          : `Colaborador ${user.full_name || user.username} dado de baja.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo actualizar el estado del usuario."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSavePermissions(event: FormEvent) {
    event.preventDefault();
    if (!canWrite || !selectedUser || !selectedUser.is_active) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const { error: rpcError } = await supabase.rpc("update_app_user_access", {
        p_user_id: selectedUser.id,
        p_role: permissionRole,
        p_full_name: permissionName.trim() || null,
        p_email: permissionEmail.trim(),
        p_phone: permissionPhone.trim(),
        p_job_title: permissionJobTitle.trim(),
        p_department: permissionDepartment.trim(),
      });
      if (rpcError) throw new Error(rpcError.message);
      await loadUsers();
      setMessage(
        `Datos y permisos actualizados para ${selectedUser.username} (${roleLabel(permissionRole)}).`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron guardar los permisos."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModulePlaceholder
      title={tabMeta?.label ?? "Usuarios"}
      description={
        tabMeta?.description ??
        "Administra colaboradores, altas, bajas y permisos."
      }
    >
      <div className="space-y-4">
        <ReadOnlyBanner visible={!canWrite} />

        {error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
            {message}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando usuarios...</p>
        ) : null}

        {!loading && activeTab === "dashboard" ? (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Total colaboradores",
                  value: users.length,
                  icon: Users,
                  href: "/dashboard/usuarios?tab=dashboard",
                  tone: "text-[#3B46A5]",
                },
                {
                  label: "Activos",
                  value: activeUsers.length,
                  icon: UserCheck,
                  href: "/dashboard/usuarios?tab=baja",
                  tone: "text-emerald-600",
                },
                {
                  label: "Inactivos",
                  value: inactiveUsers.length,
                  icon: UserMinus,
                  href: "/dashboard/usuarios?tab=baja",
                  tone: "text-destructive",
                },
                {
                  label: "Roles usados",
                  value: rolesUsed,
                  icon: Shield,
                  href: "/dashboard/usuarios?tab=permisos",
                  tone: "text-[#00BFFF]",
                },
              ].map((card) => {
                const Icon = card.icon;
                return (
                  <Link
                    key={card.label}
                    href={card.href}
                    className="rounded-xl border border-border bg-muted/20 p-4 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          {card.label}
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-foreground">
                          {card.value}
                        </p>
                      </div>
                      <Icon className={cn("size-5 shrink-0", card.tone)} />
                    </div>
                  </Link>
                );
              })}
            </div>

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-foreground">
                  Distribución por rol
                </h3>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/dashboard/usuarios?tab=alta"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium hover:bg-muted"
                  >
                    <UserPlus className="size-3.5" />
                    Alta
                  </Link>
                  <Link
                    href="/dashboard/usuarios?tab=baja"
                    className="inline-flex h-8 items-center rounded-lg border border-border bg-background px-2.5 text-xs font-medium hover:bg-muted"
                  >
                    Baja
                  </Link>
                  <Link
                    href="/dashboard/usuarios?tab=permisos"
                    className="inline-flex h-8 items-center rounded-lg border border-border bg-background px-2.5 text-xs font-medium hover:bg-muted"
                  >
                    Permisos
                  </Link>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {roleBreakdown.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-border bg-background px-3 py-2"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {item.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.count} colaborador{item.count === 1 ? "" : "es"}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">
                Colaboradores
              </h3>
              <ResponsiveDataList
                emptyMessage="No hay colaboradores registrados."
                items={users.map((user) => ({
                  key: user.id,
                  title: user.full_name || user.username,
                  subtitle: `@${user.username} · ${roleLabel(user.role)}`,
                  badge: (
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs",
                        user.is_active
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {user.is_active ? "Activo" : "Inactivo"}
                    </span>
                  ),
                  fields: [
                    {
                      label: "No. empleado",
                      value: user.employee_number || "—",
                    },
                    { label: "Puesto", value: user.job_title || "—" },
                    { label: "Área", value: user.department || "—" },
                    { label: "Teléfono", value: user.phone || "—" },
                    { label: "Correo", value: user.email || "—" },
                  ],
                }))}
              />
              <DesktopTable>
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/50 text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Nombre</th>
                      <th className="px-3 py-2 font-medium">Usuario</th>
                      <th className="px-3 py-2 font-medium">No. emp.</th>
                      <th className="px-3 py-2 font-medium">Puesto</th>
                      <th className="px-3 py-2 font-medium">Área</th>
                      <th className="px-3 py-2 font-medium">Rol</th>
                      <th className="px-3 py-2 font-medium">Teléfono</th>
                      <th className="px-3 py-2 font-medium">Correo</th>
                      <th className="px-3 py-2 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-3 py-8 text-center text-muted-foreground"
                        >
                          No hay colaboradores registrados.
                        </td>
                      </tr>
                    ) : (
                      users.map((user) => (
                        <tr key={user.id} className="border-t border-border/70">
                          <td className="px-3 py-2 font-medium">
                            {user.full_name || "—"}
                          </td>
                          <td className="px-3 py-2">{user.username}</td>
                          <td className="px-3 py-2">
                            {user.employee_number || "—"}
                          </td>
                          <td className="px-3 py-2">
                            {user.job_title || "—"}
                          </td>
                          <td className="px-3 py-2">
                            {user.department || "—"}
                          </td>
                          <td className="px-3 py-2">
                            {roleLabel(user.role)}
                          </td>
                          <td className="px-3 py-2">{user.phone || "—"}</td>
                          <td className="px-3 py-2">{user.email || "—"}</td>
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2 py-0.5 text-xs",
                                user.is_active
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              {user.is_active ? "Activo" : "Inactivo"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </DesktopTable>
            </section>
          </div>
        ) : null}

        {!loading && activeTab === "alta" ? (
          <form onSubmit={handleCreate} className="space-y-6">
            <section className="grid gap-4 rounded-xl border border-border bg-muted/20 p-4 sm:grid-cols-2">
              <h3 className="text-base font-semibold text-foreground sm:col-span-2">
                Datos personales
              </h3>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium">Nombre completo *</span>
                <input
                  required
                  disabled={!canWrite}
                  value={alta.fullName}
                  onChange={(e) => updateAlta("fullName", e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Número de empleado</span>
                <input
                  disabled={!canWrite}
                  value={alta.employeeNumber}
                  onChange={(e) => updateAlta("employeeNumber", e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">CURP</span>
                <input
                  disabled={!canWrite}
                  value={alta.curp}
                  onChange={(e) => updateAlta("curp", e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">RFC</span>
                <input
                  disabled={!canWrite}
                  value={alta.rfc}
                  onChange={(e) => updateAlta("rfc", e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Fecha de nacimiento</span>
                <input
                  type="date"
                  disabled={!canWrite}
                  value={alta.birthDate}
                  onChange={(e) => updateAlta("birthDate", e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Teléfono</span>
                <input
                  type="tel"
                  disabled={!canWrite}
                  value={alta.phone}
                  onChange={(e) => updateAlta("phone", e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Correo electrónico</span>
                <input
                  type="email"
                  disabled={!canWrite}
                  value={alta.email}
                  onChange={(e) => updateAlta("email", e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium">Dirección</span>
                <input
                  disabled={!canWrite}
                  value={alta.address}
                  onChange={(e) => updateAlta("address", e.target.value)}
                  className={inputClass}
                />
              </label>
            </section>

            <section className="grid gap-4 rounded-xl border border-border bg-muted/20 p-4 sm:grid-cols-2">
              <h3 className="text-base font-semibold text-foreground sm:col-span-2">
                Datos laborales
              </h3>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Puesto</span>
                <input
                  disabled={!canWrite}
                  value={alta.jobTitle}
                  onChange={(e) => updateAlta("jobTitle", e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Área / departamento</span>
                <input
                  disabled={!canWrite}
                  value={alta.department}
                  onChange={(e) => updateAlta("department", e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Fecha de ingreso</span>
                <input
                  type="date"
                  disabled={!canWrite}
                  value={alta.hireDate}
                  onChange={(e) => updateAlta("hireDate", e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Rol</span>
                <select
                  disabled={!canWrite}
                  value={alta.role}
                  onChange={(e) =>
                    updateAlta("role", e.target.value as AppRole)
                  }
                  className={inputClass}
                >
                  {APP_ROLES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </section>

            <section className="grid gap-4 rounded-xl border border-border bg-muted/20 p-4 sm:grid-cols-2">
              <h3 className="text-base font-semibold text-foreground sm:col-span-2">
                Acceso al sistema
              </h3>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Usuario *</span>
                <input
                  required
                  disabled={!canWrite}
                  value={alta.username}
                  onChange={(e) => updateAlta("username", e.target.value)}
                  className={inputClass}
                  autoComplete="off"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Contraseña *</span>
                <input
                  required
                  type="password"
                  minLength={6}
                  disabled={!canWrite}
                  value={alta.password}
                  onChange={(e) => updateAlta("password", e.target.value)}
                  className={inputClass}
                  autoComplete="new-password"
                />
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium">Notas</span>
                <textarea
                  disabled={!canWrite}
                  value={alta.notes}
                  onChange={(e) => updateAlta("notes", e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </label>
            </section>

            <Button
              type="submit"
              disabled={!canWrite || submitting}
              className="w-fit border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white hover:opacity-90"
            >
              {submitting ? "Guardando..." : "Dar de alta colaborador"}
            </Button>
          </form>
        ) : null}

        {!loading && activeTab === "baja" ? (
          <div className="space-y-6">
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">
                Colaboradores activos
              </h3>
              <ResponsiveDataList
                emptyMessage="No hay colaboradores activos."
                items={activeUsers.map((user) => ({
                  key: user.id,
                  title: user.full_name || user.username,
                  subtitle: `@${user.username}`,
                  badge: (
                    <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">
                      Activo · {roleLabel(user.role)}
                    </span>
                  ),
                  fields: [
                    { label: "Puesto", value: user.job_title || "—" },
                    { label: "Área", value: user.department || "—" },
                    {
                      label: "Alta",
                      value: new Date(user.created_at).toLocaleDateString(
                        "es-MX"
                      ),
                    },
                  ],
                  actions: canWrite ? (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void handleSetActive(user, false)}
                      className="inline-flex h-9 items-center rounded-lg border border-destructive/30 px-3 text-xs font-medium text-destructive"
                    >
                      Dar de baja
                    </button>
                  ) : undefined,
                }))}
              />
              <DesktopTable>
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/50 text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Nombre</th>
                      <th className="px-3 py-2 font-medium">Usuario</th>
                      <th className="px-3 py-2 font-medium">Puesto</th>
                      <th className="px-3 py-2 font-medium">Área</th>
                      <th className="px-3 py-2 font-medium">Rol</th>
                      <th className="px-3 py-2 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeUsers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3 py-8 text-center text-muted-foreground"
                        >
                          No hay colaboradores activos.
                        </td>
                      </tr>
                    ) : (
                      activeUsers.map((user) => (
                        <tr key={user.id} className="border-t border-border/70">
                          <td className="px-3 py-2 font-medium">
                            {user.full_name || "—"}
                          </td>
                          <td className="px-3 py-2">{user.username}</td>
                          <td className="px-3 py-2">
                            {user.job_title || "—"}
                          </td>
                          <td className="px-3 py-2">
                            {user.department || "—"}
                          </td>
                          <td className="px-3 py-2">
                            {roleLabel(user.role)}
                          </td>
                          <td className="px-3 py-2">
                            {canWrite ? (
                              <Button
                                type="button"
                                variant="outline"
                                disabled={submitting}
                                onClick={() => void handleSetActive(user, false)}
                                className="h-8 border-destructive/30 text-destructive"
                              >
                                Dar de baja
                              </Button>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </DesktopTable>
            </section>

            <section className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">
                Colaboradores dados de baja
              </h3>
              <ResponsiveDataList
                emptyMessage="No hay colaboradores dados de baja."
                items={inactiveUsers.map((user) => ({
                  key: user.id,
                  title: user.full_name || user.username,
                  subtitle: `@${user.username}`,
                  badge: (
                    <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Inactivo · {roleLabel(user.role)}
                    </span>
                  ),
                  fields: [
                    { label: "Puesto", value: user.job_title || "—" },
                    { label: "Área", value: user.department || "—" },
                  ],
                  actions: canWrite ? (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void handleSetActive(user, true)}
                      className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-medium"
                    >
                      Reactivar
                    </button>
                  ) : undefined,
                }))}
              />
              <DesktopTable>
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/50 text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Nombre</th>
                      <th className="px-3 py-2 font-medium">Usuario</th>
                      <th className="px-3 py-2 font-medium">Puesto</th>
                      <th className="px-3 py-2 font-medium">Área</th>
                      <th className="px-3 py-2 font-medium">Rol</th>
                      <th className="px-3 py-2 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inactiveUsers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3 py-8 text-center text-muted-foreground"
                        >
                          No hay colaboradores dados de baja.
                        </td>
                      </tr>
                    ) : (
                      inactiveUsers.map((user) => (
                        <tr key={user.id} className="border-t border-border/70">
                          <td className="px-3 py-2 font-medium">
                            {user.full_name || "—"}
                          </td>
                          <td className="px-3 py-2">{user.username}</td>
                          <td className="px-3 py-2">
                            {user.job_title || "—"}
                          </td>
                          <td className="px-3 py-2">
                            {user.department || "—"}
                          </td>
                          <td className="px-3 py-2">
                            {roleLabel(user.role)}
                          </td>
                          <td className="px-3 py-2">
                            {canWrite ? (
                              <Button
                                type="button"
                                variant="outline"
                                disabled={submitting}
                                onClick={() => void handleSetActive(user, true)}
                                className="h-8"
                              >
                                Reactivar
                              </Button>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </DesktopTable>
            </section>
          </div>
        ) : null}

        {!loading && activeTab === "permisos" ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <section className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">
                Selecciona colaborador
              </h3>
              <div className="max-h-[28rem] space-y-2 overflow-y-auto rounded-xl border border-border p-2">
                {users.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">
                    No hay colaboradores registrados.
                  </p>
                ) : (
                  users.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setSelectedUserId(user.id)}
                      className={cn(
                        "flex w-full flex-col rounded-lg px-3 py-2 text-left transition-colors",
                        selectedUserId === user.id
                          ? "bg-[linear-gradient(135deg,rgba(0,191,255,0.14),rgba(59,70,165,0.18))]"
                          : "hover:bg-muted/60"
                      )}
                    >
                      <span className="text-sm font-medium text-foreground">
                        {user.full_name || user.username}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        @{user.username} · {roleLabel(user.role)} ·{" "}
                        {user.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </section>

            <section className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
              <h3 className="text-base font-semibold text-foreground">
                Datos y permisos
              </h3>
              {selectedUser ? (
                <form onSubmit={handleSavePermissions} className="grid gap-4">
                  <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <p className="font-medium text-foreground">
                      {selectedUser.full_name || selectedUser.username}
                    </p>
                    <p className="text-muted-foreground">
                      @{selectedUser.username} · Estado:{" "}
                      {selectedUser.is_active ? "Activo" : "Inactivo"}
                    </p>
                  </div>

                  <label className="space-y-1.5">
                    <span className="text-sm font-medium">Nombre completo</span>
                    <input
                      disabled={!canWrite || !selectedUser.is_active}
                      value={permissionName}
                      onChange={(e) => setPermissionName(e.target.value)}
                      className={inputClass}
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-sm font-medium">Correo</span>
                      <input
                        type="email"
                        disabled={!canWrite || !selectedUser.is_active}
                        value={permissionEmail}
                        onChange={(e) => setPermissionEmail(e.target.value)}
                        className={inputClass}
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-sm font-medium">Teléfono</span>
                      <input
                        type="tel"
                        disabled={!canWrite || !selectedUser.is_active}
                        value={permissionPhone}
                        onChange={(e) => setPermissionPhone(e.target.value)}
                        className={inputClass}
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-sm font-medium">Puesto</span>
                      <input
                        disabled={!canWrite || !selectedUser.is_active}
                        value={permissionJobTitle}
                        onChange={(e) => setPermissionJobTitle(e.target.value)}
                        className={inputClass}
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-sm font-medium">Área</span>
                      <input
                        disabled={!canWrite || !selectedUser.is_active}
                        value={permissionDepartment}
                        onChange={(e) =>
                          setPermissionDepartment(e.target.value)
                        }
                        className={inputClass}
                      />
                    </label>
                  </div>

                  <label className="space-y-1.5">
                    <span className="text-sm font-medium">Rol / permisos</span>
                    <select
                      disabled={!canWrite || !selectedUser.is_active}
                      value={permissionRole}
                      onChange={(e) =>
                        setPermissionRole(e.target.value as AppRole)
                      }
                      className={inputClass}
                    >
                      {APP_ROLES.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      Módulos que tendrá con este rol
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {PERMISSION_MODULES.map((moduleId) => {
                        const canView = previewModules.includes(moduleId);
                        const canWriteRole = canWriteModule(
                          permissionRole,
                          moduleId
                        );
                        return (
                          <div
                            key={moduleId}
                            className={cn(
                              "rounded-lg border px-3 py-2 text-xs",
                              canView
                                ? "border-border bg-background"
                                : "border-transparent bg-muted/40 text-muted-foreground"
                            )}
                          >
                            <p className="font-medium">
                              {MODULE_LABELS[moduleId] ?? moduleId}
                            </p>
                            <p>
                              {canView
                                ? canWriteRole
                                  ? "Ver y editar"
                                  : "Solo lectura"
                                : "Sin acceso"}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={
                      !canWrite || submitting || !selectedUser.is_active
                    }
                    className="w-fit border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white hover:opacity-90"
                  >
                    {submitting ? "Guardando..." : "Guardar cambios"}
                  </Button>
                  {!selectedUser.is_active ? (
                    <p className="text-xs text-muted-foreground">
                      Reactiva al colaborador en &quot;Baja de
                      colaborador&quot; para poder editar sus datos y permisos.
                    </p>
                  ) : null}
                </form>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Selecciona un colaborador para editar datos y permisos.
                </p>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </ModulePlaceholder>
  );
}
