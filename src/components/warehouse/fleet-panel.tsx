"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Car,
  FileDown,
  Plus,
  Search,
  Trash2,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReadOnlyBanner } from "@/components/warehouse/read-only-banner";
import { getSession } from "@/lib/auth";
import { usePermissions } from "@/lib/auth/use-permissions";
import { downloadVehicleServicePdf } from "@/lib/fleet/pdf";
import {
  addVehicleServiceNote,
  createCompanyVehicle,
  createVehicleService,
  deleteCompanyVehicle,
  deleteVehicleService,
  getCompanyVehicles,
  getVehicleServices,
  setVehicleServiceStatus,
  updateCompanyVehicle,
  updateVehicleService,
} from "@/lib/fleet/storage";
import {
  FUEL_TYPES,
  VEHICLE_SERVICE_STATUSES,
  VEHICLE_SERVICE_TYPES,
  VEHICLE_STATUSES,
  VEHICLE_TYPES,
  buildVehicleAlerts,
  computeServiceTotal,
  vehicleServiceStatusLabel,
  vehicleServiceTypeLabel,
  vehicleStatusLabel,
  vehicleTypeLabel,
  type CompanyVehicle,
  type CompanyVehicleInput,
  type FleetAlert,
  type FuelType,
  type VehicleService,
  type VehicleServiceInput,
  type VehicleServiceLineInput,
  type VehicleServiceStatus,
  type VehicleServiceType,
  type VehicleStatus,
  type VehicleType,
} from "@/lib/fleet/types";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none";

type MainTab = "monitoreo" | "vehiculos" | "servicios";

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function emptyVehicle(): CompanyVehicleInput {
  return {
    plate: "",
    brand: "",
    model: "",
    year: new Date().getFullYear(),
    color: "",
    vin: "",
    vehicleType: "utilitario",
    status: "activo",
    odometerKm: 0,
    fuelType: "gasolina",
    assignedTo: "",
    insurancePolicy: "",
    insuranceExpires: "",
    verificationExpires: "",
    nextServiceKm: null,
    nextServiceDate: "",
    notes: "",
    isActive: true,
  };
}

function emptyService(vehicleId = ""): VehicleServiceInput {
  return {
    vehicleId,
    serviceType: "preventivo",
    status: "programado",
    priority: "normal",
    title: "",
    description: "",
    workshop: "",
    technician: "",
    requestedBy: "",
    odometerKm: null,
    scheduledAt: new Date().toISOString().slice(0, 10),
    startedAt: "",
    completedAt: "",
    nextServiceKm: null,
    nextServiceDate: "",
    laborCost: 0,
    partsCost: 0,
    otherCost: 0,
    invoiceFolio: "",
    notes: "",
    lines: [],
  };
}

