"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Check,
  ChevronDown,
  ClipboardCheck,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReadOnlyBanner } from "@/components/warehouse/read-only-banner";
import { getSession } from "@/lib/auth";
import { usePermissions } from "@/lib/auth/use-permissions";
import {
  addChecklistTemplatePoint,
  createChecklistTemplate,
  deleteChecklistTemplate,
  deleteChecklistTemplatePoint,
  getChecklistTemplates,
  setChecklistTemplateLock,
  updateChecklistTemplateMeta,
  updateChecklistTemplatePoint,
} from "@/lib/service-orders/storage";
import {
  EQUIPMENT_KINDS,
  LIST_KINDS,
  equipmentKindLabel,
  formatValidInterval,
  listKindLabel,
  parseOptionalNumber,
  type ChecklistTemplate,
  type ChecklistTemplatePoint,
  type EquipmentKind,
  type ListKind,
} from "@/lib/service-orders/types";
import {
  isActorServiceAdvisor,
  listStaffMembers,
  type StaffMember,
} from "@/lib/users/staff";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none";

export function ChecklistTemplatesPanel() {
  const { canWrite } = usePermissions("ordenes_servicio");
  const session = getSession();
  const actor = session?.username ?? "usuario";
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [newPoint, setNewPoint] = useState("");
  const [newPointMin, setNewPointMin] = useState("");
  const [newPointMax, setNewPointMax] = useState("");
  const [newPointUnit, setNewPointUnit] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createKind, setCreateKind] = useState<EquipmentKind>("general");
  const [createListKind, setCreateListKind] = useState<ListKind>("verificacion");
  const [createDescription, setCreateDescription] = useState("");
  const [kindFilter, setKindFilter] = useState<ListKind | "todas">("todas");
  const [editingPointId, setEditingPointId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editMin, setEditMin] = useState("");
  const [editMax, setEditMax] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const isAdvisor = isActorServiceAdvisor(staff, session);

  async function reload(quiet = false) {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const [list, staffList] = await Promise.all([
        getChecklistTemplates({ includeInactive: true }),
        listStaffMembers().catch(() => [] as StaffMember[]),
      ]);
      setTemplates(list);
      setStaff(staffList);
      if (openId && !list.some((t) => t.id === openId)) {
        setOpenId(list[0]?.id ?? null);
      } else if (!openId && list[0]) {
        setOpenId(list[0].id);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudieron cargar plantillas."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    setEditingPointId(null);
    setEditLabel("");
    setEditMin("");
    setEditMax("");
    setEditUnit("");
  }, [openId]);

  const visible = useMemo(
    () =>
      kindFilter === "todas"
        ? templates
        : templates.filter((tpl) => tpl.listKind === kindFilter),
    [templates, kindFilter]
  );

  const selected = templates.find((t) => t.id === openId) ?? null;
  const canEditSelected = canWrite && !selected?.locked;
  const verificationCount = templates.filter(
    (tpl) => tpl.listKind === "verificacion"
  ).length;
  const functionCount = templates.filter(
    (tpl) => tpl.listKind === "funcionamiento"
  ).length;

  async function saveMeta(patch: {
    name?: string;
    description?: string;
    isActive?: boolean;
  }) {
    if (!selected || !canEditSelected) return;
    try {
      setSaving(true);
      setError("");
      await updateChecklistTemplateMeta(selected.id, patch);
      await reload(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function addPoint() {
    if (!selected || !canEditSelected || !newPoint.trim()) return;
    try {
      setSaving(true);
      setError("");
      const minValue = parseOptionalNumber(newPointMin);
      const maxValue = parseOptionalNumber(newPointMax);
      if (newPointMin.trim() && minValue == null) {
        throw new Error("El mínimo del intervalo no es un número válido.");
      }
      if (newPointMax.trim() && maxValue == null) {
        throw new Error("El máximo del intervalo no es un número válido.");
      }
      await addChecklistTemplatePoint(selected.id, {
        label: newPoint.trim(),
        unit: newPointUnit,
        minValue,
        maxValue,
      });
      setNewPoint("");
      setNewPointMin("");
      setNewPointMax("");
      setNewPointUnit("");
      await reload(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar el punto.");
    } finally {
      setSaving(false);
    }
  }

  function startEditPoint(point: ChecklistTemplatePoint) {
    if (!canEditSelected) return;
    setEditingPointId(point.id);
    setEditLabel(point.label);
    setEditMin(point.minValue == null ? "" : String(point.minValue));
    setEditMax(point.maxValue == null ? "" : String(point.maxValue));
    setEditUnit(point.unit ?? "");
    setError("");
  }

  function cancelEditPoint() {
    setEditingPointId(null);
    setEditLabel("");
    setEditMin("");
    setEditMax("");
    setEditUnit("");
  }

  async function saveEditedPoint(isFunction: boolean) {
    if (!canEditSelected || !editingPointId) return;
    const label = editLabel.trim();
    if (!label) {
      setError("El punto no puede estar vacío.");
      return;
    }
    const minValue = parseOptionalNumber(editMin);
    const maxValue = parseOptionalNumber(editMax);
    if (editMin.trim() && minValue == null) {
      setError("El mínimo del intervalo no es un número válido.");
      return;
    }
    if (editMax.trim() && maxValue == null) {
      setError("El máximo del intervalo no es un número válido.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      await updateChecklistTemplatePoint(editingPointId, {
        label,
        ...(isFunction
          ? { unit: editUnit, minValue, maxValue }
          : {}),
      });
      cancelEditPoint();
      await reload(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo guardar el punto."
      );
    } finally {
      setSaving(false);
    }
  }

  async function removePoint(pointId: string) {
    if (!canEditSelected) return;
    if (!window.confirm("¿Eliminar este punto de la plantilla?")) return;
    try {
      setSaving(true);
      setError("");
      await deleteChecklistTemplatePoint(pointId);
      await reload(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar.");
    } finally {
      setSaving(false);
    }
  }

  async function createTemplate() {
    if (!canWrite || !createName.trim()) return;
    try {
      setSaving(true);
      setError("");
      const created = await createChecklistTemplate({
        name: createName.trim(),
        equipmentKind: createKind,
        listKind: createListKind,
        description: createDescription.trim(),
      });
      setCreateName("");
      setCreateDescription("");
      setCreateKind("general");
      setCreateListKind("verificacion");
      setShowCreate(false);
      setKindFilter(created.listKind);
      setOpenId(created.id);
      await reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo crear la plantilla."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleLock(tpl: ChecklistTemplate) {
    if (!isAdvisor) return;
    const next = !tpl.locked;
    if (
      next &&
      !window.confirm(
        "Al candar la plantilla ya no se podrá modificar. ¿Continuar?"
      )
    ) {
      return;
    }
    try {
      setSaving(true);
      setError("");
      await setChecklistTemplateLock(tpl.id, next, actor);
      await reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo actualizar el candado."
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeTemplate(tpl: ChecklistTemplate) {
    if (!isAdvisor) return;
    if (
      !window.confirm(
        `¿Eliminar la plantilla «${tpl.name}» y todos sus puntos? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    try {
      setSaving(true);
      setError("");
      await deleteChecklistTemplate(tpl.id, actor);
      if (openId === tpl.id) setOpenId(null);
      await reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo eliminar la plantilla."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      {!canWrite ? <ReadOnlyBanner visible /> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#3B46A5]">
            Plantillas de checklist y pruebas
          </h2>
          <p className="text-sm text-muted-foreground">
            Crea listas de dos tipos: checklist de verificación (estado físico del
            equipo) y pruebas de funcionamiento (pasa / no pasa). Cada una se
            aplica por separado en la orden de servicio.
          </p>
        </div>
        {canWrite ? (
          <Button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
          >
            <Plus className="size-4" /> Nueva plantilla
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["todas", `Todas (${templates.length})`],
            ["verificacion", `Verificación (${verificationCount})`],
            ["funcionamiento", `Pruebas de funcionamiento (${functionCount})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setKindFilter(id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium",
              kindFilter === id
                ? id === "funcionamiento"
                  ? "bg-teal-600 text-white"
                  : "bg-[#3B46A5] text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {showCreate && canWrite ? (
        <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted-foreground">Tipo de lista</span>
            <select
              className={fieldClass}
              value={createListKind}
              onChange={(e) => setCreateListKind(e.target.value as ListKind)}
            >
              {LIST_KINDS.map((kind) => (
                <option key={kind.id} value={kind.id}>
                  {kind.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-muted-foreground">
              {createListKind === "funcionamiento"
                ? "Se llena en el apartado Pruebas de funcionamiento de la orden (Pasa / No pasa / No aplica)."
                : "Se llena en Diagnóstico como checklist de verificación (Bien / Dañado / No tiene)."}
            </span>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted-foreground">Nombre</span>
            <input
              className={fieldClass}
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder={
                createListKind === "funcionamiento"
                  ? "Ej. Pruebas de ventilador"
                  : "Ej. Revisión de ventilador"
              }
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">
              Tipo de equipo
            </span>
            <select
              className={fieldClass}
              value={createKind}
              onChange={(e) => setCreateKind(e.target.value as EquipmentKind)}
            >
              {EQUIPMENT_KINDS.map((kind) => (
                <option key={kind.id} value={kind.id}>
                  {kind.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted-foreground">
              Descripción (opcional)
            </span>
            <textarea
              className="min-h-16 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button
              type="button"
              disabled={saving || !createName.trim()}
              onClick={() => void createTemplate()}
            >
              Crear plantilla
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCreate(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {selected?.locked ? (
        <ReadOnlyBanner
          visible
          message={`Esta plantilla está cerrado por ${
            selected.lockedBy || "el asesor de servicios"
          }. Ya no se puede modificar.`}
        />
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando plantillas…</p>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No hay plantillas
          {kindFilter === "todas"
            ? " registradas"
            : kindFilter === "funcionamiento"
              ? " de pruebas de funcionamiento"
              : " de verificación"}
          . Usa «Nueva plantilla» para crear la primera.
        </p>
      ) : (
        <div className="space-y-2">
          {visible.map((tpl) => {
            const isOpen = openId === tpl.id;
            const isFunction = tpl.listKind === "funcionamiento";
            const Icon = isFunction ? Activity : ClipboardCheck;
            const canEditTpl = canWrite && !tpl.locked;
            return (
              <div
                key={tpl.id}
                className={cn(
                  "overflow-hidden rounded-2xl border bg-card shadow-sm",
                  isFunction
                    ? "border-teal-200 dark:border-teal-900"
                    : "border-border"
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : tpl.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      isFunction ? "text-teal-600" : "text-[#3B46A5]"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{tpl.name}</p>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          isFunction
                            ? "bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-200"
                            : "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200"
                        )}
                      >
                        {listKindLabel(tpl.listKind)}
                      </span>
                      {tpl.locked ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                          <Lock className="size-2.5" /> Cerrado
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {equipmentKindLabel(tpl.equipmentKind)} · {tpl.code} ·{" "}
                      {tpl.points.length} puntos
                      {!tpl.isActive ? " · Inactiva" : ""}
                    </p>
                  </div>
                  <ChevronDown
                    className={cn(
                      "size-4 text-muted-foreground transition-transform",
                      isOpen ? "rotate-180" : "rotate-0"
                    )}
                  />
                </button>

                {isOpen ? (
                  <div className="space-y-3 border-t border-border px-4 py-4">
                    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900 dark:bg-amber-950/20">
                      <div className="flex items-start gap-2">
                        {tpl.locked ? (
                          <Lock className="mt-0.5 size-4 shrink-0 text-amber-800 dark:text-amber-200" />
                        ) : (
                          <LockOpen className="mt-0.5 size-4 shrink-0 text-amber-800 dark:text-amber-200" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
                            {tpl.locked ? "Cerrado" : "Candado del asesor"}
                          </p>
                          <p className="mt-0.5 text-xs text-amber-900/80 dark:text-amber-200/80">
                            {tpl.locked
                              ? `Cerrado por ${tpl.lockedBy || "asesor"}${
                                  tpl.lockedAt ? ` · ${tpl.lockedAt}` : ""
                                }. Nadie más puede editarla.`
                              : isAdvisor
                                ? "Al colocar el candado, la plantilla queda solo de consulta."
                                : "Solo el asesor de servicios puede candar esta plantilla."}
                          </p>
                          {isAdvisor ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant={tpl.locked ? "outline" : "default"}
                                disabled={saving}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void toggleLock(tpl);
                                }}
                              >
                                {tpl.locked ? (
                                  <>
                                    <LockOpen className="size-3.5" /> Quitar
                                    candado
                                  </>
                                ) : (
                                  <>
                                    <Lock className="size-3.5" /> Candar
                                    plantilla
                                  </>
                                )}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="border-destructive/40 text-destructive hover:bg-destructive/10"
                                disabled={saving}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void removeTemplate(tpl);
                                }}
                              >
                                <Trash2 className="size-3.5" /> Eliminar
                                plantilla
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {tpl.description ? (
                      <p className="text-sm text-muted-foreground">
                        {tpl.description}
                      </p>
                    ) : null}

                    {canWrite ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="block text-sm">
                          <span className="mb-1 block text-xs text-muted-foreground">
                            Nombre
                          </span>
                          <input
                            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                            defaultValue={tpl.name}
                            disabled={saving || !canEditTpl}
                            onBlur={(e) => {
                              const value = e.target.value.trim();
                              if (value && value !== tpl.name) {
                                void saveMeta({ name: value });
                              }
                            }}
                          />
                        </label>
                        <label className="flex items-end gap-2 pb-2 text-sm">
                          <input
                            type="checkbox"
                            checked={tpl.isActive}
                            disabled={saving || !canEditTpl}
                            onChange={(e) =>
                              void saveMeta({ isActive: e.target.checked })
                            }
                          />
                          Plantilla activa
                        </label>
                        <label className="block text-sm sm:col-span-2">
                          <span className="mb-1 block text-xs text-muted-foreground">
                            Descripción
                          </span>
                          <textarea
                            className="min-h-16 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                            defaultValue={tpl.description}
                            disabled={saving || !canEditTpl}
                            onBlur={(e) => {
                              const value = e.target.value.trim();
                              if (value !== tpl.description) {
                                void saveMeta({ description: value });
                              }
                            }}
                          />
                        </label>
                      </div>
                    ) : null}

                    {canEditTpl ? (
                      <p className="text-xs text-muted-foreground">
                        Usa el lápiz para editar un punto. El cambio aplica a la
                        plantilla; las órdenes ya abiertas conservan el texto
                        original.
                      </p>
                    ) : null}
                    <ol className="space-y-1.5">
                      {tpl.points.map((point, index) => {
                        const interval = formatValidInterval(
                          point.minValue,
                          point.maxValue,
                          point.unit
                        );
                        const isEditing = editingPointId === point.id;
                        return (
                        <li
                          key={point.id}
                          className="flex items-start justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        >
                          {isEditing ? (
                            <div className="min-w-0 flex-1 space-y-2">
                              <label className="block text-xs">
                                <span className="mb-1 block text-muted-foreground">
                                  {isFunction
                                    ? "Prueba de funcionamiento"
                                    : "Punto de verificación"}
                                </span>
                                <input
                                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                                  value={editLabel}
                                  autoFocus
                                  disabled={saving}
                                  onChange={(e) => setEditLabel(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      void saveEditedPoint(isFunction);
                                    }
                                    if (e.key === "Escape") {
                                      e.preventDefault();
                                      cancelEditPoint();
                                    }
                                  }}
                                />
                              </label>
                              {isFunction ? (
                                <div className="grid gap-2 sm:grid-cols-3">
                                  <label className="block text-[11px] text-muted-foreground">
                                    Mín
                                    <input
                                      className="mt-0.5 h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
                                      value={editMin}
                                      disabled={saving}
                                      onChange={(e) => setEditMin(e.target.value)}
                                    />
                                  </label>
                                  <label className="block text-[11px] text-muted-foreground">
                                    Máx
                                    <input
                                      className="mt-0.5 h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
                                      value={editMax}
                                      disabled={saving}
                                      onChange={(e) => setEditMax(e.target.value)}
                                    />
                                  </label>
                                  <label className="block text-[11px] text-muted-foreground">
                                    Unidad
                                    <input
                                      className="mt-0.5 h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
                                      value={editUnit}
                                      disabled={saving}
                                      onChange={(e) => setEditUnit(e.target.value)}
                                    />
                                  </label>
                                </div>
                              ) : null}
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={saving || !editLabel.trim()}
                                  onClick={() => void saveEditedPoint(isFunction)}
                                >
                                  <Check className="size-3.5" /> Guardar
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={saving}
                                  onClick={cancelEditPoint}
                                >
                                  <X className="size-3.5" /> Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                          <div className="min-w-0 flex-1">
                            <p>
                              <span className="mr-2 text-xs text-muted-foreground">
                                {index + 1}.
                              </span>
                              {point.label}
                            </p>
                            {isFunction && interval ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Intervalo válido: {interval}
                              </p>
                            ) : isFunction ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Sin intervalo · pasa / no pasa
                              </p>
                            ) : null}
                          </div>
                          {canEditTpl ? (
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                onClick={() => startEditPoint(point)}
                                aria-label={`Editar ${point.label}`}
                              >
                                <Pencil className="size-3.5" />
                              </button>
                            <button
                              type="button"
                              className="rounded-md p-1 text-destructive hover:bg-destructive/10"
                              onClick={() => void removePoint(point.id)}
                              aria-label={`Eliminar ${point.label}`}
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                            </div>
                          ) : null}
                            </>
                          )}
                        </li>
                        );
                      })}
                    </ol>

                    {canEditTpl ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <input
                            className="h-10 min-w-[220px] flex-1 rounded-lg border border-input bg-background px-3 text-sm"
                            placeholder={
                              isFunction
                                ? "Nueva prueba de funcionamiento…"
                                : "Nuevo punto de verificación…"
                            }
                            value={openId === tpl.id ? newPoint : ""}
                            onChange={(e) => setNewPoint(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void addPoint();
                              }
                            }}
                          />
                          <Button
                            type="button"
                            disabled={saving || !newPoint.trim()}
                            onClick={() => void addPoint()}
                          >
                            <Plus className="size-4" /> Agregar punto
                          </Button>
                        </div>
                        {isFunction ? (
                          <div className="grid gap-2 sm:grid-cols-3">
                            <label className="block text-xs">
                              <span className="mb-1 block text-muted-foreground">
                                Mínimo válido
                              </span>
                              <input
                                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                                inputMode="decimal"
                                placeholder="Ej. 90"
                                value={openId === tpl.id ? newPointMin : ""}
                                onChange={(e) => setNewPointMin(e.target.value)}
                              />
                            </label>
                            <label className="block text-xs">
                              <span className="mb-1 block text-muted-foreground">
                                Máximo válido
                              </span>
                              <input
                                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                                inputMode="decimal"
                                placeholder="Ej. 140"
                                value={openId === tpl.id ? newPointMax : ""}
                                onChange={(e) => setNewPointMax(e.target.value)}
                              />
                            </label>
                            <label className="block text-xs">
                              <span className="mb-1 block text-muted-foreground">
                                Unidad
                              </span>
                              <input
                                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                                placeholder="mmHg, %, lpm…"
                                value={openId === tpl.id ? newPointUnit : ""}
                                onChange={(e) => setNewPointUnit(e.target.value)}
                              />
                            </label>
                            <p className="text-xs text-muted-foreground sm:col-span-3">
                              El intervalo se muestra al técnico al llenar la orden.
                              Deja vacío si la prueba es solo pasa / no pasa.
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
