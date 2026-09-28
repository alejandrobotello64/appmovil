"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  History,
  KeyRound,
  Loader2,
  Lock,
  LockOpen,
  MonitorCog,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Stethoscope,
  Trash2,
  User,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/ui/modal-shell";
import { ReadOnlyBanner } from "@/components/warehouse/read-only-banner";
import { usePermissions, useSessionAccess } from "@/lib/auth/use-permissions";
import { mostCommon, normalizeKey } from "@/lib/equipment-grouping";
import {
  deleteServicePassword,
  getServicePasswordLog,
  listServicePasswords,
  revealServicePassword,
  saveServicePassword,
  VaultAuthError,
} from "@/lib/service-passwords/api";
import {
  LOG_ACTION_LABELS,
  SERVICE_PASSWORD_TYPES,
  servicePasswordTypeLabel,
  type ServicePassword,
  type ServicePasswordInput,
  type ServicePasswordLogEntry,
  type ServicePasswordType,
  type VaultCredentials,
} from "@/lib/service-passwords/types";
import { cn } from "@/lib/utils";

const AUTO_LOCK_MS = 10 * 60 * 1000;
const REVEAL_MS = 30 * 1000;
const MASK = "••••••••••";

const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-[#00BFFF]/30";

const TYPE_META: Record<ServicePasswordType, { icon: LucideIcon; tone: string; ring: string }> = {
  usuario: {
    icon: User,
    tone: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    ring: "border-sky-500/60 bg-sky-500/5",
  },
  biomedica: {
    icon: Stethoscope,
    tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    ring: "border-emerald-500/60 bg-emerald-500/5",
  },
  servicio: {
    icon: Wrench,
    tone: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
    ring: "border-violet-500/60 bg-violet-500/5",
  },
};

const TYPE_ORDER: Record<ServicePasswordType, number> = { usuario: 0, biomedica: 1, servicio: 2 };

function formatDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function equipmentLabel(item: ServicePassword) {
  return [item.brand, item.model].filter(Boolean).join(" ");
}

const NO_EQUIPMENT_KEY = "none";

/** "Atlan A350 Xl" y "atlan  a350 XL" son el mismo equipo. */
function equipmentKey(item: Pick<ServicePassword, "brand" | "model" | "equipmentType">) {
  const brand = normalizeKey(item.brand);
  const model = normalizeKey(item.model);
  if (brand || model) return `${brand}|${model}`;
  const type = normalizeKey(item.equipmentType);
  return type ? `tipo:${type}` : NO_EQUIPMENT_KEY;
}

type EquipmentValues = {
  equipmentType: string;
  brand: string;
  model: string;
  softwareVersion: string;
};

type Group = EquipmentValues & {
  key: string;
  title: string;
  subtitle: string;
  /** Versión distinta por contraseña: se muestra en cada fila. */
  mixedVersions: boolean;
  items: ServicePassword[];
};

function groupItems(items: ServicePassword[]): Group[] {
  const buckets = new Map<string, ServicePassword[]>();
  for (const item of items) {
    const key = equipmentKey(item);
    buckets.set(key, [...(buckets.get(key) ?? []), item]);
  }
  return Array.from(buckets.entries())
    .map(([key, rows]) => {
      const brand = mostCommon(rows.map((row) => row.brand));
      const model = mostCommon(rows.map((row) => row.model));
      const equipmentType = mostCommon(rows.map((row) => row.equipmentType));
      const versions = new Set(rows.map((row) => normalizeKey(row.softwareVersion)).filter(Boolean));
      const name = [brand, model].filter(Boolean).join(" ");
      return {
        key,
        brand,
        model,
        equipmentType,
        softwareVersion: versions.size === 1 ? mostCommon(rows.map((row) => row.softwareVersion)) : "",
        mixedVersions: versions.size > 1,
        title: name || equipmentType || "Sin equipo asignado",
        subtitle: name ? equipmentType : "",
        items: [...rows].sort(
          (a, b) =>
            TYPE_ORDER[a.passwordType] - TYPE_ORDER[b.passwordType] ||
            a.title.localeCompare(b.title, "es")
        ),
      };
    })
    .sort((a, b) => {
      if (a.key === NO_EQUIPMENT_KEY) return 1;
      if (b.key === NO_EQUIPMENT_KEY) return -1;
      return a.title.localeCompare(b.title, "es");
    });
}

function itemToInput(item: ServicePassword): ServicePasswordInput {
  return {
    passwordType: item.passwordType,
    title: item.title,
    equipmentType: item.equipmentType,
    brand: item.brand,
    model: item.model,
    softwareVersion: item.softwareVersion,
    clientName: item.clientName,
    accessUser: item.accessUser,
    notes: item.notes,
    secret: "",
  };
}

export function ServicePasswordsPanel() {
  const { canCreate, canEdit, canDelete, canExport, canApprove, canWrite } =
    usePermissions("contrasenas_servicio");
  const { session } = useSessionAccess();
  const [credentials, setCredentials] = useState<VaultCredentials | null>(null);
  const [items, setItems] = useState<ServicePassword[]>([]);
  const [lockNotice, setLockNotice] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ServicePasswordType | "all">("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ServicePassword | null>(null);
  const [preset, setPreset] = useState<Partial<ServicePasswordInput> | null>(null);
  const [equipmentEditing, setEquipmentEditing] = useState<Group | null>(null);
  const [logTarget, setLogTarget] = useState<ServicePassword | "all" | null>(null);
  const lastActivity = useRef(0);
  const hideTimers = useRef(new Map<string, number>());

  const clearHideTimers = useCallback(() => {
    for (const timer of hideTimers.current.values()) window.clearTimeout(timer);
    hideTimers.current.clear();
  }, []);

  const lock = useCallback(
    (notice = "") => {
      clearHideTimers();
      setCredentials(null);
      setItems([]);
      setRevealed({});
      setFormOpen(false);
      setEditing(null);
      setPreset(null);
      setEquipmentEditing(null);
      setLogTarget(null);
      setMessage("");
      setError("");
      setLockNotice(notice);
    },
    [clearHideTimers]
  );

  useEffect(() => {
    if (!credentials) return;
    lastActivity.current = Date.now();
    const bump = () => {
      lastActivity.current = Date.now();
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    for (const name of events) window.addEventListener(name, bump, { passive: true });
    const timer = window.setInterval(() => {
      if (Date.now() - lastActivity.current > AUTO_LOCK_MS) {
        lock("La bóveda se bloqueó tras 10 minutos sin actividad.");
      }
    }, 15_000);
    return () => {
      for (const name of events) window.removeEventListener(name, bump);
      window.clearInterval(timer);
    };
  }, [credentials, lock]);

  useEffect(() => clearHideTimers, [clearHideTimers]);

  const closeLog = useCallback(() => setLogTarget(null), []);

  const handleFailure = useCallback(
    (err: unknown, fallback: string) => {
      if (err instanceof VaultAuthError) {
        lock("Tu contraseña ya no coincide. Vuelve a desbloquear la bóveda.");
        return;
      }
      setError(err instanceof Error ? err.message : fallback);
    },
    [lock]
  );

  async function reload(creds: VaultCredentials) {
    try {
      setItems(await listServicePasswords(creds));
    } catch (err) {
      handleFailure(err, "No se pudieron cargar las contraseñas.");
    }
  }

  function handleUnlocked(creds: VaultCredentials, rows: ServicePassword[]) {
    setCredentials(creds);
    setItems(rows);
    setLockNotice("");
    setError("");
  }

  const brands = useMemo(() => {
    const byKey = new Map<string, string[]>();
    for (const item of items) {
      const key = normalizeKey(item.brand);
      if (key) byKey.set(key, [...(byKey.get(key) ?? []), item.brand]);
    }
    return Array.from(byKey.values())
      .map((values) => mostCommon(values))
      .sort((a, b) => a.localeCompare(b, "es"));
  }, [items]);

  const allGroups = useMemo(() => groupItems(items), [items]);

  const equipmentTypes = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.equipmentType.trim()).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b, "es")
      ),
    [items]
  );

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) counts.set(item.passwordType, (counts.get(item.passwordType) ?? 0) + 1);
    return counts;
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (typeFilter !== "all" && item.passwordType !== typeFilter) return false;
      if (brandFilter !== "all" && normalizeKey(item.brand) !== normalizeKey(brandFilter)) {
        return false;
      }
      if (!q) return true;
      return [
        item.title,
        item.brand,
        item.model,
        item.equipmentType,
        item.softwareVersion,
        item.clientName,
        item.accessUser,
        item.notes,
        servicePasswordTypeLabel(item.passwordType),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [items, search, typeFilter, brandFilter]);

  const groups = useMemo(() => groupItems(filtered), [filtered]);

  async function fetchSecret(item: ServicePassword) {
    if (!credentials) return null;
    if (revealed[item.id] !== undefined) return revealed[item.id];
    setBusyId(item.id);
    try {
      const secret = await revealServicePassword(credentials, item.id);
      setRevealed((current) => ({ ...current, [item.id]: secret }));
      const previous = hideTimers.current.get(item.id);
      if (previous) window.clearTimeout(previous);
      hideTimers.current.set(
        item.id,
        window.setTimeout(() => {
          hideTimers.current.delete(item.id);
          setRevealed((current) => {
            const next = { ...current };
            delete next[item.id];
            return next;
          });
        }, REVEAL_MS)
      );
      setItems((current) =>
        current.map((row) =>
          row.id === item.id
            ? { ...row, revealCount: row.revealCount + 1, lastRevealedAt: new Date().toISOString() }
            : row
        )
      );
      return secret;
    } catch (err) {
      handleFailure(err, "No se pudo mostrar la contraseña.");
      return null;
    } finally {
      setBusyId(null);
    }
  }

  function hideSecret(id: string) {
    const timer = hideTimers.current.get(id);
    if (timer) window.clearTimeout(timer);
    hideTimers.current.delete(id);
    setRevealed((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  async function copyText(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1800);
    } catch {
      setError("No se pudo copiar al portapapeles.");
    }
  }

  async function handleCopySecret(item: ServicePassword) {
    const secret = await fetchSecret(item);
    if (secret !== null) await copyText(`${item.id}:secret`, secret);
  }

  async function handleDelete(item: ServicePassword) {
    if (!credentials || !canDelete) return;
    const label = [item.title, equipmentLabel(item)].filter(Boolean).join(" · ");
    if (!window.confirm(`¿Eliminar la contraseña "${label}"? No se puede recuperar.`)) return;
    try {
      setError("");
      await deleteServicePassword(credentials, item.id);
      hideSecret(item.id);
      setItems((current) => current.filter((row) => row.id !== item.id));
      setMessage("Contraseña eliminada.");
    } catch (err) {
      handleFailure(err, "No se pudo eliminar la contraseña.");
    }
  }

  function openCreate(nextPreset: Partial<ServicePasswordInput> | null = null) {
    setEditing(null);
    setPreset(nextPreset);
    setFormOpen(true);
  }

  function openEdit(item: ServicePassword) {
    setPreset(null);
    setEditing(item);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setPreset(null);
  }

  async function handleSubmit(input: ServicePasswordInput) {
    if (!credentials) return;
    const wasEdit = Boolean(editing);
    await saveServicePassword(credentials, editing?.id ?? null, input);
    if (editing) hideSecret(editing.id);
    closeForm();
    setMessage(wasEdit ? "Contraseña actualizada." : "Contraseña guardada en la bóveda.");
    await reload(credentials);
  }

  async function handleEquipmentSubmit(group: Group, values: EquipmentValues) {
    if (!credentials) return;
    for (const item of group.items) {
      await saveServicePassword(credentials, item.id, {
        ...itemToInput(item),
        ...values,
        softwareVersion:
          values.softwareVersion || (group.mixedVersions ? item.softwareVersion : ""),
      });
    }
    setEquipmentEditing(null);
    setMessage(
      `Datos del equipo actualizados en ${group.items.length} contraseña${group.items.length === 1 ? "" : "s"}.`
    );
    await reload(credentials);
  }

  if (!credentials) {
    return (
      <UnlockCard
        username={session?.username ?? ""}
        notice={lockNotice}
        onUnlocked={handleUnlocked}
      />
    );
  }

  const hasFilters = search.trim() || typeFilter !== "all" || brandFilter !== "all";

  return (
    <div className="space-y-4">
      {error ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          {message}
        </p>
      ) : null}
      <ReadOnlyBanner
        visible={!canWrite}
        message="Tu rol es de consulta: puedes ver las contraseñas, pero no agregarlas ni editarlas."
      />

      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <LockOpen className="size-5 text-emerald-600" /> Contraseñas de servicio
            </h2>
            <p className="text-sm text-muted-foreground">
              Bóveda abierta. Cada consulta queda registrada y se bloquea sola tras 10 minutos sin
              actividad.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canApprove ? (
              <Button type="button" variant="outline" onClick={() => setLogTarget("all")}>
                <History className="size-4" /> Bitácora
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => lock()}>
              <Lock className="size-4" /> Bloquear
            </Button>
            {canCreate ? (
              <Button
                type="button"
                onClick={() => openCreate()}
                className="bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
              >
                <Plus className="size-4" /> Nueva contraseña
              </Button>
            ) : null}
          </div>
        </div>

        <div className="space-y-3 border-b border-border p-4">
          <div className="grid gap-2 md:grid-cols-[1fr_220px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por equipo, marca, modelo, cliente, usuario…"
                className={cn(fieldClass, "pl-9")}
                aria-label="Buscar contraseñas"
              />
            </label>
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className={fieldClass}
              aria-label="Filtrar por marca"
            >
              <option value="all">Todas las marcas</option>
              {brands.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              active={typeFilter === "all"}
              onClick={() => setTypeFilter("all")}
              label="Todas"
              count={items.length}
            />
            {SERVICE_PASSWORD_TYPES.map((type) => (
              <FilterChip
                key={type.id}
                active={typeFilter === type.id}
                onClick={() => setTypeFilter(type.id)}
                label={type.label}
                count={typeCounts.get(type.id) ?? 0}
              />
            ))}
          </div>
        </div>

        <div className="space-y-5 p-4">
          {groups.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
              <KeyRound className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {hasFilters
                  ? "Ninguna contraseña coincide con los filtros."
                  : "Aún no hay contraseñas guardadas."}
              </p>
              {!hasFilters && canCreate ? (
                <Button type="button" variant="outline" onClick={() => openCreate()}>
                  <Plus className="size-4" /> Agregar la primera
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {groups.map((group) => (
                <EquipmentCard
                  key={group.key}
                  group={group}
                  canCreate={canCreate}
                  canEdit={canEdit}
                  onAddPassword={(passwordType) =>
                    openCreate({
                      passwordType,
                      equipmentType: group.equipmentType,
                      brand: group.brand,
                      model: group.model,
                      softwareVersion: group.softwareVersion,
                    })
                  }
                  onEditEquipment={() => setEquipmentEditing(group)}
                >
                  {group.items.map((item) => (
                    <PasswordRow
                      key={item.id}
                      item={item}
                      showVersion={group.mixedVersions}
                      secret={revealed[item.id]}
                      busy={busyId === item.id}
                      copiedKey={copiedKey}
                      canReveal={canExport}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      canSeeLog={canApprove}
                      onReveal={() => void fetchSecret(item)}
                      onHide={() => hideSecret(item.id)}
                      onCopySecret={() => void handleCopySecret(item)}
                      onCopyUser={() => void copyText(`${item.id}:user`, item.accessUser)}
                      onEdit={() => openEdit(item)}
                      onDelete={() => void handleDelete(item)}
                      onLog={() => setLogTarget(item)}
                    />
                  ))}
                </EquipmentCard>
              ))}
            </div>
          )}
          {filtered.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {groups.length} equipo{groups.length === 1 ? "" : "s"} · {filtered.length} de{" "}
              {items.length} contraseñas · Las contraseñas visibles se ocultan solas a los 30
              segundos.
            </p>
          ) : null}
        </div>
      </section>

      {formOpen ? (
        <PasswordForm
          editing={editing}
          preset={preset}
          groups={allGroups}
          brands={brands}
          equipmentTypes={equipmentTypes}
          onCancel={closeForm}
          onSubmit={handleSubmit}
          onAuthError={() => lock("Tu contraseña ya no coincide. Vuelve a desbloquear la bóveda.")}
        />
      ) : null}

      {equipmentEditing ? (
        <EquipmentForm
          group={equipmentEditing}
          brands={brands}
          equipmentTypes={equipmentTypes}
          onCancel={() => setEquipmentEditing(null)}
          onSubmit={(values) => handleEquipmentSubmit(equipmentEditing, values)}
          onAuthError={() => lock("Tu contraseña ya no coincide. Vuelve a desbloquear la bóveda.")}
        />
      ) : null}

      {logTarget ? (
        <AccessLogModal
          credentials={credentials}
          target={logTarget}
          onClose={closeLog}
          onFailure={handleFailure}
        />
      ) : null}
    </div>
  );
}

