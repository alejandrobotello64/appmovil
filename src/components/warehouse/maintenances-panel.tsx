"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  DesktopTable,
  ResponsiveDataList,
} from "@/components/ui/responsive-data-list";
import { getSession } from "@/lib/auth";
import { getInventoryItems } from "@/lib/inventory/storage";
import type { InventoryItem } from "@/lib/inventory/types";
import {
  completeMaintenance,
  createMaintenance,
  getMaintenances,
  type EquipmentMaintenance,
  type MaintenanceType,
} from "@/lib/warehouse/maintenances";

export function MaintenancesPanel() {
  const [items, setItems] = useState<EquipmentMaintenance[]>([]);
  const [equipment, setEquipment] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [equipmentId, setEquipmentId] = useState("");
  const [maintenanceType, setMaintenanceType] =
    useState<MaintenanceType>("preventivo");
  const [scheduledDate, setScheduledDate] = useState("");
  const [technician, setTechnician] = useState("");
  const [cost, setCost] = useState(0);
  const [notes, setNotes] = useState("");

  async function refresh() {
    const [list, assets] = await Promise.all([
      getMaintenances(),
      getInventoryItems({ kind: "equipo" }),
    ]);
    setItems(list);
    setEquipment(assets);
    if (assets[0]) setEquipmentId(assets[0].id);
  }

  useEffect(() => {
    void refresh()
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "No se pudo cargar mantenimientos"
        )
      )
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const session = getSession();
      await createMaintenance({
        equipmentId,
        maintenanceType,
        status: "programado",
        scheduledDate,
        technician,
        cost,
        notes,
        createdBy: session?.username ?? "",
      });
      setFormOpen(false);
      setNotes("");
      setTechnician("");
      setCost(0);
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo programar el mantenimiento"
      );
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">Cargando mantenimientos...</p>
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Mantenimientos de equipo</h2>
            <p className="text-sm text-muted-foreground">
              Solo aplica a equipos médicos (activos), no a insumos ni medicamentos.
            </p>
          </div>
          <Button
            onClick={() => setFormOpen(true)}
            className="border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white hover:opacity-90"
          >
            Programar mantenimiento
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <ResponsiveDataList
          emptyMessage="No hay mantenimientos programados."
          items={items.map((item) => {
            const asset = equipment.find((entry) => entry.id === item.equipmentId);
            return {
              key: item.id,
              title: asset?.name ?? "Equipo",
              subtitle: asset?.serialNumber || "Sin serie",
              badge: (
                <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs capitalize">
                  {item.status.replace("_", " ")}
                </span>
              ),
              fields: [
                { label: "Tipo", value: item.maintenanceType },
                { label: "Fecha", value: item.scheduledDate },
                { label: "Técnico", value: item.technician || "—" },
              ],
              actions:
                item.status !== "completado" && item.status !== "cancelado" ? (
                  <Button
                    size="sm"
                    className="h-9"
                    onClick={() =>
                      void completeMaintenance(item.id)
                        .then(refresh)
                        .catch((err) =>
                          setError(
                            err instanceof Error
                              ? err.message
                              : "No se pudo completar"
                          )
                        )
                    }
                  >
                    Completar
                  </Button>
                ) : undefined,
            };
          })}
        />

        <DesktopTable>
          <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Equipo</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Técnico</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  No hay mantenimientos programados.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const asset = equipment.find(
                  (entry) => entry.id === item.equipmentId
                );
                return (
                  <tr key={item.id} className="border-t border-border/70">
                    <td className="px-4 py-3">
                      {asset?.name ?? "Equipo"}
                      <p className="text-xs text-muted-foreground">
                        {asset?.serialNumber || "Sin serie"}
                      </p>
                    </td>
                    <td className="px-4 py-3 capitalize">
                      {item.maintenanceType}
                    </td>
                    <td className="px-4 py-3">{item.scheduledDate}</td>
                    <td className="px-4 py-3">{item.technician || "—"}</td>
                    <td className="px-4 py-3 capitalize">
                      {item.status.replace("_", " ")}
                    </td>
                    <td className="px-4 py-3">
                      {item.status !== "completado" &&
                      item.status !== "cancelado" ? (
                        <Button
                          size="sm"
                          onClick={() =>
                            void completeMaintenance(item.id)
                              .then(refresh)
                              .catch((err) =>
                                setError(
                                  err instanceof Error
                                    ? err.message
                                    : "No se pudo completar"
                                )
                              )
                          }
                        >
                          Completar
                        </Button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </DesktopTable>
      </section>

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl"
          >
            <h3 className="text-lg font-semibold">Programar mantenimiento</h3>
            <div className="mt-4 grid gap-3">
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Equipo</span>
                <select
                  required
                  value={equipmentId}
                  onChange={(event) => setEquipmentId(event.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  {equipment.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.serialNumber || "S/N"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Tipo</span>
                <select
                  value={maintenanceType}
                  onChange={(event) =>
                    setMaintenanceType(event.target.value as MaintenanceType)
                  }
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="preventivo">Preventivo</option>
                  <option value="correctivo">Correctivo</option>
                  <option value="calibracion">Calibración</option>
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Fecha programada</span>
                <input
                  required
                  type="date"
                  value={scheduledDate}
                  onChange={(event) => setScheduledDate(event.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Técnico</span>
                <input
                  value={technician}
                  onChange={(event) => setTechnician(event.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Costo estimado</span>
                <input
                  type="number"
                  min={0}
                  value={cost}
                  onChange={(event) => setCost(Number(event.target.value))}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium">Notas</span>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
              >
                Guardar
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
