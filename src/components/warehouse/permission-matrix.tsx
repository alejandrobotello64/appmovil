"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Minus, Plus, RotateCcw, Search } from "lucide-react";
import {
  ALL_PERMISSION_KEYS,
  APP_ROLES,
  actionLabel,
  hasPermission,
  PERMISSION_GROUPS,
  permissionKey,
  roleDefaultPermission,
  type AppRole,
  type PermissionAction,
  type PermissionKey,
  type PermissionModuleDef,
  type PermissionOverrides,
} from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

type PermissionMatrixProps = {
  role: AppRole;
  overrides: PermissionOverrides;
  onRoleChange: (role: AppRole) => void;
  onOverridesChange: (overrides: PermissionOverrides) => void;
  disabled?: boolean;
};

type CellState = "role-on" | "role-off" | "granted" | "revoked";

function setKey(
  role: AppRole,
  overrides: PermissionOverrides,
  key: PermissionKey,
  value: boolean
): PermissionOverrides {
  const next = { ...overrides };
  if (roleDefaultPermission(role, key) === value) {
    delete next[key];
  } else {
    next[key] = value;
  }
  return next;
}

export function PermissionMatrix({
  role,
  overrides,
  onRoleChange,
  onOverridesChange,
  disabled,
}: PermissionMatrixProps) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const subject = useMemo(
    () => ({ role, permissionOverrides: overrides }),
    [role, overrides]
  );

  const summary = useMemo(() => {
    let active = 0;
    let granted = 0;
    let revoked = 0;
    for (const key of ALL_PERMISSION_KEYS) {
      if (hasPermission(subject, key)) active += 1;
      const override = overrides[key];
      if (typeof override !== "boolean") continue;
      if (override !== roleDefaultPermission(role, key)) {
        if (override) granted += 1;
        else revoked += 1;
      }
    }
    return { active, granted, revoked, total: ALL_PERMISSION_KEYS.length };
  }, [overrides, role, subject]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PERMISSION_GROUPS;
    return PERMISSION_GROUPS.map((group) => ({
      ...group,
      modules: group.modules.filter((module) =>
        [group.label, module.label, module.description]
          .join(" ")
          .toLowerCase()
          .includes(q)
      ),
    })).filter((group) => group.modules.length > 0);
  }, [query]);

  function cellState(key: PermissionKey): CellState {
    const base = roleDefaultPermission(role, key);
    const override = overrides[key];
    if (typeof override === "boolean" && override !== base) {
      return override ? "granted" : "revoked";
    }
    return base ? "role-on" : "role-off";
  }

  function rawValue(key: PermissionKey) {
    const override = overrides[key];
    return typeof override === "boolean" ? override : roleDefaultPermission(role, key);
  }

  function toggle(key: PermissionKey) {
    onOverridesChange(setKey(role, overrides, key, !rawValue(key)));
  }

  function setModule(module: PermissionModuleDef, mode: "all" | "none" | "role") {
    let next = { ...overrides };
    for (const { action } of module.actions) {
      const key = permissionKey(module.id, action);
      if (mode === "role") {
        delete next[key];
      } else {
        next = setKey(role, next, key, mode === "all");
      }
    }
    onOverridesChange(next);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium">Rol base (plantilla)</p>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {APP_ROLES.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => onRoleChange(item.id)}
              className={cn(
                "rounded-xl border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                role === item.id
                  ? "border-[#3B46A5] bg-[linear-gradient(135deg,rgba(0,191,255,0.12),rgba(59,70,165,0.16))]"
                  : "border-border bg-background hover:bg-muted/60"
              )}
            >
              <span className="block text-sm font-medium text-foreground">
                {item.label}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {item.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs">
        <span className="font-medium text-foreground">
          {summary.active} de {summary.total} permisos activos
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">
          <Plus className="size-3" /> {summary.granted} concedidos extra
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-rose-700 dark:text-rose-300">
          <Minus className="size-3" /> {summary.revoked} quitados
        </span>
        {summary.granted + summary.revoked > 0 ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onOverridesChange({})}
            className="ml-auto inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 font-medium hover:bg-muted disabled:opacity-50"
          >
            <RotateCcw className="size-3" /> Restablecer al rol
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded border border-[#3B46A5]/40 bg-[#3B46A5]/15" />
          Incluido en el rol
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded border border-emerald-500/50 bg-emerald-500/20" />
          Concedido extra
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded border border-rose-500/50 bg-rose-500/15" />
          Quitado al usuario
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded border border-border bg-muted/40" />
          Sin permiso
        </span>
      </div>

      <label className="relative block">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar módulo (ej. cotizaciones, flotilla...)"
          className="h-10 w-full rounded-lg border border-input bg-background pr-3 pl-9 text-sm"
        />
      </label>

      <div className="space-y-3">
        {groups.map((group) => {
          const isCollapsed = collapsed[group.id] && !query;
          const groupKeys = group.modules.flatMap((module) =>
            module.actions.map((item) => permissionKey(module.id, item.action))
          );
          const groupActive = groupKeys.filter((key) =>
            hasPermission(subject, key)
          ).length;

          return (
            <section
              key={group.id}
              className="overflow-hidden rounded-xl border border-border bg-background"
            >
              <button
                type="button"
                onClick={() =>
                  setCollapsed((current) => ({
                    ...current,
                    [group.id]: !current[group.id],
                  }))
                }
                className="flex w-full items-center justify-between gap-2 bg-muted/40 px-3 py-2 text-left"
              >
                <span className="text-sm font-semibold text-foreground">
                  {group.label}
                </span>
                <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  {groupActive}/{groupKeys.length}
                  <ChevronDown
                    className={cn(
                      "size-4 transition-transform",
                      isCollapsed ? "-rotate-90" : "rotate-0"
                    )}
                  />
                </span>
              </button>

              {isCollapsed ? null : (
                <div className="divide-y divide-border">
                  {group.modules.map((module) => {
                    const viewKey = permissionKey(module.id, "view");
                    const viewOn = rawValue(viewKey);

                    return (
                      <div key={module.id} className="space-y-2 px-3 py-2.5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              {module.label}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {module.description}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-1 text-[11px]">
                            {(
                              [
                                ["all", "Todo"],
                                ["none", "Nada"],
                                ["role", "Rol"],
                              ] as const
                            ).map(([mode, label]) => (
                              <button
                                key={mode}
                                type="button"
                                disabled={disabled}
                                onClick={() => setModule(module, mode)}
                                className="rounded-md border border-border px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {module.actions.map(({ action }) => {
                            const key = permissionKey(module.id, action);
                            const state = cellState(key);
                            const blocked = action !== "view" && !viewOn;
                            const on = state === "role-on" || state === "granted";

                            return (
                              <PermissionChip
                                key={key}
                                label={actionLabel(module.id, action)}
                                action={action}
                                state={state}
                                blocked={blocked}
                                disabled={disabled || blocked}
                                pressed={on && !blocked}
                                onClick={() => toggle(key)}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
        {groups.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Ningún módulo coincide con la búsqueda.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function PermissionChip({
  label,
  action,
  state,
  blocked,
  disabled,
  pressed,
  onClick,
}: {
  label: string;
  action: PermissionAction;
  state: CellState;
  blocked: boolean;
  disabled?: boolean;
  pressed: boolean;
  onClick: () => void;
}) {
  const title = blocked
    ? "Activa primero «Ver» para este módulo"
    : state === "granted"
      ? "Concedido extra (no viene en el rol)"
      : state === "revoked"
        ? "Quitado a este usuario (el rol sí lo incluye)"
        : state === "role-on"
          ? "Incluido en el rol"
          : "Sin permiso";

  return (
    <button
      type="button"
      aria-pressed={pressed}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed",
        action === "view" && "font-semibold",
        blocked
          ? "border-dashed border-border bg-transparent text-muted-foreground/60"
          : state === "granted"
            ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-800 hover:bg-emerald-500/25 dark:text-emerald-200"
            : state === "revoked"
              ? "border-rose-500/50 bg-rose-500/10 text-rose-700 line-through hover:bg-rose-500/20 dark:text-rose-300"
              : state === "role-on"
                ? "border-[#3B46A5]/40 bg-[#3B46A5]/10 text-foreground hover:bg-[#3B46A5]/20"
                : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
      )}
    >
      {state === "granted" && !blocked ? <Plus className="size-3" /> : null}
      {state === "revoked" && !blocked ? <Minus className="size-3" /> : null}
      {label}
    </button>
  );
}
