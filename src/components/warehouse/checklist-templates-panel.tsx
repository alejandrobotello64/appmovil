"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ListChecks, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReadOnlyBanner } from "@/components/warehouse/read-only-banner";
import { usePermissions } from "@/lib/auth/use-permissions";
import {
  addChecklistTemplatePoint,
  createChecklistTemplate,
  deleteChecklistTemplatePoint,
  getChecklistTemplates,
  updateChecklistTemplateMeta,
} from "@/lib/service-orders/storage";
import {
  EQUIPMENT_KINDS,
  equipmentKindLabel,
  type ChecklistTemplate,
  type EquipmentKind,
} from "@/lib/service-orders/types";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none";

export function ChecklistTemplatesPanel() {
  const { canWrite } = usePermissions("ordenes_servicio");
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [newPoint, setNewPoint] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createKind, setCreateKind] = useState<EquipmentKind>("general");
  const [createDescription, setCreateDescription] = useState("");

  async function reload() {
    setLoading(true);
    setError("");
    try {
      const list = await getChecklistTemplates({ includeInactive: true });
      setTemplates(list);
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

  const selected = templates.find((t) => t.id === openId) ?? null;

  async function saveMeta(patch: {
    name?: string;
    description?: string;
    isActive?: boolean;
  }) {
    if (!selected || !canWrite) return;
    try {
      setSaving(true);
      setError("");
      await updateChecklistTemplateMeta(selected.id, patch);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function addPoint() {
    if (!selected || !canWrite || !newPoint.trim()) return;
    try {
      setSaving(true);
      setError("");
      await addChecklistTemplatePoint(selected.id, newPoint.trim());
      setNewPoint("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar el punto.");
    } finally {
      setSaving(false);
    }
  }

  async function removePoint(pointId: string) {
    if (!canWrite) return;
    if (!window.confirm("¿Eliminar este punto de la plantilla?")) return;
    try {
      setSaving(true);
      setError("");
      await deleteChecklistTemplatePoint(pointId);
      await reload();
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
        description: createDescription.trim(),
      });
      setCreateName("");
      setCreateDescription("");
      setCreateKind("general");
      setShowCreate(false);
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

  return (
    <section className="space-y-4">
      {!canWrite ? <ReadOnlyBanner visible /> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#3B46A5]">
            Plantillas de checklist
          </h2>
          <p className="text-sm text-muted-foreground">
            Crea y edita puntos de revisión por tipo de equipo. Se aplican al
            diagnosticar una orden de servicio.
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

      {showCreate && canWrite ? (
        <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted-foreground">Nombre</span>
            <input
              className={fieldClass}
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Ej. Revisión de ventilador"
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

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando plantillas…</p>
      ) : templates.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No hay plantillas registradas. Usa «Nueva plantilla» para crear la
          primera.
        </p>
      ) : (
        <div className="space-y-2">
          {templates.map((tpl) => {
            const isOpen = openId === tpl.id;
            return (
              <div
                key={tpl.id}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : tpl.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
                >
                  <ListChecks className="size-4 shrink-0 text-[#3B46A5]" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{tpl.name}</p>
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
                            disabled={saving}
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
                            disabled={saving}
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
                            disabled={saving}
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

                    <ol className="space-y-1.5">
                      {tpl.points.map((point, index) => (
                        <li
                          key={point.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        >
                          <span>
                            <span className="mr-2 text-xs text-muted-foreground">
                              {index + 1}.
                            </span>
                            {point.label}
                          </span>
                          {canWrite ? (
                            <button
                              type="button"
                              className="text-destructive hover:underline"
                              onClick={() => void removePoint(point.id)}
                              aria-label={`Eliminar ${point.label}`}
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ol>

                    {canWrite ? (
                      <div className="flex flex-wrap gap-2">
                        <input
                          className="h-10 min-w-[220px] flex-1 rounded-lg border border-input bg-background px-3 text-sm"
                          placeholder="Nuevo punto de revisión…"
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
