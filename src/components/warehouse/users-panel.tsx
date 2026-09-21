"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Camera,
  Pencil,
  Shield,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  DesktopTable,
  ResponsiveDataList,
} from "@/components/ui/responsive-data-list";
import { getSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import {
  removeUserPhoto,
  setUserPhotoUrl,
  uploadUserPhoto,
} from "@/lib/users/photo";
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
import { UsersExcelActions } from "@/components/warehouse/users-excel-actions";

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
  blood_type: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relation: string;
  photo_url: string;
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
  bloodType: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  jobTitle: string;
  department: string;
  hireDate: string;
  role: AppRole;
  username: string;
  password: string;
  notes: string;
};

const BLOOD_TYPES = ["", "O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"] as const;

const EMPTY_ALTA: AltaFormState = {
  fullName: "",
  employeeNumber: "",
  curp: "",
  rfc: "",
  birthDate: "",
  phone: "",
  email: "",
  address: "",
  bloodType: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactRelation: "",
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
  calendario: "Calendario",
  clientes: "Clientes",
  licitaciones: "Licitaciones",
  cotizaciones: "Cotizaciones",
  ordenes_servicio: "Órdenes de servicio",
  flotilla: "Flotilla",
  educacion: "Educación",
  usuarios: "Usuarios",
} as Record<WarehouseModule, string>;

const PERMISSION_MODULES: WarehouseModule[] = [
  ...(WAREHOUSE_TABS.map((tab) => tab.id) as WarehouseModule[]),
  "calendario",
  "clientes",
  "licitaciones",
  "cotizaciones",
  "ordenes_servicio",
  "flotilla",
  "educacion",
  "usuarios",
];

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm";

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isoDate(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

function userToAlta(user: ListedUser): AltaFormState {
  return {
    fullName: user.full_name ?? "",
    employeeNumber: user.employee_number ?? "",
    curp: user.curp ?? "",
    rfc: user.rfc ?? "",
    birthDate: isoDate(user.birth_date),
    phone: user.phone ?? "",
    email: user.email ?? "",
    address: user.address ?? "",
    bloodType: user.blood_type ?? "",
    emergencyContactName: user.emergency_contact_name ?? "",
    emergencyContactPhone: user.emergency_contact_phone ?? "",
    emergencyContactRelation: user.emergency_contact_relation ?? "",
    jobTitle: user.job_title ?? "",
    department: user.department ?? "",
    hireDate: isoDate(user.hire_date),
    role: normalizeRole(user.role),
    username: user.username ?? "",
    password: "",
    notes: user.notes ?? "",
  };
}

function AccessToggle({
  active,
  disabled,
  onToggle,
}: {
  active: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={active ? "Deshabilitar acceso" : "Habilitar acceso"}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full border px-2.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
      )}
    >
      <span
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          active ? "bg-emerald-500" : "bg-muted-foreground/40"
        )}
      >
        <span
          className={cn(
            "absolute size-4 rounded-full bg-white shadow transition-transform",
            active ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </span>
      {active ? "Acceso activo" : "Deshabilitado"}
    </button>
  );
}

type UsersPanelProps = {
  activeTab: UsersTabId;
  editUserId?: string | null;
};