function UnlockCard({
  username,
  notice,
  onUnlocked,
}: {
  username: string;
  notice: string;
  onUnlocked: (credentials: VaultCredentials, rows: ServicePassword[]) => void;
}) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const effectiveLogin = username || login;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!effectiveLogin.trim() || !password) {
      setError("Escribe tu contraseña.");
      return;
    }
    setSubmitting(true);
    setError("");
    const credentials = { username: effectiveLogin.trim(), password };
    try {
      const rows = await listServicePasswords(credentials);
      setPassword("");
      onUnlocked(credentials, rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir la bóveda.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-5 flex flex-col items-center text-center">
        <span className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white shadow-md">
          <ShieldCheck className="size-7" />
        </span>
        <h2 className="text-lg font-semibold">Bóveda de contraseñas de servicio</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Por seguridad, confirma tu contraseña de acceso a la app para ver las contraseñas de
          usuario, biomédica y servicio de los equipos.
        </p>
      </div>

      {notice ? (
        <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          {notice}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Usuario</span>
          <input
            value={effectiveLogin}
            onChange={(e) => setLogin(e.target.value)}
            readOnly={Boolean(username)}
            autoComplete="username"
            className={cn(fieldClass, username && "bg-muted/60 text-muted-foreground")}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Tu contraseña</span>
          <span className="relative block">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
              className={cn(fieldClass, "pr-10")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </span>
        </label>
        {error ? (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          disabled={submitting}
          className="w-full bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
        >
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <LockOpen className="size-4" />}
          Desbloquear
        </Button>
      </form>
    </section>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-transparent bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {label} <span className="tabular-nums opacity-75">{count}</span>
    </button>
  );
}

function TypeBadge({ type }: { type: ServicePasswordType }) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", meta.tone)}>
      <Icon className="size-3" /> {servicePasswordTypeLabel(type)}
    </span>
  );
}

function EquipmentCard({
  group,
  canCreate,
  canEdit,
  onAddPassword,
  onEditEquipment,
  children,
}: {
  group: Group;
  canCreate: boolean;
  canEdit: boolean;
  onAddPassword: (type: ServicePasswordType) => void;
  onEditEquipment: () => void;
  children: ReactNode;
}) {
  const present = new Set(group.items.map((item) => item.passwordType));
  const missing = SERVICE_PASSWORD_TYPES.filter((type) => !present.has(type.id));
  const hasEquipment = group.key !== NO_EQUIPMENT_KEY;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
      <header className="flex items-start gap-3 border-b border-border bg-muted/30 p-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white">
          <MonitorCog className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold break-words text-foreground">{group.title}</h3>
          <p className="text-xs text-muted-foreground">
            {[group.subtitle, group.softwareVersion ? `Software ${group.softwareVersion}` : ""]
              .filter(Boolean)
              .join(" · ") || "Sin datos de equipo"}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {SERVICE_PASSWORD_TYPES.filter((type) => present.has(type.id)).map((type) => (
              <TypeBadge key={type.id} type={type.id} />
            ))}
          </div>
        </div>
        {canEdit && hasEquipment ? (
          <IconAction label="Editar datos del equipo" icon={Pencil} onClick={onEditEquipment} />
        ) : null}
      </header>

      <ul className="flex-1 divide-y divide-border">{children}</ul>

      {canCreate && hasEquipment ? (
        <footer className="flex flex-wrap items-center gap-1.5 border-t border-border px-4 py-2.5">
          <span className="mr-1 text-xs text-muted-foreground">Agregar a este equipo:</span>
          {(missing.length ? missing : SERVICE_PASSWORD_TYPES).map((type) => {
            const Icon = TYPE_META[type.id].icon;
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => onAddPassword(type.id)}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-solid hover:bg-muted hover:text-foreground"
              >
                <Plus className="size-3" />
                <Icon className="size-3" /> {type.label}
              </button>
            );
          })}
        </footer>
      ) : null}
    </article>
  );
}