function statusTone(status: VehicleServiceStatus) {
  switch (status) {
    case "completado":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
    case "en_proceso":
      return "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200";
    case "programado":
      return "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
    case "cancelado":
      return "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function FleetPanel() {
  const { canWrite } = usePermissions("flotilla");
  const [tab, setTab] = useState<MainTab>("monitoreo");
  const [vehicles, setVehicles] = useState<CompanyVehicle[]>([]);
  const [services, setServices] = useState<VehicleService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [serviceFilter, setServiceFilter] = useState<
    VehicleServiceStatus | "todos"
  >("todos");

  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [vehicleForm, setVehicleForm] = useState<CompanyVehicleInput>(emptyVehicle());

  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceForm, setServiceForm] = useState<VehicleServiceInput>(emptyService());
  const [draftLines, setDraftLines] = useState<
    (VehicleServiceLineInput & { key: string })[]
  >([]);
  const [note, setNote] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  const actor = getSession()?.username ?? "usuario";

  async function reload() {
    setLoading(true);
    setError("");
    try {
      const [v, s] = await Promise.all([
        getCompanyVehicles(),
        getVehicleServices(),
      ]);
      setVehicles(v);
      setServices(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar flotilla.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const alerts = useMemo(() => {
    const list: FleetAlert[] = [];
    for (const vehicle of vehicles) {
      if (!vehicle.isActive || vehicle.status === "baja") continue;
      list.push(...buildVehicleAlerts(vehicle));
    }
    return list.sort((a, b) => {
      const rank = { overdue: 0, soon: 1, ok: 2 } as const;
      return rank[a.severity] - rank[b.severity];
    });
  }, [vehicles]);

  const openServices = useMemo(
    () =>
      services.filter(
        (s) => s.status === "programado" || s.status === "en_proceso"
      ),
    [services]
  );

  const filteredVehicles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((v) =>
      [v.code, v.plate, v.brand, v.model, v.assignedTo]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [vehicles, query]);

  const filteredServices = useMemo(() => {
    const q = query.trim().toLowerCase();
    return services.filter((s) => {
      if (serviceFilter !== "todos" && s.status !== serviceFilter) return false;
      if (!q) return true;
      return [s.folio, s.vehiclePlate, s.vehicleLabel, s.title, s.workshop]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [services, query, serviceFilter]);

  const selectedService = useMemo(
    () => services.find((s) => s.id === selectedServiceId) ?? null,
    [services, selectedServiceId]
  );

  const serviceTotal = useMemo(
    () =>
      computeServiceTotal(
        serviceForm.laborCost,
        serviceForm.partsCost,
        serviceForm.otherCost,
        draftLines
      ),
    [serviceForm.laborCost, serviceForm.partsCost, serviceForm.otherCost, draftLines]
  );

  function openNewVehicle() {
    setEditingVehicleId(null);
    setVehicleForm(emptyVehicle());
    setShowVehicleForm(true);
  }

  function openEditVehicle(vehicle: CompanyVehicle) {
    setEditingVehicleId(vehicle.id);
    setVehicleForm({
      code: vehicle.code,
      plate: vehicle.plate,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      color: vehicle.color,
      vin: vehicle.vin,
      vehicleType: vehicle.vehicleType,
      status: vehicle.status,
      odometerKm: vehicle.odometerKm,
      fuelType: vehicle.fuelType,
      assignedTo: vehicle.assignedTo,
      insurancePolicy: vehicle.insurancePolicy,
      insuranceExpires: vehicle.insuranceExpires,
      verificationExpires: vehicle.verificationExpires,
      nextServiceKm: vehicle.nextServiceKm,
      nextServiceDate: vehicle.nextServiceDate,
      notes: vehicle.notes,
      isActive: vehicle.isActive,
    });
    setShowVehicleForm(true);
  }

  async function saveVehicle(e: FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    try {
      setError("");
      if (editingVehicleId) {
        await updateCompanyVehicle(editingVehicleId, {
          ...vehicleForm,
          createdBy: actor,
        });
      } else {
        await createCompanyVehicle({ ...vehicleForm, createdBy: actor });
      }
      setShowVehicleForm(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el vehículo.");
    }
  }

  async function removeVehicle(id: string) {
    if (!canWrite) return;
    if (!confirm("¿Eliminar este vehículo y su historial de servicios?")) return;
    try {
      await deleteCompanyVehicle(id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  }

  function openNewService(vehicleId?: string) {
    setEditingServiceId(null);
    setSelectedServiceId(null);
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    setServiceForm({
      ...emptyService(vehicleId ?? ""),
      odometerKm: vehicle?.odometerKm ?? null,
    });
    setDraftLines([]);
    setShowServiceForm(true);
  }

  function openEditService(service: VehicleService) {
    setEditingServiceId(service.id);
    setSelectedServiceId(service.id);
    setServiceForm({
      vehicleId: service.vehicleId,
      serviceType: service.serviceType,
      status: service.status,
      priority: service.priority,
      title: service.title,
      description: service.description,
      workshop: service.workshop,
      technician: service.technician,
      requestedBy: service.requestedBy,
      odometerKm: service.odometerKm,
      scheduledAt: service.scheduledAt,
      startedAt: service.startedAt,
      completedAt: service.completedAt,
      nextServiceKm: service.nextServiceKm,
      nextServiceDate: service.nextServiceDate,
      laborCost: service.laborCost,
      partsCost: service.partsCost,
      otherCost: service.otherCost,
      invoiceFolio: service.invoiceFolio,
      notes: service.notes,
    });
    setDraftLines(
      service.lines.map((l) => ({
        key: l.id,
        description: l.description,
        quantity: l.quantity,
        unitCost: l.unitCost,
      }))
    );
    setShowServiceForm(true);
  }

  async function saveService(e: FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    try {
      setError("");
      const payload: VehicleServiceInput = {
        ...serviceForm,
        createdBy: actor,
        lines: draftLines.filter((l) => l.description.trim()),
      };
      if (editingServiceId) {
        await updateVehicleService(editingServiceId, payload);
      } else {
        await createVehicleService(payload);
      }
      setShowServiceForm(false);
      setSelectedServiceId(null);
      await reload();
      setTab("servicios");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el servicio.");
    }
  }

  async function changeServiceStatus(id: string, status: VehicleServiceStatus) {
    if (!canWrite) return;
    try {
      await setVehicleServiceStatus(id, status, actor);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar estatus.");
    }
  }

  async function sendNote() {
    if (!selectedService || !canWrite || !note.trim()) return;
    try {
      await addVehicleServiceNote(selectedService.id, note, actor);
      setNote("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la nota.");
    }
  }

  const tabs: { id: MainTab; label: string }[] = [
    { id: "monitoreo", label: "Monitoreo" },
    { id: "vehiculos", label: `Vehículos (${vehicles.length})` },
    { id: "servicios", label: `Servicios (${services.length})` },
  ];

  return (
    <section className="space-y-4">
      <ReadOnlyBanner visible={!canWrite} />
      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Flotilla empresarial</h2>
          <p className="text-sm text-muted-foreground">
            Monitoreo de servicios, km, seguros y verificaciones
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!canWrite}
            variant="outline"
            onClick={openNewVehicle}
          >
            <Car className="size-4" /> Vehículo
          </Button>
          <Button
            type="button"
            disabled={!canWrite || vehicles.length === 0}
            className="bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
            onClick={() => openNewService()}
          >
            <Plus className="size-4" /> Servicio
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border pb-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTab(item.id);
              setShowVehicleForm(false);
              setShowServiceForm(false);
              setSelectedServiceId(null);
            }}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm transition-colors",
              tab === item.id
                ? "bg-[linear-gradient(135deg,rgba(0,191,255,0.18),rgba(59,70,165,0.22))] font-medium"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          className={cn(fieldClass, "pl-9")}
          placeholder="Buscar placa, folio, marca, responsable…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {showVehicleForm ? (
        <form
          onSubmit={saveVehicle}
          className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2"
        >
          <h3 className="text-sm font-semibold sm:col-span-2">
            {editingVehicleId ? "Editar vehículo" : "Nuevo vehículo"}
          </h3>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Placa *</span>
            <input
              required
              className={fieldClass}
              value={vehicleForm.plate}
              onChange={(e) =>
                setVehicleForm((f) => ({ ...f, plate: e.target.value }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Tipo</span>
            <select
              className={fieldClass}
              value={vehicleForm.vehicleType}
              onChange={(e) =>
                setVehicleForm((f) => ({
                  ...f,
                  vehicleType: e.target.value as VehicleType,
                }))
              }
            >
              {VEHICLE_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Marca</span>
            <input
              className={fieldClass}
              value={vehicleForm.brand ?? ""}
              onChange={(e) =>
                setVehicleForm((f) => ({ ...f, brand: e.target.value }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Modelo</span>
            <input
              className={fieldClass}
              value={vehicleForm.model ?? ""}
              onChange={(e) =>
                setVehicleForm((f) => ({ ...f, model: e.target.value }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Año</span>
            <input
              type="number"
              className={fieldClass}
              value={vehicleForm.year ?? ""}
              onChange={(e) =>
                setVehicleForm((f) => ({
                  ...f,
                  year: e.target.value ? Number(e.target.value) : null,
                }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Color</span>
            <input
              className={fieldClass}
              value={vehicleForm.color ?? ""}
              onChange={(e) =>
                setVehicleForm((f) => ({ ...f, color: e.target.value }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Odómetro (km)</span>
            <input
              type="number"
              min={0}
              step="any"
              className={fieldClass}
              value={vehicleForm.odometerKm ?? 0}
              onChange={(e) =>
                setVehicleForm((f) => ({
                  ...f,
                  odometerKm: Number(e.target.value),
                }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Combustible</span>
            <select
              className={fieldClass}
              value={vehicleForm.fuelType}
              onChange={(e) =>
                setVehicleForm((f) => ({
                  ...f,
                  fuelType: e.target.value as FuelType,
                }))
              }
            >
              {FUEL_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Asignado a</span>
            <input
              className={fieldClass}
              value={vehicleForm.assignedTo ?? ""}
              onChange={(e) =>
                setVehicleForm((f) => ({ ...f, assignedTo: e.target.value }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Estatus</span>
            <select
              className={fieldClass}
              value={vehicleForm.status}
              onChange={(e) =>
                setVehicleForm((f) => ({
                  ...f,
                  status: e.target.value as VehicleStatus,
                }))
              }
            >
              {VEHICLE_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Próximo servicio (km)</span>
            <input
              type="number"
              min={0}
              className={fieldClass}
              value={vehicleForm.nextServiceKm ?? ""}
              onChange={(e) =>
                setVehicleForm((f) => ({
                  ...f,
                  nextServiceKm: e.target.value ? Number(e.target.value) : null,
                }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Próximo servicio (fecha)</span>
            <input
              type="date"
              className={fieldClass}
              value={vehicleForm.nextServiceDate ?? ""}
              onChange={(e) =>
                setVehicleForm((f) => ({
                  ...f,
                  nextServiceDate: e.target.value,
                }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Póliza seguro</span>
            <input
              className={fieldClass}
              value={vehicleForm.insurancePolicy ?? ""}
              onChange={(e) =>
                setVehicleForm((f) => ({
                  ...f,
                  insurancePolicy: e.target.value,
                }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Vence seguro</span>
            <input
              type="date"
              className={fieldClass}
              value={vehicleForm.insuranceExpires ?? ""}
              onChange={(e) =>
                setVehicleForm((f) => ({
                  ...f,
                  insuranceExpires: e.target.value,
                }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Vence verificación</span>
            <input
              type="date"
              className={fieldClass}
              value={vehicleForm.verificationExpires ?? ""}
              onChange={(e) =>
                setVehicleForm((f) => ({
                  ...f,
                  verificationExpires: e.target.value,
                }))
              }
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted-foreground">Notas</span>
            <textarea
              className="min-h-16 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              value={vehicleForm.notes ?? ""}
              onChange={(e) =>
                setVehicleForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowVehicleForm(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
            >
              Guardar
            </Button>
          </div>
        </form>
      ) : null}

      {showServiceForm ? (
        <form
          onSubmit={saveService}
          className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2"
        >
          <h3 className="text-sm font-semibold sm:col-span-2">
            {editingServiceId ? "Editar servicio" : "Nuevo servicio"}
          </h3>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted-foreground">Vehículo *</span>
            <select
              required
              className={fieldClass}
              value={serviceForm.vehicleId}
              onChange={(e) => {
                const vehicle = vehicles.find((v) => v.id === e.target.value);
                setServiceForm((f) => ({
                  ...f,
                  vehicleId: e.target.value,
                  odometerKm: vehicle?.odometerKm ?? f.odometerKm,
                }));
              }}
            >
              <option value="">Seleccionar…</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate} · {v.brand} {v.model}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Tipo</span>
            <select
              className={fieldClass}
              value={serviceForm.serviceType}
              onChange={(e) =>
                setServiceForm((f) => ({
                  ...f,
                  serviceType: e.target.value as VehicleServiceType,
                }))
              }
            >
              {VEHICLE_SERVICE_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Estatus</span>
            <select
              className={fieldClass}
              value={serviceForm.status}
              onChange={(e) =>
                setServiceForm((f) => ({
                  ...f,
                  status: e.target.value as VehicleServiceStatus,
                }))
              }
            >
              {VEHICLE_SERVICE_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted-foreground">Título</span>
            <input
              className={fieldClass}
              value={serviceForm.title ?? ""}
              onChange={(e) =>
                setServiceForm((f) => ({ ...f, title: e.target.value }))
              }
              placeholder="Ej. Servicio 40,000 km"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted-foreground">Descripción</span>
            <textarea
              className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              value={serviceForm.description ?? ""}
              onChange={(e) =>
                setServiceForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Taller</span>
            <input
              className={fieldClass}
              value={serviceForm.workshop ?? ""}
              onChange={(e) =>
                setServiceForm((f) => ({ ...f, workshop: e.target.value }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Técnico</span>
            <input
              className={fieldClass}
              value={serviceForm.technician ?? ""}
              onChange={(e) =>
                setServiceForm((f) => ({ ...f, technician: e.target.value }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Odómetro al servicio</span>
            <input
              type="number"
              min={0}
              className={fieldClass}
              value={serviceForm.odometerKm ?? ""}
              onChange={(e) =>
                setServiceForm((f) => ({
                  ...f,
                  odometerKm: e.target.value ? Number(e.target.value) : null,
                }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Programado</span>
            <input
              type="date"
              className={fieldClass}
              value={serviceForm.scheduledAt ?? ""}
              onChange={(e) =>
                setServiceForm((f) => ({ ...f, scheduledAt: e.target.value }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Próximo servicio km</span>
            <input
              type="number"
              className={fieldClass}
              value={serviceForm.nextServiceKm ?? ""}
              onChange={(e) =>
                setServiceForm((f) => ({
                  ...f,
                  nextServiceKm: e.target.value ? Number(e.target.value) : null,
                }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Próximo servicio fecha</span>
            <input
              type="date"
              className={fieldClass}
              value={serviceForm.nextServiceDate ?? ""}
              onChange={(e) =>
                setServiceForm((f) => ({
                  ...f,
                  nextServiceDate: e.target.value,
                }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Mano de obra</span>
            <input
              type="number"
              min={0}
              step="any"
              className={fieldClass}
              value={serviceForm.laborCost ?? 0}
              onChange={(e) =>
                setServiceForm((f) => ({
                  ...f,
                  laborCost: Number(e.target.value),
                }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Refacciones</span>
            <input
              type="number"
              min={0}
              step="any"
              className={fieldClass}
              value={serviceForm.partsCost ?? 0}
              onChange={(e) =>
                setServiceForm((f) => ({
                  ...f,
                  partsCost: Number(e.target.value),
                }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Otros costos</span>
            <input
              type="number"
              min={0}
              step="any"
              className={fieldClass}
              value={serviceForm.otherCost ?? 0}
              onChange={(e) =>
                setServiceForm((f) => ({
                  ...f,
                  otherCost: Number(e.target.value),
                }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Prioridad</span>
            <select
              className={fieldClass}
              value={serviceForm.priority}
              onChange={(e) =>
                setServiceForm((f) => ({
                  ...f,
                  priority: e.target.value as "normal" | "urgente",
                }))
              }
            >
              <option value="normal">Normal</option>
              <option value="urgente">Urgente</option>
            </select>
          </label>

          <div className="space-y-2 sm:col-span-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Conceptos / refacciones</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setDraftLines((rows) => [
                    ...rows,
                    {
                      key: crypto.randomUUID(),
                      description: "",
                      quantity: 1,
                      unitCost: 0,
                    },
                  ])
                }
              >
                <Plus className="size-3.5" /> Línea
              </Button>
            </div>
            {draftLines.map((line) => (
              <div key={line.key} className="grid gap-2 sm:grid-cols-[1fr_90px_110px_36px]">
                <input
                  className={fieldClass}
                  placeholder="Descripción"
                  value={line.description}
                  onChange={(e) =>
                    setDraftLines((rows) =>
                      rows.map((r) =>
                        r.key === line.key
                          ? { ...r, description: e.target.value }
                          : r
                      )
                    )
                  }
                />
                <input
                  type="number"
                  min={0.01}
                  className={fieldClass}
                  value={line.quantity}
                  onChange={(e) =>
                    setDraftLines((rows) =>
                      rows.map((r) =>
                        r.key === line.key
                          ? { ...r, quantity: Number(e.target.value) }
                          : r
                      )
                    )
                  }
                />
                <input
                  type="number"
                  min={0}
                  className={fieldClass}
                  value={line.unitCost}
                  onChange={(e) =>
                    setDraftLines((rows) =>
                      rows.map((r) =>
                        r.key === line.key
                          ? { ...r, unitCost: Number(e.target.value) }
                          : r
                      )
                    )
                  }
                />
                <button
                  type="button"
                  className="text-destructive"
                  onClick={() =>
                    setDraftLines((rows) => rows.filter((r) => r.key !== line.key))
                  }
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            <p className="text-right text-sm font-medium">
              Total estimado: {money(serviceTotal)}
            </p>
          </div>

          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted-foreground">Notas</span>
            <textarea
              className="min-h-16 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              value={serviceForm.notes ?? ""}
              onChange={(e) =>
                setServiceForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowServiceForm(false);
                setSelectedServiceId(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
            >
              Guardar servicio
            </Button>
          </div>
        </form>
      ) : null}

      {tab === "monitoreo" && !showVehicleForm && !showServiceForm ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs text-muted-foreground">Vehículos activos</p>
              <p className="mt-1 text-2xl font-semibold">
                {vehicles.filter((v) => v.status === "activo").length}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs text-muted-foreground">En taller</p>
              <p className="mt-1 text-2xl font-semibold">
                {vehicles.filter((v) => v.status === "taller").length}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs text-muted-foreground">Servicios abiertos</p>
              <p className="mt-1 text-2xl font-semibold">{openServices.length}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs text-muted-foreground">Alertas</p>
              <p className="mt-1 text-2xl font-semibold">{alerts.length}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="size-4 text-amber-500" />
              Alertas de mantenimiento
            </h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sin alertas pendientes. La flotilla está al día.
              </p>
            ) : (
              <ul className="space-y-2">
                {alerts.map((alert, idx) => (
                  <li
                    key={`${alert.vehicleId}-${alert.kind}-${idx}`}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-sm",
                      alert.severity === "overdue"
                        ? "border-rose-300/50 bg-rose-500/10"
                        : "border-amber-300/50 bg-amber-500/10"
                    )}
                  >
                    <p className="font-medium">{alert.label}</p>
                    <p className="text-muted-foreground">{alert.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Wrench className="size-4" />
              Servicios en curso / programados
            </h3>
            {openServices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay servicios abiertos.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2">Folio</th>
                      <th className="px-2 py-2">Vehículo</th>
                      <th className="px-2 py-2">Tipo</th>
                      <th className="px-2 py-2">Estatus</th>
                      <th className="px-2 py-2">Fecha</th>
                      <th className="px-2 py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openServices.map((s) => (
                      <tr key={s.id} className="border-t border-border">
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            className="text-[#3B46A5] hover:underline"
                            onClick={() => {
                              setTab("servicios");
                              setSelectedServiceId(s.id);
                            }}
                          >
                            {s.folio}
                          </button>
                        </td>
                        <td className="px-2 py-2">
                          {s.vehiclePlate}
                          <span className="block text-xs text-muted-foreground">
                            {s.vehicleLabel}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          {vehicleServiceTypeLabel(s.serviceType)}
                        </td>
                        <td className="px-2 py-2">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-medium",
                              statusTone(s.status)
                            )}
                          >
                            {vehicleServiceStatusLabel(s.status)}
                          </span>
                        </td>
                        <td className="px-2 py-2">{s.scheduledAt || "—"}</td>
                        <td className="px-2 py-2">{money(s.totalCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {tab === "vehiculos" && !showVehicleForm ? (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-3">Código</th>
                <th className="px-3 py-3">Placa / unidad</th>
                <th className="px-3 py-3">Km</th>
                <th className="px-3 py-3">Asignado</th>
                <th className="px-3 py-3">Próximo servicio</th>
                <th className="px-3 py-3">Estatus</th>
                <th className="px-3 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    Cargando…
                  </td>
                </tr>
              ) : filteredVehicles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    No hay vehículos. Registra el primero.
                  </td>
                </tr>
              ) : (
                filteredVehicles.map((v) => (
                  <tr key={v.id} className="border-t border-border align-top">
                    <td className="px-3 py-3 text-xs">{v.code}</td>
                    <td className="px-3 py-3">
                      <p className="font-medium">{v.plate}</p>
                      <p className="text-xs text-muted-foreground">
                        {v.brand} {v.model} {v.year ? `· ${v.year}` : ""} ·{" "}
                        {vehicleTypeLabel(v.vehicleType)}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      {v.odometerKm.toLocaleString("es-MX")} km
                    </td>
                    <td className="px-3 py-3 text-xs">{v.assignedTo || "—"}</td>
                    <td className="px-3 py-3 text-xs">
                      {v.nextServiceKm != null
                        ? `${v.nextServiceKm.toLocaleString("es-MX")} km`
                        : "—"}
                      <span className="block text-muted-foreground">
                        {v.nextServiceDate || "Sin fecha"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {vehicleStatusLabel(v.status)}
                      </span>
                      {(v.openServicesCount ?? 0) > 0 ? (
                        <span className="mt-1 block text-[10px] text-amber-600">
                          {v.openServicesCount} abierto(s)
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2 text-xs">
                        <button
                          type="button"
                          className="text-[#3B46A5] hover:underline"
                          onClick={() => openEditVehicle(v)}
                        >
                          Editar
                        </button>
                        {canWrite ? (
                          <button
                            type="button"
                            className="text-[#3B46A5] hover:underline"
                            onClick={() => openNewService(v.id)}
                          >
                            + Servicio
                          </button>
                        ) : null}
                        {canWrite ? (
                          <button
                            type="button"
                            className="text-destructive hover:underline"
                            onClick={() => void removeVehicle(v.id)}
                          >
                            Eliminar
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "servicios" && !showServiceForm ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setServiceFilter("todos")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium",
                serviceFilter === "todos"
                  ? "bg-[#3B46A5] text-white"
                  : "bg-muted text-muted-foreground"
              )}
            >
              Todos ({services.length})
            </button>
            {VEHICLE_SERVICE_STATUSES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setServiceFilter(s.id)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  serviceFilter === s.id
                    ? "bg-[#3B46A5] text-white"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {s.label} ({services.filter((x) => x.status === s.id).length})
              </button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3">Folio</th>
                    <th className="px-3 py-3">Vehículo</th>
                    <th className="px-3 py-3">Tipo</th>
                    <th className="px-3 py-3">Estatus</th>
                    <th className="px-3 py-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-8 text-center text-muted-foreground"
                      >
                        Cargando…
                      </td>
                    </tr>
                  ) : filteredServices.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-8 text-center text-muted-foreground"
                      >
                        No hay servicios registrados.
                      </td>
                    </tr>
                  ) : (
                    filteredServices.map((s) => (
                      <tr
                        key={s.id}
                        className={cn(
                          "cursor-pointer border-t border-border align-top hover:bg-muted/30",
                          selectedServiceId === s.id && "bg-muted/40"
                        )}
                        onClick={() => setSelectedServiceId(s.id)}
                      >
                        <td className="px-3 py-3">
                          <p className="font-medium">{s.folio}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.scheduledAt || "Sin fecha"}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          {s.vehiclePlate}
                          <span className="block text-xs text-muted-foreground">
                            {s.vehicleLabel}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs">
                          {vehicleServiceTypeLabel(s.serviceType)}
                          {s.priority === "urgente" ? (
                            <span className="mt-1 block rounded bg-rose-600 px-1 text-[10px] text-white w-fit">
                              Urgente
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-medium",
                              statusTone(s.status)
                            )}
                          >
                            {vehicleServiceStatusLabel(s.status)}
                          </span>
                        </td>
                        <td className="px-3 py-3">{money(s.totalCost)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <aside className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              {!selectedService ? (
                <p className="text-sm text-muted-foreground">
                  Selecciona un servicio para ver el detalle, cambiar estatus o
                  descargar PDF.
                </p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Folio</p>
                    <p className="font-semibold">{selectedService.folio}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedService.vehiclePlate} · {selectedService.vehicleLabel}
                    </p>
                  </div>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Título: </span>
                    {selectedService.title ||
                      vehicleServiceTypeLabel(selectedService.serviceType)}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">
                    {selectedService.description || "Sin descripción"}
                  </p>
                  <p className="text-sm">
                    Taller: {selectedService.workshop || "—"}
                    <br />
                    Técnico: {selectedService.technician || "—"}
                    <br />
                    Km:{" "}
                    {selectedService.odometerKm != null
                      ? selectedService.odometerKm.toLocaleString("es-MX")
                      : "—"}
                    <br />
                    Total: {money(selectedService.totalCost)}
                  </p>
                  {canWrite ? (
                    <label className="block text-sm">
                      <span className="mb-1 block text-muted-foreground">
                        Cambiar estatus
                      </span>
                      <select
                        className={fieldClass}
                        value={selectedService.status}
                        onChange={(e) =>
                          void changeServiceStatus(
                            selectedService.id,
                            e.target.value as VehicleServiceStatus
                          )
                        }
                      >
                        {VEHICLE_SERVICE_STATUSES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => downloadVehicleServicePdf(selectedService)}
                    >
                      <FileDown className="size-4" /> PDF
                    </Button>
                    {canWrite ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openEditService(selectedService)}
                      >
                        Editar
                      </Button>
                    ) : null}
                    {canWrite ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        onClick={() => {
                          if (!confirm("¿Eliminar este servicio?")) return;
                          void deleteVehicleService(selectedService.id).then(
                            () => {
                              setSelectedServiceId(null);
                              return reload();
                            }
                          );
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                  {canWrite ? (
                    <div className="space-y-2 border-t border-border pt-3">
                      <textarea
                        className="min-h-16 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                        placeholder="Nota de seguimiento…"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                      />
                      <Button type="button" size="sm" onClick={() => void sendNote()}>
                        Agregar nota
                      </Button>
                    </div>
                  ) : null}
                  <ul className="max-h-48 space-y-2 overflow-y-auto border-t border-border pt-3">
                    {selectedService.events.map((ev) => (
                      <li key={ev.id} className="text-xs">
                        <span className="text-muted-foreground">
                          {new Date(ev.createdAt).toLocaleString("es-MX")} ·{" "}
                          {ev.createdBy || "sistema"}
                        </span>
                        <p>{ev.message}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          </div>
        </div>
      ) : null}
    </section>
  );
}