export function UsersPanel({ activeTab, editUserId = null }: UsersPanelProps) {
  const router = useRouter();
  const { canWrite } = usePermissions("usuarios");
  const [users, setUsers] = useState<ListedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [alta, setAlta] = useState<AltaFormState>(EMPTY_ALTA);
  const [editingId, setEditingId] = useState("");
  const [fichaQuery, setFichaQuery] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [removePhoto, setRemovePhoto] = useState(false);

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

  useEffect(() => {
    if (activeTab !== "alta") return;
    const nextId = editUserId ?? "";
    setEditingId(nextId);
    if (!nextId) {
      setAlta(EMPTY_ALTA);
      setPhotoUrl("");
      setPhotoFile(null);
      setPhotoPreview("");
      setRemovePhoto(false);
    }
  }, [activeTab, editUserId]);

  useEffect(() => {
    if (!editingId) return;
    const match = users.find((user) => user.id === editingId);
    if (match) {
      setAlta(userToAlta(match));
      setPhotoUrl(match.photo_url ?? "");
      setPhotoFile(null);
      setPhotoPreview("");
      setRemovePhoto(false);
    }
  }, [editingId, users]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview("");
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

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

  const fichaOptions = useMemo(() => {
    const q = fichaQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) =>
      [
        user.full_name,
        user.username,
        user.employee_number,
        user.email,
        user.job_title,
        user.department,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [users, fichaQuery]);

  function updateAlta<K extends keyof AltaFormState>(
    key: K,
    value: AltaFormState[K]
  ) {
    setAlta((prev) => ({ ...prev, [key]: value }));
  }

  function openFicha(userId: string) {
    setMessage("");
    setError("");
    if (!userId) {
      setEditingId("");
      setAlta(EMPTY_ALTA);
      setPhotoUrl("");
      setPhotoFile(null);
      setPhotoPreview("");
      setRemovePhoto(false);
      router.replace("/dashboard/usuarios?tab=alta");
      return;
    }
    const match = users.find((user) => user.id === userId);
    if (match) {
      setEditingId(match.id);
      setAlta(userToAlta(match));
      setPhotoUrl(match.photo_url ?? "");
      setPhotoFile(null);
      setPhotoPreview("");
      setRemovePhoto(false);
    }
    router.replace(`/dashboard/usuarios?tab=alta&id=${userId}`);
  }

  function profilePayload() {
    return {
      p_username: alta.username.trim(),
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
      p_blood_type: alta.bloodType.trim(),
      p_emergency_contact_name: alta.emergencyContactName.trim(),
      p_emergency_contact_phone: alta.emergencyContactPhone.trim(),
      p_emergency_contact_relation: alta.emergencyContactRelation.trim(),
    };
  }

  async function persistPhoto(userId: string) {
    if (removePhoto && !photoFile) {
      await removeUserPhoto(userId);
      setPhotoUrl("");
      setRemovePhoto(false);
      return;
    }
    if (!photoFile) return;
    const url = await uploadUserPhoto(userId, photoFile);
    await setUserPhotoUrl(userId, url);
    setPhotoUrl(url);
    setPhotoFile(null);
    setRemovePhoto(false);
  }

  async function handleSaveFicha(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      if (editingId) {
        const { error: rpcError } = await supabase.rpc(
          "update_app_user_profile",
          {
            p_user_id: editingId,
            ...profilePayload(),
            p_password: alta.password.trim() ? alta.password : null,
          }
        );
        if (rpcError) throw new Error(rpcError.message);
        await persistPhoto(editingId);
        await loadUsers();
        setAlta((current) => ({ ...current, password: "" }));
        setMessage("Ficha del colaborador actualizada.");
      } else {
        const { data, error: rpcError } = await supabase.rpc("create_app_user", {
          p_password: alta.password,
          ...profilePayload(),
        });
        if (rpcError) throw new Error(rpcError.message);
        const createdId = data?.[0]?.id;
        if (createdId && (photoFile || removePhoto)) {
          await persistPhoto(createdId);
        }
        setAlta(EMPTY_ALTA);
        setEditingId("");
        setPhotoUrl("");
        setPhotoFile(null);
        setPhotoPreview("");
        setRemovePhoto(false);
        await loadUsers();
        setMessage("Colaborador dado de alta correctamente.");
        router.replace("/dashboard/usuarios?tab=alta");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : editingId
            ? "No se pudo guardar la ficha."
            : "No se pudo crear el usuario."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetActive(user: ListedUser, isActive: boolean) {
    if (!canWrite) return;
    const session = getSession();
    if (!isActive && session?.id === user.id) {
      setError("No puedes deshabilitar tu propio acceso.");
      return;
    }

    const action = isActive
      ? "habilitar el acceso de"
      : "deshabilitar temporalmente el acceso de";
    const confirmed = window.confirm(
      `¿Seguro que quieres ${action} "${user.full_name || user.username}"?\n\n` +
        (isActive
          ? "Podrá iniciar sesión de nuevo."
          : "No podrá iniciar sesión hasta que lo vuelvas a habilitar. La ficha no se borra.")
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
          ? `Acceso habilitado para ${user.full_name || user.username}.`
          : `Acceso deshabilitado temporalmente para ${user.full_name || user.username}.`
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

  async function handleDeleteUser(user: ListedUser) {
    if (!canWrite) return;
    const session = getSession();
    if (session?.id === user.id) {
      setError("No puedes eliminar tu propio usuario.");
      return;
    }

    const confirmed = window.confirm(
      `¿Eliminar permanentemente a "${user.full_name || user.username}"?\n\n` +
        "Esta acción no se puede deshacer. Se borrará la ficha y el acceso."
    );
    if (!confirmed) return;

    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const { error: rpcError } = await supabase.rpc("delete_app_user", {
        p_user_id: user.id,
      });
      if (rpcError) throw new Error(rpcError.message);
      if (selectedUserId === user.id) setSelectedUserId("");
      if (editingId === user.id) {
        setEditingId("");
        setAlta(EMPTY_ALTA);
      }
      await loadUsers();
      setMessage(`Usuario ${user.full_name || user.username} eliminado.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo eliminar el usuario."
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

        {!loading ? (
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Sube un Excel o CSV para dar de alta o actualizar varios
              colaboradores a la vez. Los nuevos necesitan columna{" "}
              <span className="font-medium text-foreground">password</span>{" "}
              (mínimo 6 caracteres).
            </p>
            <div className="flex flex-wrap gap-2">
              <UsersExcelActions
                users={users}
                canWrite={canWrite}
                onImported={async () => {
                  await loadUsers();
                }}
                onError={setError}
                onMessage={setMessage}
              />
            </div>
          </div>
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
                  label: "Deshabilitados",
                  value: inactiveUsers.length,
                  icon: UserMinus,
                  href: "/dashboard/usuarios?tab=baja",
                  tone: "text-amber-600",
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
                    Acceso
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
                  title: (
                    <span className="inline-flex items-center gap-2">
                      <UserAvatar
                        name={user.full_name || user.username}
                        photoUrl={user.photo_url}
                        size="sm"
                      />
                      {user.full_name || user.username}
                    </span>
                  ),
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
                      {user.is_active ? "Activo" : "Deshabilitado"}
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
                  actions: canWrite ? (
                    <Link
                      href={`/dashboard/usuarios?tab=alta&id=${user.id}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium"
                    >
                      <Pencil className="size-3.5" />
                      Editar ficha
                    </Link>
                  ) : undefined,
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
                      <th className="px-3 py-2 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td
                          colSpan={10}
                          className="px-3 py-8 text-center text-muted-foreground"
                        >
                          No hay colaboradores registrados.
                        </td>
                      </tr>
                    ) : (
                      users.map((user) => (
                        <tr key={user.id} className="border-t border-border/70">
                          <td className="px-3 py-2 font-medium">
                            <span className="inline-flex items-center gap-2">
                              <UserAvatar
                                name={user.full_name || user.username}
                                photoUrl={user.photo_url}
                                size="sm"
                              />
                              {user.full_name || "—"}
                            </span>
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
                              {user.is_active ? "Activo" : "Deshabilitado"}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {canWrite ? (
                              <Link
                                href={`/dashboard/usuarios?tab=alta&id=${user.id}`}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted"
                              >
                                <Pencil className="size-3.5" />
                                Editar
                              </Link>
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

        {!loading && activeTab === "alta" ? (
          <form onSubmit={handleSaveFicha} className="space-y-6">
            <section className="grid gap-4 rounded-xl border border-border bg-muted/20 p-4 sm:grid-cols-[1fr_auto]">
              <div className="space-y-3 sm:col-span-2">
                <h3 className="text-base font-semibold text-foreground">
                  {editingId ? "Editar ficha del colaborador" : "Alta de colaborador"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Completa o corrige todos los datos personales, laborales y de
                  acceso. Para varios colaboradores usa{" "}
                  <span className="font-medium text-foreground">
                    Carga masiva
                  </span>{" "}
                  con la plantilla Excel.
                </p>
              </div>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Buscar colaborador</span>
                <input
                  value={fichaQuery}
                  onChange={(event) => setFichaQuery(event.target.value)}
                  placeholder="Nombre, usuario, no. empleado o correo"
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5 sm:min-w-[240px]">
                <span className="text-sm font-medium">Ficha</span>
                <select
                  value={editingId}
                  onChange={(event) => openFicha(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Nuevo colaborador</option>
                  {fichaOptions.map((user) => (
                    <option key={user.id} value={user.id}>
                      {(user.full_name || user.username) +
                        (user.employee_number
                          ? ` · ${user.employee_number}`
                          : "")}
                      {user.is_active ? "" : " (deshabilitado)"}
                    </option>
                  ))}
                </select>
              </label>
              {editingId ? (
                <div className="sm:col-span-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9"
                    onClick={() => openFicha("")}
                  >
                    Nueva ficha
                  </Button>
                </div>
              ) : null}
            </section>
            <section className="grid gap-4 rounded-xl border border-border bg-muted/20 p-4 sm:grid-cols-2">
              <h3 className="text-base font-semibold text-foreground sm:col-span-2">
                Datos personales
              </h3>
              <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                <UserAvatar
                  name={alta.fullName || alta.username}
                  photoUrl={photoPreview || (removePhoto ? "" : photoUrl)}
                  size="lg"
                />
                <div className="space-y-2">
                  <p className="text-sm font-medium">Foto del colaborador</p>
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium hover:bg-muted">
                      <Camera className="size-3.5" />
                      {photoFile || photoUrl ? "Cambiar foto" : "Agregar foto"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="sr-only"
                        disabled={!canWrite}
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          setPhotoFile(file);
                          setRemovePhoto(false);
                          event.target.value = "";
                        }}
                      />
                    </label>
                    {(photoUrl || photoFile) && !removePhoto ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9"
                        disabled={!canWrite}
                        onClick={() => {
                          setPhotoFile(null);
                          setRemovePhoto(true);
                        }}
                      >
                        Quitar foto
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG o WebP. Máximo 2.5 MB.
                  </p>
                </div>
              </div>
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
                <span className="text-sm font-medium">Tipo de sangre *</span>
                <select
                  required
                  disabled={!canWrite}
                  value={alta.bloodType}
                  onChange={(e) => updateAlta("bloodType", e.target.value)}
                  className={inputClass}
                >
                  <option value="">Selecciona</option>
                  {BLOOD_TYPES.filter(Boolean).map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
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
                Contacto de emergencia
              </h3>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium">Nombre completo *</span>
                <input
                  required
                  disabled={!canWrite}
                  value={alta.emergencyContactName}
                  onChange={(e) =>
                    updateAlta("emergencyContactName", e.target.value)
                  }
                  placeholder="Nombre de la persona a contactar"
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Teléfono *</span>
                <input
                  required
                  type="tel"
                  disabled={!canWrite}
                  value={alta.emergencyContactPhone}
                  onChange={(e) =>
                    updateAlta("emergencyContactPhone", e.target.value)
                  }
                  className={inputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Parentesco *</span>
                <input
                  required
                  disabled={!canWrite}
                  value={alta.emergencyContactRelation}
                  onChange={(e) =>
                    updateAlta("emergencyContactRelation", e.target.value)
                  }
                  placeholder="Ej. Padre, Madre, Cónyuge"
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
                <span className="text-sm font-medium">
                  {editingId ? "Nueva contraseña (opcional)" : "Contraseña *"}
                </span>
                <input
                  required={!editingId}
                  type="password"
                  minLength={6}
                  disabled={!canWrite}
                  value={alta.password}
                  onChange={(e) => updateAlta("password", e.target.value)}
                  className={inputClass}
                  autoComplete="new-password"
                  placeholder={
                    editingId
                      ? "Déjala vacía para no cambiarla"
                      : "Mínimo 6 caracteres"
                  }
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
              {submitting
                ? "Guardando..."
                : editingId
                  ? "Guardar ficha"
                  : "Dar de alta colaborador"}
            </Button>
          </form>
        ) : null}

        {!loading && activeTab === "baja" ? (
          <div className="space-y-6">
            <p className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              Usa el interruptor para{" "}
              <strong className="text-foreground">habilitar o deshabilitar</strong>{" "}
              el acceso de forma temporal. Un usuario deshabilitado no puede
              iniciar sesión; su ficha y permisos se conservan para reactivarlo
              cuando quieras. El botón{" "}
              <strong className="text-foreground">Eliminar</strong> borra la ficha
              de forma permanente.
            </p>

            <section className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">
                Colaboradores con acceso activo
              </h3>
              <ResponsiveDataList
                emptyMessage="No hay colaboradores activos."
                items={activeUsers.map((user) => ({
                  key: user.id,
                  title: (
                    <span className="inline-flex items-center gap-2">
                      <UserAvatar
                        name={user.full_name || user.username}
                        photoUrl={user.photo_url}
                        size="sm"
                      />
                      {user.full_name || user.username}
                    </span>
                  ),
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
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/dashboard/usuarios?tab=alta&id=${user.id}`}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium"
                      >
                        <Pencil className="size-3.5" />
                        Editar ficha
                      </Link>
                      <AccessToggle
                        active
                        disabled={submitting}
                        onToggle={() => void handleSetActive(user, false)}
                      />
                      <button
                        type="button"
                        disabled={submitting}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-destructive/30 px-3 text-xs font-medium text-destructive"
                        onClick={() => void handleDeleteUser(user)}
                      >
                        <Trash2 className="size-3.5" />
                        Eliminar
                      </button>
                    </div>
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
                      <th className="px-3 py-2 font-medium">Acceso</th>
                      <th className="px-3 py-2 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeUsers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-3 py-8 text-center text-muted-foreground"
                        >
                          No hay colaboradores activos.
                        </td>
                      </tr>
                    ) : (
                      activeUsers.map((user) => (
                        <tr key={user.id} className="border-t border-border/70">
                          <td className="px-3 py-2 font-medium">
                            <span className="inline-flex items-center gap-2">
                              <UserAvatar
                                name={user.full_name || user.username}
                                photoUrl={user.photo_url}
                                size="sm"
                              />
                              {user.full_name || "—"}
                            </span>
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
                              <AccessToggle
                                active
                                disabled={submitting}
                                onToggle={() => void handleSetActive(user, false)}
                              />
                            ) : (
                              "Activo"
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {canWrite ? (
                              <div className="flex flex-wrap gap-2">
                                <Link
                                  href={`/dashboard/usuarios?tab=alta&id=${user.id}`}
                                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted"
                                >
                                  <Pencil className="size-3.5" />
                                  Editar
                                </Link>
                                <button
                                  type="button"
                                  disabled={submitting}
                                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-destructive/30 px-2.5 text-xs font-medium text-destructive hover:bg-destructive/5"
                                  onClick={() => void handleDeleteUser(user)}
                                >
                                  <Trash2 className="size-3.5" />
                                  Eliminar
                                </button>
                              </div>
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
                Acceso deshabilitado temporalmente
              </h3>
              <ResponsiveDataList
                emptyMessage="No hay colaboradores deshabilitados."
                items={inactiveUsers.map((user) => ({
                  key: user.id,
                  title: (
                    <span className="inline-flex items-center gap-2">
                      <UserAvatar
                        name={user.full_name || user.username}
                        photoUrl={user.photo_url}
                        size="sm"
                      />
                      {user.full_name || user.username}
                    </span>
                  ),
                  subtitle: `@${user.username}`,
                  badge: (
                    <span className="inline-flex rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-800 dark:text-amber-200">
                      Deshabilitado · {roleLabel(user.role)}
                    </span>
                  ),
                  fields: [
                    { label: "Puesto", value: user.job_title || "—" },
                    { label: "Área", value: user.department || "—" },
                  ],
                  actions: canWrite ? (
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/dashboard/usuarios?tab=alta&id=${user.id}`}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium"
                      >
                        <Pencil className="size-3.5" />
                        Editar ficha
                      </Link>
                      <AccessToggle
                        active={false}
                        disabled={submitting}
                        onToggle={() => void handleSetActive(user, true)}
                      />
                      <button
                        type="button"
                        disabled={submitting}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-destructive/30 px-3 text-xs font-medium text-destructive"
                        onClick={() => void handleDeleteUser(user)}
                      >
                        <Trash2 className="size-3.5" />
                        Eliminar
                      </button>
                    </div>
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
                      <th className="px-3 py-2 font-medium">Acceso</th>
                      <th className="px-3 py-2 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inactiveUsers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-3 py-8 text-center text-muted-foreground"
                        >
                          No hay colaboradores deshabilitados.
                        </td>
                      </tr>
                    ) : (
                      inactiveUsers.map((user) => (
                        <tr key={user.id} className="border-t border-border/70">
                          <td className="px-3 py-2 font-medium">
                            <span className="inline-flex items-center gap-2">
                              <UserAvatar
                                name={user.full_name || user.username}
                                photoUrl={user.photo_url}
                                size="sm"
                              />
                              {user.full_name || "—"}
                            </span>
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
                              <AccessToggle
                                active={false}
                                disabled={submitting}
                                onToggle={() => void handleSetActive(user, true)}
                              />
                            ) : (
                              "Deshabilitado"
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {canWrite ? (
                              <div className="flex flex-wrap gap-2">
                                <Link
                                  href={`/dashboard/usuarios?tab=alta&id=${user.id}`}
                                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted"
                                >
                                  <Pencil className="size-3.5" />
                                  Editar
                                </Link>
                                <button
                                  type="button"
                                  disabled={submitting}
                                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-destructive/30 px-2.5 text-xs font-medium text-destructive hover:bg-destructive/5"
                                  onClick={() => void handleDeleteUser(user)}
                                >
                                  <Trash2 className="size-3.5" />
                                  Eliminar
                                </button>
                              </div>
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
                      <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                        <UserAvatar
                          name={user.full_name || user.username}
                          photoUrl={user.photo_url}
                          size="sm"
                        />
                        {user.full_name || user.username}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        @{user.username} · {roleLabel(user.role)} ·{" "}
                        {user.is_active ? "Activo" : "Deshabilitado"}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </section>

            <section className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-semibold text-foreground">
                      Datos y permisos
                    </h3>
                    {selectedUser ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {canWrite ? (
                          <AccessToggle
                            active={selectedUser.is_active}
                            disabled={submitting}
                            onToggle={() =>
                              void handleSetActive(
                                selectedUser,
                                !selectedUser.is_active
                              )
                            }
                          />
                        ) : null}
                        <Link
                          href={`/dashboard/usuarios?tab=alta&id=${selectedUser.id}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium hover:bg-muted"
                        >
                          <Pencil className="size-3.5" />
                          Ficha completa
                        </Link>
                      </div>
                    ) : null}
                  </div>
              {selectedUser ? (
                <form onSubmit={handleSavePermissions} className="grid gap-4">
                  <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <p className="inline-flex items-center gap-2 font-medium text-foreground">
                      <UserAvatar
                        name={selectedUser.full_name || selectedUser.username}
                        photoUrl={selectedUser.photo_url}
                        size="sm"
                      />
                      {selectedUser.full_name || selectedUser.username}
                    </p>
                    <p className="text-muted-foreground">
                      @{selectedUser.username} · Estado:{" "}
                      {selectedUser.is_active
                        ? "Acceso activo"
                        : "Deshabilitado temporalmente"}
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
                      Usa el interruptor de arriba para habilitar el acceso y
                      poder editar datos y permisos.
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