function PasswordRow({
  item,
  showVersion,
  secret,
  busy,
  copiedKey,
  canReveal,
  canEdit,
  canDelete,
  canSeeLog,
  onReveal,
  onHide,
  onCopySecret,
  onCopyUser,
  onEdit,
  onDelete,
  onLog,
}: {
  item: ServicePassword;
  showVersion: boolean;
  secret: string | undefined;
  busy: boolean;
  copiedKey: string | null;
  canReveal: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canSeeLog: boolean;
  onReveal: () => void;
  onHide: () => void;
  onCopySecret: () => void;
  onCopyUser: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onLog: () => void;
}) {
  const visible = secret !== undefined;
  const secretCopied = copiedKey === `${item.id}:secret`;
  const userCopied = copiedKey === `${item.id}:user`;
  const context = [
    showVersion && item.softwareVersion ? `Software ${item.softwareVersion}` : "",
    item.clientName,
  ].filter(Boolean);

  return (
    <li className="flex flex-col gap-2.5 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge type={item.passwordType} />
            <h4 className="text-sm font-semibold break-words">{item.title}</h4>
          </div>
          {context.length ? (
            <p className="text-xs text-muted-foreground">{context.join(" · ")}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center">
          {canSeeLog ? <IconAction label="Ver bitácora" icon={History} onClick={onLog} /> : null}
          {canEdit ? <IconAction label="Editar" icon={Pencil} onClick={onEdit} /> : null}
          {canDelete ? (
            <IconAction
              label="Eliminar"
              icon={Trash2}
              onClick={onDelete}
              className="text-destructive hover:bg-destructive/10"
            />
          ) : null}
        </div>
      </div>

      <dl className="space-y-1.5 text-sm">
        {item.accessUser ? (
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5">
            <dt className="w-20 shrink-0 text-xs text-muted-foreground">Usuario</dt>
            <dd className="min-w-0 flex-1 truncate font-mono text-[13px]">{item.accessUser}</dd>
            <IconAction
              label={userCopied ? "Copiado" : "Copiar usuario"}
              icon={userCopied ? Check : Copy}
              onClick={onCopyUser}
              className={cn("size-7", userCopied && "text-emerald-600")}
            />
          </div>
        ) : null}
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5">
          <dt className="w-20 shrink-0 text-xs text-muted-foreground">Contraseña</dt>
          <dd
            className={cn(
              "min-w-0 flex-1 font-mono text-[13px] break-all",
              !visible && "tracking-widest text-muted-foreground"
            )}
          >
            {visible ? secret || "(vacía)" : MASK}
          </dd>
          {canReveal ? (
            <>
              {busy ? (
                <Loader2 className="mx-1.5 size-4 animate-spin text-muted-foreground" />
              ) : (
                <IconAction
                  label={visible ? "Ocultar" : "Mostrar"}
                  icon={visible ? EyeOff : Eye}
                  onClick={visible ? onHide : onReveal}
                  className="size-7"
                />
              )}
              <IconAction
                label={secretCopied ? "Copiada" : "Copiar contraseña"}
                icon={secretCopied ? Check : Copy}
                onClick={onCopySecret}
                className={cn("size-7", secretCopied && "text-emerald-600")}
              />
            </>
          ) : null}
        </div>
      </dl>

      {item.notes ? (
        <p className="rounded-lg border border-dashed border-border px-2.5 py-2 text-xs whitespace-pre-line text-muted-foreground">
          {item.notes}
        </p>
      ) : null}

      <p className="text-[11px] text-muted-foreground">
        Actualizó {item.updatedByName || item.createdByName || "—"} · {formatDateTime(item.updatedAt)}
        {item.revealCount
          ? ` · ${item.revealCount} consulta${item.revealCount === 1 ? "" : "s"}`
          : ""}
      </p>
    </li>
  );
}

function IconAction({
  label,
  onClick,
  icon: Icon,
  className,
}: {
  label: string;
  onClick: () => void;
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground",
        className
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

type FormState = Omit<ServicePasswordInput, "secret">;

function suggestedTitle(type: ServicePasswordType) {
  return `Clave de ${servicePasswordTypeLabel(type)}`;
}

function PasswordForm({
  editing,
  preset,
  groups,
  brands,
  equipmentTypes,
  onCancel,
  onSubmit,
  onAuthError,
}: {
  editing: ServicePassword | null;
  preset: Partial<ServicePasswordInput> | null;
  groups: Group[];
  brands: string[];
  equipmentTypes: string[];
  onCancel: () => void;
  onSubmit: (input: ServicePasswordInput) => Promise<void>;
  onAuthError: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => {
    if (editing) {
      return {
        passwordType: editing.passwordType,
        title: editing.title,
        equipmentType: editing.equipmentType,
        brand: editing.brand,
        model: editing.model,
        softwareVersion: editing.softwareVersion,
        clientName: editing.clientName,
        accessUser: editing.accessUser,
        notes: editing.notes,
      };
    }
    const passwordType = preset?.passwordType ?? "servicio";
    return {
      passwordType,
      title: preset?.title ?? (preset?.passwordType ? suggestedTitle(passwordType) : ""),
      equipmentType: preset?.equipmentType ?? "",
      brand: preset?.brand ?? "",
      model: preset?.model ?? "",
      softwareVersion: preset?.softwareVersion ?? "",
      clientName: preset?.clientName ?? "",
      accessUser: preset?.accessUser ?? "",
      notes: preset?.notes ?? "",
    };
  });
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const equipmentGroups = groups.filter((group) => group.key !== NO_EQUIPMENT_KEY);
  const currentKey = equipmentKey(form);
  const matchedGroup = equipmentGroups.find((group) => group.key === currentKey);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function changeType(type: ServicePasswordType) {
    setForm((current) => ({
      ...current,
      passwordType: type,
      title:
        !current.title.trim() || current.title === suggestedTitle(current.passwordType)
          ? suggestedTitle(type)
          : current.title,
    }));
  }

  function pickGroup(key: string) {
    const group = equipmentGroups.find((item) => item.key === key);
    setForm((current) =>
      group
        ? {
            ...current,
            brand: group.brand,
            model: group.model,
            equipmentType: group.equipmentType,
            softwareVersion: group.softwareVersion,
          }
        : { ...current, brand: "", model: "", equipmentType: "", softwareVersion: "" }
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!form.title.trim()) {
      setError("Ponle un nombre, p. ej. \"Menú de servicio\".");
      return;
    }
    if (!editing && !secret) {
      setError("Escribe la contraseña.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ ...form, secret });
    } catch (err) {
      if (err instanceof VaultAuthError) {
        onAuthError();
        return;
      }
      setError(err instanceof Error ? err.message : "No se pudo guardar la contraseña.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell
      title={editing ? "Editar contraseña" : "Nueva contraseña de servicio"}
      description="Se guarda cifrada. Solo la ven colaboradores con permiso y cada consulta queda en la bitácora."
      headerAction={
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
          aria-label="Cerrar"
        >
          <X className="size-5" />
        </button>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Tipo de contraseña</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {SERVICE_PASSWORD_TYPES.map((type) => {
              const meta = TYPE_META[type.id];
              const Icon = meta.icon;
              const active = form.passwordType === type.id;
              return (
                <label
                  key={type.id}
                  className={cn(
                    "flex cursor-pointer flex-col gap-1 rounded-xl border-2 p-3 transition-colors",
                    active ? meta.ring : "border-border hover:bg-muted/50"
                  )}
                >
                  <input
                    type="radio"
                    name="password-type"
                    value={type.id}
                    checked={active}
                    onChange={() => changeType(type.id)}
                    className="sr-only"
                  />
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <span className={cn("flex size-7 items-center justify-center rounded-lg", meta.tone)}>
                      <Icon className="size-4" />
                    </span>
                    {type.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{type.description}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {equipmentGroups.length ? (
          <label className="block rounded-xl border border-border bg-muted/30 p-3">
            <span className="mb-1 flex items-center gap-1.5 text-sm font-medium">
              <MonitorCog className="size-4 text-[#3B46A5]" /> Equipo
            </span>
            <select
              value={matchedGroup ? matchedGroup.key : ""}
              onChange={(e) => pickGroup(e.target.value)}
              className={fieldClass}
            >
              <option value="">Equipo nuevo (llenar datos abajo)</option>
              {equipmentGroups.map((group) => (
                <option key={group.key} value={group.key}>
                  {group.title}
                  {group.subtitle ? ` · ${group.subtitle}` : ""} ({group.items.length})
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-muted-foreground">
              {matchedGroup
                ? "Se agrupará con las demás contraseñas de este equipo."
                : "Elige un equipo existente para agruparla con sus otras contraseñas."}
            </span>
          </label>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-medium">Nombre / acceso</span>
            <input
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Ej. Menú de servicio, Configuración de usuario, Modo demo"
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Tipo de equipo</span>
            <input
              value={form.equipmentType}
              onChange={(e) => update("equipmentType", e.target.value)}
              list="vault-equipment-types"
              placeholder="Ej. Monitor de signos vitales"
              className={fieldClass}
            />
            <datalist id="vault-equipment-types">
              {equipmentTypes.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Marca</span>
            <input
              value={form.brand}
              onChange={(e) => update("brand", e.target.value)}
              list="vault-brands"
              placeholder="Ej. Mindray, Philips, GE"
              className={fieldClass}
            />
            <datalist id="vault-brands">
              {brands.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Modelo</span>
            <input
              value={form.model}
              onChange={(e) => update("model", e.target.value)}
              placeholder="Ej. iMEC 10"
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Versión de software</span>
            <input
              value={form.softwareVersion}
              onChange={(e) => update("softwareVersion", e.target.value)}
              placeholder="Opcional"
              className={fieldClass}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-medium">Cliente / hospital</span>
            <input
              value={form.clientName}
              onChange={(e) => update("clientName", e.target.value)}
              placeholder="Solo si la contraseña es exclusiva de un cliente (opcional)"
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Usuario de acceso</span>
            <input
              value={form.accessUser}
              onChange={(e) => update("accessUser", e.target.value)}
              placeholder="Opcional, p. ej. service, admin"
              autoComplete="off"
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Contraseña</span>
            <span className="relative block">
              <input
                type={showSecret ? "text" : "password"}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder={editing ? "Vacío = conservar la actual" : ""}
                autoComplete="new-password"
                className={cn(fieldClass, "pr-10 font-mono")}
              />
              <button
                type="button"
                onClick={() => setShowSecret((current) => !current)}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                aria-label={showSecret ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </span>
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-medium">Procedimiento / notas</span>
            <textarea
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={3}
              placeholder="Ej. Menú > Mantenimiento > Fábrica. Mantener presionado Silenciar al encender."
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#00BFFF]/30"
            />
          </label>
        </div>

        {error ? (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {editing ? "Guardar cambios" : "Guardar contraseña"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

function EquipmentForm({
  group,
  brands,
  equipmentTypes,
  onCancel,
  onSubmit,
  onAuthError,
}: {
  group: Group;
  brands: string[];
  equipmentTypes: string[];
  onCancel: () => void;
  onSubmit: (values: EquipmentValues) => Promise<void>;
  onAuthError: () => void;
}) {
  const [values, setValues] = useState<EquipmentValues>({
    equipmentType: group.equipmentType,
    brand: group.brand,
    model: group.model,
    softwareVersion: group.softwareVersion,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function update<K extends keyof EquipmentValues>(key: K, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!values.brand.trim() && !values.model.trim() && !values.equipmentType.trim()) {
      setError("Escribe al menos la marca, el modelo o el tipo de equipo.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        equipmentType: values.equipmentType.trim(),
        brand: values.brand.trim(),
        model: values.model.trim(),
        softwareVersion: values.softwareVersion.trim(),
      });
    } catch (err) {
      if (err instanceof VaultAuthError) {
        onAuthError();
        return;
      }
      setError(err instanceof Error ? err.message : "No se pudo actualizar el equipo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell
      title="Editar datos del equipo"
      description={`Se aplicará a las ${group.items.length} contraseñas de ${group.title}. Las contraseñas no cambian.`}
      className="max-w-xl"
      headerAction={
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
          aria-label="Cerrar"
        >
          <X className="size-5" />
        </button>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-medium">Tipo de equipo</span>
            <input
              value={values.equipmentType}
              onChange={(e) => update("equipmentType", e.target.value)}
              list="vault-edit-equipment-types"
              className={fieldClass}
            />
            <datalist id="vault-edit-equipment-types">
              {equipmentTypes.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Marca</span>
            <input
              value={values.brand}
              onChange={(e) => update("brand", e.target.value)}
              list="vault-edit-brands"
              className={fieldClass}
            />
            <datalist id="vault-edit-brands">
              {brands.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Modelo</span>
            <input
              value={values.model}
              onChange={(e) => update("model", e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-medium">Versión de software</span>
            <input
              value={values.softwareVersion}
              onChange={(e) => update("softwareVersion", e.target.value)}
              placeholder={group.mixedVersions ? "Hoy tiene versiones distintas por contraseña" : "Opcional"}
              className={fieldClass}
            />
          </label>
        </div>

        {error ? (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Guardar en todas
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

function AccessLogModal({
  credentials,
  target,
  onClose,
  onFailure,
}: {
  credentials: VaultCredentials;
  target: ServicePassword | "all";
  onClose: () => void;
  onFailure: (err: unknown, fallback: string) => void;
}) {
  const [entries, setEntries] = useState<ServicePasswordLogEntry[] | null>(null);
  const targetId = target === "all" ? null : target.id;

  useEffect(() => {
    let active = true;
    getServicePasswordLog(credentials, targetId)
      .then((rows) => {
        if (active) setEntries(rows);
      })
      .catch((err) => {
        if (!active) return;
        onFailure(err, "No se pudo cargar la bitácora.");
        onClose();
      });
    return () => {
      active = false;
    };
  }, [credentials, targetId, onFailure, onClose]);

  return (
    <ModalShell
      title="Bitácora de accesos"
      description={
        target === "all"
          ? "Últimos movimientos de toda la bóveda."
          : [target.title, equipmentLabel(target)].filter(Boolean).join(" · ")
      }
      className="max-w-xl"
      headerAction={
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
          aria-label="Cerrar"
        >
          <X className="size-5" />
        </button>
      }
    >
      {entries === null ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin movimientos registrados.</p>
      ) : (
        <ul className="divide-y divide-border">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p>
                  <span className="font-medium">{entry.userName || "—"}</span>{" "}
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[11px] font-medium",
                      entry.action === "reveal"
                        ? "bg-sky-500/10 text-sky-700 dark:text-sky-300"
                        : entry.action === "delete"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-muted text-muted-foreground"
                    )}
                  >
                    {LOG_ACTION_LABELS[entry.action] ?? entry.action}
                  </span>
                </p>
                {target === "all" ? (
                  <p className="truncate text-xs text-muted-foreground">{entry.passwordTitle}</p>
                ) : null}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {formatDateTime(entry.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </ModalShell>
  );
}
