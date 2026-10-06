"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReadOnlyBanner } from "@/components/warehouse/read-only-banner";
import { usePermissions } from "@/lib/auth/use-permissions";
import { getClientEquipment, getClients } from "@/lib/clients/storage";
import type { Client, ClientEquipment } from "@/lib/clients/types";
import {
  createServiceContract,
  deleteServiceContract,
  getServiceContracts,
  setContractEquipment,
  updateServiceContract,
} from "@/lib/contracts/storage";
import {
  contractLabel,
  type ServiceContract,
  type ServiceContractInput,
} from "@/lib/contracts/types";
import { getTenders } from "@/lib/tenders/storage";
import type { Tender } from "@/lib/tenders/types";
import { cn } from "@/lib/utils";
import { SortableTable } from "@/components/ui/sortable-table";

const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none";

const EMPTY_FORM: ServiceContractInput = {
  contractNumber: "",
  title: "",
  clientId: null,
  tenderId: null,
  startsOn: "",
  endsOn: "",
  notes: "",
  isActive: true,
};

export function ContractsPanel() {
  const { canWrite, canDelete } = usePermissions("licitaciones");
  const [contracts, setContracts] = useState<ServiceContract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [equipment, setEquipment] = useState<ClientEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [equipmentQuery, setEquipmentQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceContract | null>(null);
  const [form, setForm] = useState<ServiceContractInput>(EMPTY_FORM);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [contractRows, clientRows, equipmentRows, tenderRows] =
        await Promise.all([
          getServiceContracts(),
          getClients(),
          getClientEquipment(),
          getTenders().catch(() => [] as Tender[]),
        ]);
      setContracts(contractRows);
      setClients(clientRows);
      setEquipment(equipmentRows);
      setTenders(tenderRows);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudieron cargar los contratos."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const clientName = useMemo(() => {
    const map = new Map(clients.map((client) => [client.id, client.name]));
    return (id: string | null) => (id ? map.get(id) ?? "—" : "—");
  }, [clients]);

  const contractById = useMemo(
    () => new Map(contracts.map((contract) => [contract.id, contract])),
    [contracts]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contracts;
    return contracts.filter((contract) =>
      [
        contract.contractNumber,
        contract.title,
        clientName(contract.clientId),
        contract.notes,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [contracts, search, clientName]);

  const visibleEquipment = useMemo(() => {
    const q = equipmentQuery.trim().toLowerCase();
    return equipment.filter((item) => {
      if (form.clientId && item.clientId !== form.clientId) return false;
      if (!q) return true;
      return [item.name, item.brand, item.model, item.serialNumber, clientName(item.clientId)]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [equipment, equipmentQuery, form.clientId, clientName]);

  function equipmentCount(contractId: string) {
    return equipment.filter((item) => item.contractId === contractId).length;
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSelectedEquipment([]);
    setEquipmentQuery("");
    setFormOpen(true);
    setMessage("");
    setError("");
  }

  function openEdit(contract: ServiceContract) {
    setEditing(contract);
    setForm({
      contractNumber: contract.contractNumber,
      title: contract.title,
      clientId: contract.clientId,
      tenderId: contract.tenderId,
      startsOn: contract.startsOn,
      endsOn: contract.endsOn,
      notes: contract.notes,
      isActive: contract.isActive,
    });
    setSelectedEquipment(
      equipment.filter((item) => item.contractId === contract.id).map((item) => item.id)
    );
    setEquipmentQuery("");
    setFormOpen(true);
    setMessage("");
    setError("");
  }

  function toggleEquipment(id: string) {
    setSelectedEquipment((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setSubmitting(true);
    setError("");
    try {
      const saved = editing
        ? await updateServiceContract(editing.id, form)
        : await createServiceContract(form);
      await setContractEquipment(saved.id, selectedEquipment);
      setMessage(
        editing
          ? `Contrato ${saved.contractNumber} actualizado.`
          : `Contrato ${saved.contractNumber} dado de alta.`
      );
      setFormOpen(false);
      setEditing(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el contrato.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(contract: ServiceContract) {
    if (!canDelete) return;
    const ok = window.confirm(
      `¿Eliminar el contrato ${contract.contractNumber}? Los equipos quedan sin ese contrato vigente.`
    );
    if (!ok) return;
    try {
      setError("");
      await deleteServiceContract(contract.id);
      if (editing?.id === contract.id) setFormOpen(false);
      setMessage(`Contrato ${contract.contractNumber} eliminado.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el contrato.");
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Contratos</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Alta simple para vincular equipos a un contrato. El número no es
              obligatorio: solo los equipos que marques quedan cubiertos.
            </p>
          </div>
          {canWrite ? (
            <Button
              onClick={openCreate}
              className="border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
            >
              <Plus className="size-4" />
              Nuevo contrato
            </Button>
          ) : null}
        </div>
        <div className="mt-4">
          <ReadOnlyBanner visible={!canWrite} />
        </div>
        <label className="relative mt-4 block">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar número, título o cliente"
            className={cn(fieldClass, "pl-9")}
          />
        </label>
      </div>

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

      {formOpen && canWrite ? (
        <form
          onSubmit={handleSubmit}
          className="grid gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:grid-cols-2"
        >
          <h3 className="text-base font-semibold sm:col-span-2">
            {editing ? `Editar ${editing.contractNumber}` : "Nuevo contrato"}
          </h3>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Número de contrato *</span>
            <input
              required
              value={form.contractNumber}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, contractNumber: event.target.value }))
              }
              className={fieldClass}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Título</span>
            <input
              value={form.title}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, title: event.target.value }))
              }
              className={fieldClass}
              placeholder="Mantenimiento integral, arrendamiento…"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Cliente</span>
            <select
              value={form.clientId ?? ""}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  clientId: event.target.value || null,
                }))
              }
              className={fieldClass}
            >
              <option value="">Sin cliente</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Licitación</span>
            <select
              value={form.tenderId ?? ""}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  tenderId: event.target.value || null,
                }))
              }
              className={fieldClass}
            >
              <option value="">Sin licitación</option>
              {tenders.map((tender) => (
                <option key={tender.id} value={tender.id}>
                  {tender.folioInterno} · {tender.title}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Inicio</span>
            <input
              type="date"
              value={form.startsOn}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, startsOn: event.target.value }))
              }
              className={fieldClass}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Fin</span>
            <input
              type="date"
              value={form.endsOn}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, endsOn: event.target.value }))
              }
              className={fieldClass}
            />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, isActive: event.target.checked }))
              }
            />
            Contrato vigente
          </label>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Notas</span>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, notes: event.target.value }))
              }
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </label>

          <div className="space-y-2 sm:col-span-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-medium">Equipos vinculados</p>
                <p className="text-xs text-muted-foreground">
                  {selectedEquipment.length} seleccionado
                  {selectedEquipment.length === 1 ? "" : "s"}. Si un equipo ya
                  tenía otro contrato, este pasa a ser el vigente.
                </p>
              </div>
              <label className="relative sm:w-64">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={equipmentQuery}
                  onChange={(event) => setEquipmentQuery(event.target.value)}
                  placeholder="Filtrar equipos"
                  className={cn(fieldClass, "pl-9")}
                />
              </label>
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
              {visibleEquipment.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  No hay equipos para este filtro.
                </p>
              ) : (
                visibleEquipment.map((item) => {
                  const current = item.contractId
                    ? contractById.get(item.contractId)
                    : null;
                  const checked = selectedEquipment.includes(item.id);
                  return (
                    <label
                      key={item.id}
                      className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60"
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={checked}
                        onChange={() => toggleEquipment(item.id)}
                      />
                      <span>
                        <span className="font-medium">{item.name}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {clientName(item.clientId)}
                          {item.serialNumber ? ` · serie ${item.serialNumber}` : ""}
                        </span>
                        {current && current.id !== editing?.id ? (
                          <span className="block text-xs text-amber-700 dark:text-amber-300">
                            Contrato actual: {current.contractNumber}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button
              type="submit"
              disabled={submitting}
              className="border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
            >
              {submitting ? "Guardando..." : "Guardar contrato"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormOpen(false);
                setEditing(null);
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <SortableTable className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Número</th>
              <th className="px-3 py-2 font-medium">Título</th>
              <th className="px-3 py-2 font-medium">Cliente</th>
              <th className="px-3 py-2 font-medium">Vigencia</th>
              <th className="px-3 py-2 font-medium">Equipos</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  Cargando contratos…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  {contracts.length === 0
                    ? "Aún no hay contratos. Da de alta el primero para vincular equipos."
                    : "Ningún contrato coincide con la búsqueda."}
                </td>
              </tr>
            ) : (
              filtered.map((contract) => (
                <tr key={contract.id} className="border-t border-border/70">
                  <td className="px-3 py-2 font-medium text-[#3B46A5]">
                    {contract.contractNumber}
                  </td>
                  <td className="px-3 py-2">{contract.title || "—"}</td>
                  <td className="px-3 py-2">{clientName(contract.clientId)}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {contract.startsOn || contract.endsOn
                      ? `${contract.startsOn || "…"} – ${contract.endsOn || "…"}`
                      : "Sin fechas"}
                  </td>
                  <td className="px-3 py-2">{equipmentCount(contract.id)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs",
                        contract.isActive
                          ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {contract.isActive ? "Vigente" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      {canWrite ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8"
                          onClick={() => openEdit(contract)}
                        >
                          Editar
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {contractLabel(contract)}
                        </span>
                      )}
                      {canDelete ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 text-destructive"
                          onClick={() => void handleDelete(contract)}
                        >
                          <Trash2 className="size-3.5" />
                          Eliminar
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </SortableTable>
      </div>
    </section>
  );
}
