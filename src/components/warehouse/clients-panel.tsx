"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Building2, BookUser, History, Pencil, Plus, Search, Trash2, Wrench, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DesktopTable,
  ResponsiveDataList,
} from "@/components/ui/responsive-data-list";
import { ReadOnlyBanner } from "@/components/warehouse/read-only-banner";
import { getSession } from "@/lib/auth";
import { usePermissions } from "@/lib/auth/use-permissions";
import {
  createClient,
  createClientContact,
  createClientEquipment,
  createClientService,
  deleteClient,
  deleteClientContact,
  deleteClientEquipment,
  deleteClientService,
  getClientContacts,
  getClientEquipment,
  getClients,
  getClientServices,
  updateClient,
  updateClientContact,
  updateClientEquipment,
} from "@/lib/clients/storage";
import {
  CLIENT_CONTACT_ROLES,
  CLIENT_EQUIPMENT_STATUSES,
  CLIENT_SERVICE_TYPES,
  clientEquipmentStatusLabel,
  clientServiceTypeLabel,
  type Client,
  type ClientContact,
  type ClientContactInput,
  type ClientEquipment,
  type ClientEquipmentInput,
  type ClientEquipmentStatus,
  type ClientInput,
  type ClientService,
  type ClientServiceInput,
  type ClientServiceType,
} from "@/lib/clients/types";
import { MEXICO_STATES } from "@/lib/location/mexico-states";
import { cn } from "@/lib/utils";

type ViewId = "clientes" | "equipos" | "historial";

const EMPTY_CLIENT: ClientInput = {
  name: "",
  contactName: "",
  email: "",
  phone: "",
  rfc: "",
  address: "",
  city: "",
  state: "",
  notes: "",
  isActive: true,
};

const EMPTY_CONTACT: Omit<ClientContactInput, "clientId"> = {
  name: "",
  roleTitle: "contacto_general",
  department: "",
  phone: "",
  email: "",
  extension: "",
  notes: "",
  isPrimary: false,
  sortOrder: 0,
};

const EMPTY_EQUIPMENT: ClientEquipmentInput = {
  clientId: "",
  name: "",
  brand: "",
  model: "",
  serialNumber: "",
  location: "",
  status: "operativo",
  equipmentKind: "general",
  installedAt: "",
  notes: "",
};

const EMPTY_SERVICE: Omit<ClientServiceInput, "createdBy"> = {
  clientId: "",
  equipmentId: null,
  serviceType: "levantamiento",
  title: "",
  description: "",
  performedAt: new Date().toISOString().slice(0, 10),
  technician: "",
  folio: "",
  notes: "",
};

const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none";

export function ClientsPanel() {
  const { canWrite } = usePermissions("clientes");
  const [view, setView] = useState<ViewId>("clientes");
  const [clients, setClients] = useState<Client[]>([]);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [equipment, setEquipment] = useState<ClientEquipment[]>([]);
  const [services, setServices] = useState<ClientService[]>([]);
  const [search, setSearch] = useState("");
  const [filterClientId, setFilterClientId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [clientFormOpen, setClientFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientForm, setClientForm] = useState<ClientInput>(EMPTY_CLIENT);

  const [fichaClient, setFichaClient] = useState<Client | null>(null);
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ClientContact | null>(null);
  const [contactForm, setContactForm] =
    useState<Omit<ClientContactInput, "clientId">>(EMPTY_CONTACT);

  const [equipmentFormOpen, setEquipmentFormOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] =
    useState<ClientEquipment | null>(null);
  const [equipmentForm, setEquipmentForm] =
    useState<ClientEquipmentInput>(EMPTY_EQUIPMENT);

  const [serviceFormOpen, setServiceFormOpen] = useState(false);
  const [serviceForm, setServiceForm] = useState(EMPTY_SERVICE);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [clientRows, contactRows, equipmentRows, serviceRows] =
        await Promise.all([
          getClients(),
          getClientContacts(),
          getClientEquipment(),
          getClientServices(),
        ]);
      setClients(clientRows);
      setContacts(contactRows);
      setEquipment(equipmentRows);
      setServices(serviceRows);
      setFichaClient((current) =>
        current
          ? clientRows.find((c) => c.id === current.id) ?? null
          : null
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo cargar clientes."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!editingClient) {
      setClientForm(EMPTY_CLIENT);
      return;
    }
    setClientForm({
      name: editingClient.name,
      contactName: editingClient.contactName,
      email: editingClient.email,
      phone: editingClient.phone,
      rfc: editingClient.rfc,
      address: editingClient.address,
      city: editingClient.city,
      state: editingClient.state,
      notes: editingClient.notes,
      isActive: editingClient.isActive,
    });
  }, [editingClient]);

  useEffect(() => {
    if (!editingEquipment) {
      setEquipmentForm({
        ...EMPTY_EQUIPMENT,
        clientId: filterClientId || clients[0]?.id || "",
      });
      return;
    }
    setEquipmentForm({
      clientId: editingEquipment.clientId,
      name: editingEquipment.name,
      brand: editingEquipment.brand,
      model: editingEquipment.model,
      serialNumber: editingEquipment.serialNumber,
      location: editingEquipment.location,
      status: editingEquipment.status,
      installedAt: editingEquipment.installedAt,
      notes: editingEquipment.notes,
    });
  }, [editingEquipment, filterClientId, clients]);

  const clientNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const client of clients) map.set(client.id, client.name);
    return map;
  }, [clients]);

  const equipmentByClient = useMemo(() => {
    if (!filterClientId) return equipment;
    return equipment.filter((item) => item.clientId === filterClientId);
  }, [equipment, filterClientId]);

  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter((client) =>
      [
        client.name,
        client.contactName,
        client.email,
        client.phone,
        client.rfc,
        client.city,
        client.state,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [clients, search]);

  const filteredEquipment = useMemo(() => {
    let rows = equipmentByClient;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((item) =>
        [
          item.name,
          item.brand,
          item.model,
          item.serialNumber,
          item.location,
          clientNameById.get(item.clientId) ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }
    return rows;
  }, [equipmentByClient, search, clientNameById]);

  const filteredServices = useMemo(() => {
    let rows = services;
    if (filterClientId) {
      rows = rows.filter((item) => item.clientId === filterClientId);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((item) =>
        [
          item.title,
          item.folio,
          item.technician,
          item.serviceType,
          clientNameById.get(item.clientId) ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }
    return rows;
  }, [services, filterClientId, search, clientNameById]);

  const equipmentForServiceForm = useMemo(
    () =>
      equipment.filter((item) =>
        serviceForm.clientId ? item.clientId === serviceForm.clientId : true
      ),
    [equipment, serviceForm.clientId]
  );

  async function handleSaveClient(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      if (editingClient) {
        await updateClient(editingClient.id, clientForm);
        setMessage("Cliente actualizado.");
      } else {
        const created = await createClient(clientForm);
        if (clientForm.contactName.trim() || clientForm.phone.trim() || clientForm.email.trim()) {
          await createClientContact({
            clientId: created.id,
            name: clientForm.contactName.trim() || created.name,
            roleTitle: "contacto_general",
            department: "",
            phone: clientForm.phone.trim(),
            email: clientForm.email.trim(),
            extension: "",
            notes: "",
            isPrimary: true,
            sortOrder: 0,
          });
        }
        setMessage("Cliente registrado.");
      }
      setClientFormOpen(false);
      setEditingClient(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveEquipment(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      if (!equipmentForm.clientId) {
        throw new Error("Selecciona un cliente.");
      }
      if (editingEquipment) {
        await updateClientEquipment(editingEquipment.id, equipmentForm);
        setMessage("Equipo actualizado.");
      } else {
        await createClientEquipment(equipmentForm);
        setMessage("Equipo de levantamiento registrado.");
      }
      setEquipmentFormOpen(false);
      setEditingEquipment(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveService(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      if (!serviceForm.clientId) {
        throw new Error("Selecciona un cliente.");
      }
      const session = getSession();
      await createClientService({
        ...serviceForm,
        equipmentId: serviceForm.equipmentId || null,
        createdBy: session?.username ?? "",
      });
      setMessage("Servicio registrado en el historial.");
      setServiceFormOpen(false);
      setServiceForm({
        ...EMPTY_SERVICE,
        clientId: filterClientId || clients[0]?.id || "",
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteClient(client: Client) {
    if (!canWrite) return;
    const ok = window.confirm(
      `¿Eliminar al cliente "${client.name}"? También se borrarán sus equipos y servicios.`
    );
    if (!ok) return;
    try {
      await deleteClient(client.id);
      setMessage("Cliente eliminado.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  }

  async function handleDeleteEquipment(item: ClientEquipment) {
    if (!canWrite) return;
    const ok = window.confirm(`¿Eliminar el equipo "${item.name}"?`);
    if (!ok) return;
    try {
      await deleteClientEquipment(item.id);
      setMessage("Equipo eliminado.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  }

  async function handleDeleteService(item: ClientService) {
    if (!canWrite) return;
    const ok = window.confirm(`¿Eliminar el servicio "${item.title}"?`);
    if (!ok) return;
    try {
      await deleteClientService(item.id);
      setMessage("Servicio eliminado.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  }

  const fichaContacts = useMemo(
    () =>
      fichaClient
        ? contacts.filter((c) => c.clientId === fichaClient.id)
        : [],
    [contacts, fichaClient]
  );

  const contactCountByClient = useMemo(() => {
    const map = new Map<string, number>();
    for (const contact of contacts) {
      map.set(contact.clientId, (map.get(contact.clientId) ?? 0) + 1);
    }
    return map;
  }, [contacts]);

  function openFicha(client: Client) {
    setFichaClient(client);
    setContactFormOpen(false);
    setEditingContact(null);
    setContactForm(EMPTY_CONTACT);
    setClientFormOpen(false);
    setEquipmentFormOpen(false);
    setServiceFormOpen(false);
  }

  function openNewContact() {
    if (!fichaClient) return;
    setEditingContact(null);
    setContactForm({
      ...EMPTY_CONTACT,
      isPrimary: fichaContacts.length === 0,
    });
    setContactFormOpen(true);
  }

  function openEditContact(contact: ClientContact) {
    setEditingContact(contact);
    setContactForm({
      name: contact.name,
      roleTitle: contact.roleTitle,
      department: contact.department,
      phone: contact.phone,
      email: contact.email,
      extension: contact.extension,
      notes: contact.notes,
      isPrimary: contact.isPrimary,
      sortOrder: contact.sortOrder,
    });
    setContactFormOpen(true);
  }

  async function handleSaveContact(event: FormEvent) {
    event.preventDefault();
    if (!canWrite || !fichaClient) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const payload: ClientContactInput = {
        ...contactForm,
        clientId: fichaClient.id,
      };
      if (editingContact) {
        await updateClientContact(editingContact.id, payload);
        setMessage("Contacto actualizado en el directorio.");
      } else {
        await createClientContact(payload);
        setMessage("Contacto agregado al directorio.");
      }
      setContactFormOpen(false);
      setEditingContact(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el contacto.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteContact(contact: ClientContact) {
    if (!canWrite) return;
    const ok = window.confirm(`¿Eliminar a "${contact.name}" del directorio?`);
    if (!ok) return;
    try {
      await deleteClientContact(contact.id);
      setMessage("Contacto eliminado.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  }

  function roleLabel(role: string) {
    return CLIENT_CONTACT_ROLES.find((r) => r.id === role)?.label ?? role;
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Clientes y levantamientos
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Registra clientes, equipos en sitio y consulta el historial de
              servicios (levantamientos, instalaciones, mantenimientos).
            </p>
          </div>
          {canWrite ? (
            <div className="flex flex-wrap gap-2">
              {view === "clientes" ? (
                <Button
                  type="button"
                  onClick={() => {
                    setEditingClient(null);
                    setClientForm(EMPTY_CLIENT);
                    setClientFormOpen(true);
                  }}
                  className="border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                >
                  <Plus className="size-4" />
                  Nuevo cliente
                </Button>
              ) : null}
              {view === "equipos" ? (
                <Button
                  type="button"
                  onClick={() => {
                    setEditingEquipment(null);
                    setEquipmentForm({
                      ...EMPTY_EQUIPMENT,
                      clientId: filterClientId || clients[0]?.id || "",
                    });
                    setEquipmentFormOpen(true);
                  }}
                  className="border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                >
                  <Plus className="size-4" />
                  Nuevo equipo
                </Button>
              ) : null}
              {view === "historial" ? (
                <Button
                  type="button"
                  onClick={() => {
                    setServiceForm({
                      ...EMPTY_SERVICE,
                      clientId: filterClientId || clients[0]?.id || "",
                    });
                    setServiceFormOpen(true);
                  }}
                  className="border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                >
                  <Plus className="size-4" />
                  Registrar servicio
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-4">
          <ReadOnlyBanner visible={!canWrite} />
        </div>

        <div className="mt-4 flex flex-wrap gap-1 rounded-xl border border-border bg-muted/40 p-1">
          {(
            [
              { id: "clientes", label: "Clientes", icon: Building2 },
              { id: "equipos", label: "Equipos", icon: Wrench },
              { id: "historial", label: "Historial", icon: History },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setView(item.id);
                  setSearch("");
                  setClientFormOpen(false);
                  setEquipmentFormOpen(false);
                  setServiceFormOpen(false);
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  view === item.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                view === "clientes"
                  ? "Buscar cliente, RFC, contacto..."
                  : view === "equipos"
                    ? "Buscar equipo, serie, marca..."
                    : "Buscar servicio, folio, técnico..."
              }
              className={cn(fieldClass, "pl-9")}
            />
          </label>
          {view !== "clientes" ? (
            <select
              value={filterClientId}
              onChange={(event) => setFilterClientId(event.target.value)}
              className={fieldClass}
            >
              <option value="">Todos los clientes</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
            {message}
          </p>
        ) : null}
      </div>

      {clientFormOpen && canWrite ? (
        <form
          onSubmit={handleSaveClient}
          className="grid gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:grid-cols-2"
        >
          <h3 className="text-base font-semibold sm:col-span-2">
            {editingClient ? "Editar cliente" : "Nuevo cliente"}
          </h3>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Nombre / razón social *</span>
            <input
              required
              value={clientForm.name}
              onChange={(e) =>
                setClientForm((prev) => ({ ...prev, name: e.target.value }))
              }
              className={fieldClass}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Contacto</span>
            <input
              value={clientForm.contactName}
              onChange={(e) =>
                setClientForm((prev) => ({
                  ...prev,
                  contactName: e.target.value,
                }))
              }
              className={fieldClass}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">RFC</span>
            <input
              value={clientForm.rfc}
              onChange={(e) =>
                setClientForm((prev) => ({ ...prev, rfc: e.target.value }))
              }
              className={fieldClass}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Teléfono</span>
            <input
              value={clientForm.phone}
              onChange={(e) =>
                setClientForm((prev) => ({ ...prev, phone: e.target.value }))
              }
              className={fieldClass}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Correo</span>
            <input
              type="email"
              value={clientForm.email}
              onChange={(e) =>
                setClientForm((prev) => ({ ...prev, email: e.target.value }))
              }
              className={fieldClass}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Estado</span>
            <select
              value={clientForm.state}
              onChange={(e) =>
                setClientForm((prev) => ({ ...prev, state: e.target.value }))
              }
              className={fieldClass}
            >
              <option value="">Selecciona</option>
              {MEXICO_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Ciudad</span>
            <input
              value={clientForm.city}
              onChange={(e) =>
                setClientForm((prev) => ({ ...prev, city: e.target.value }))
              }
              className={fieldClass}
            />
          </label>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Dirección</span>
            <input
              value={clientForm.address}
              onChange={(e) =>
                setClientForm((prev) => ({ ...prev, address: e.target.value }))
              }
              className={fieldClass}
            />
          </label>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Notas</span>
            <textarea
              rows={2}
              value={clientForm.notes}
              onChange={(e) =>
                setClientForm((prev) => ({ ...prev, notes: e.target.value }))
              }
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="inline-flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={clientForm.isActive}
              onChange={(e) =>
                setClientForm((prev) => ({
                  ...prev,
                  isActive: e.target.checked,
                }))
              }
            />
            Cliente activo
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button
              type="submit"
              disabled={submitting}
              className="border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
            >
              {submitting ? "Guardando..." : "Guardar cliente"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setClientFormOpen(false);
                setEditingClient(null);
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}

      {equipmentFormOpen && canWrite ? (
        <form
          onSubmit={handleSaveEquipment}
          className="grid gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:grid-cols-2"
        >
          <h3 className="text-base font-semibold sm:col-span-2">
            {editingEquipment
              ? "Editar equipo de levantamiento"
              : "Equipo para levantamiento"}
          </h3>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Cliente *</span>
            <select
              required
              value={equipmentForm.clientId}
              onChange={(e) =>
                setEquipmentForm((prev) => ({
                  ...prev,
                  clientId: e.target.value,
                }))
              }
              className={fieldClass}
            >
              <option value="">Selecciona cliente</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Equipo *</span>
            <input
              required
              value={equipmentForm.name}
              onChange={(e) =>
                setEquipmentForm((prev) => ({ ...prev, name: e.target.value }))
              }
              className={fieldClass}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Marca</span>
            <input
              value={equipmentForm.brand}
              onChange={(e) =>
                setEquipmentForm((prev) => ({ ...prev, brand: e.target.value }))
              }
              className={fieldClass}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Modelo</span>
            <input
              value={equipmentForm.model}
              onChange={(e) =>
                setEquipmentForm((prev) => ({ ...prev, model: e.target.value }))
              }
              className={fieldClass}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Número de serie</span>
            <input
              value={equipmentForm.serialNumber}
              onChange={(e) =>
                setEquipmentForm((prev) => ({
                  ...prev,
                  serialNumber: e.target.value,
                }))
              }
              className={fieldClass}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Ubicación en sitio</span>
            <input
              value={equipmentForm.location}
              onChange={(e) =>
                setEquipmentForm((prev) => ({
                  ...prev,
                  location: e.target.value,
                }))
              }
              className={fieldClass}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Estado</span>
            <select
              value={equipmentForm.status}
              onChange={(e) =>
                setEquipmentForm((prev) => ({
                  ...prev,
                  status: e.target.value as ClientEquipmentStatus,
                }))
              }
              className={fieldClass}
            >
              {CLIENT_EQUIPMENT_STATUSES.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Fecha de instalación</span>
            <input
              type="date"
              value={equipmentForm.installedAt}
              onChange={(e) =>
                setEquipmentForm((prev) => ({
                  ...prev,
                  installedAt: e.target.value,
                }))
              }
              className={fieldClass}
            />
          </label>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Notas</span>
            <textarea
              rows={2}
              value={equipmentForm.notes}
              onChange={(e) =>
                setEquipmentForm((prev) => ({ ...prev, notes: e.target.value }))
              }
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button
              type="submit"
              disabled={submitting}
              className="border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
            >
              {submitting ? "Guardando..." : "Guardar equipo"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEquipmentFormOpen(false);
                setEditingEquipment(null);
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}

      {serviceFormOpen && canWrite ? (
        <form
          onSubmit={handleSaveService}
          className="grid gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:grid-cols-2"
        >
          <h3 className="text-base font-semibold sm:col-span-2">
            Registrar servicio / levantamiento
          </h3>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Cliente *</span>
            <select
              required
              value={serviceForm.clientId}
              onChange={(e) =>
                setServiceForm((prev) => ({
                  ...prev,
                  clientId: e.target.value,
                  equipmentId: null,
                }))
              }
              className={fieldClass}
            >
              <option value="">Selecciona cliente</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Equipo (opcional)</span>
            <select
              value={serviceForm.equipmentId ?? ""}
              onChange={(e) =>
                setServiceForm((prev) => ({
                  ...prev,
                  equipmentId: e.target.value || null,
                }))
              }
              className={fieldClass}
            >
              <option value="">Sin equipo específico</option>
              {equipmentForServiceForm.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.serialNumber ? ` · ${item.serialNumber}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Tipo de servicio *</span>
            <select
              value={serviceForm.serviceType}
              onChange={(e) =>
                setServiceForm((prev) => ({
                  ...prev,
                  serviceType: e.target.value as ClientServiceType,
                }))
              }
              className={fieldClass}
            >
              {CLIENT_SERVICE_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Fecha *</span>
            <input
              required
              type="date"
              value={serviceForm.performedAt}
              onChange={(e) =>
                setServiceForm((prev) => ({
                  ...prev,
                  performedAt: e.target.value,
                }))
              }
              className={fieldClass}
            />
          </label>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Título *</span>
            <input
              required
              value={serviceForm.title}
              onChange={(e) =>
                setServiceForm((prev) => ({ ...prev, title: e.target.value }))
              }
              className={fieldClass}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Técnico</span>
            <input
              value={serviceForm.technician}
              onChange={(e) =>
                setServiceForm((prev) => ({
                  ...prev,
                  technician: e.target.value,
                }))
              }
              className={fieldClass}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Folio</span>
            <input
              value={serviceForm.folio}
              onChange={(e) =>
                setServiceForm((prev) => ({ ...prev, folio: e.target.value }))
              }
              className={fieldClass}
            />
          </label>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Descripción</span>
            <textarea
              rows={3}
              value={serviceForm.description}
              onChange={(e) =>
                setServiceForm((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button
              type="submit"
              disabled={submitting}
              className="border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
            >
              {submitting ? "Guardando..." : "Guardar servicio"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setServiceFormOpen(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}

      {fichaClient ? (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Ficha del cliente
              </p>
              <h3 className="text-lg font-semibold">{fichaClient.name}</h3>
              <p className="text-sm text-muted-foreground">
                {[fichaClient.city, fichaClient.state].filter(Boolean).join(", ") ||
                  "Sin ubicación"}
                {fichaClient.rfc ? ` · RFC ${fichaClient.rfc}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canWrite ? (
                <Button type="button" size="sm" onClick={openNewContact}>
                  <Plus className="size-4" /> Contacto
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setFichaClient(null);
                  setContactFormOpen(false);
                }}
              >
                <X className="size-4" /> Cerrar ficha
              </Button>
            </div>
          </div>

          <div className="grid gap-3 rounded-xl border border-border bg-muted/30 p-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Teléfono principal</p>
              <p>{fichaClient.phone || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Correo</p>
              <p className="break-all">{fichaClient.email || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Dirección</p>
              <p>{fichaClient.address || "—"}</p>
            </div>
          </div>

          <div>
            <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <BookUser className="size-4" />
              Directorio ({fichaContacts.length})
            </h4>

            {contactFormOpen && canWrite ? (
              <form
                onSubmit={handleSaveContact}
                className="mb-4 grid gap-3 rounded-xl border border-border bg-background p-4 sm:grid-cols-2"
              >
                <h5 className="text-sm font-medium sm:col-span-2">
                  {editingContact ? "Editar contacto" : "Nuevo contacto"}
                </h5>
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-muted-foreground">Nombre *</span>
                  <input
                    required
                    className={fieldClass}
                    value={contactForm.name}
                    onChange={(e) =>
                      setContactForm((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-muted-foreground">Rol / área</span>
                  <select
                    className={fieldClass}
                    value={contactForm.roleTitle}
                    onChange={(e) =>
                      setContactForm((f) => ({ ...f, roleTitle: e.target.value }))
                    }
                  >
                    {CLIENT_CONTACT_ROLES.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-muted-foreground">Departamento</span>
                  <input
                    className={fieldClass}
                    value={contactForm.department}
                    onChange={(e) =>
                      setContactForm((f) => ({ ...f, department: e.target.value }))
                    }
                    placeholder="Ej. Biomedicina, Compras…"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-muted-foreground">Teléfono</span>
                  <input
                    className={fieldClass}
                    value={contactForm.phone}
                    onChange={(e) =>
                      setContactForm((f) => ({ ...f, phone: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-muted-foreground">Extensión</span>
                  <input
                    className={fieldClass}
                    value={contactForm.extension}
                    onChange={(e) =>
                      setContactForm((f) => ({ ...f, extension: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-muted-foreground">Correo</span>
                  <input
                    type="email"
                    className={fieldClass}
                    value={contactForm.email}
                    onChange={(e) =>
                      setContactForm((f) => ({ ...f, email: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-muted-foreground">Notas</span>
                  <textarea
                    className="min-h-16 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    value={contactForm.notes}
                    onChange={(e) =>
                      setContactForm((f) => ({ ...f, notes: e.target.value }))
                    }
                  />
                </label>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={contactForm.isPrimary}
                    onChange={(e) =>
                      setContactForm((f) => ({
                        ...f,
                        isPrimary: e.target.checked,
                      }))
                    }
                  />
                  Contacto principal
                </label>
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                  >
                    {submitting ? "Guardando…" : "Guardar contacto"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setContactFormOpen(false);
                      setEditingContact(null);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            ) : null}

            {fichaContacts.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                Este cliente aún no tiene directorio. Agrega compradores,
                biomedicina, almacén u otros contactos.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {fichaContacts.map((contact) => (
                  <article
                    key={contact.id}
                    className="rounded-xl border border-border bg-background p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{contact.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {roleLabel(contact.roleTitle)}
                          {contact.department ? ` · ${contact.department}` : ""}
                        </p>
                      </div>
                      {contact.isPrimary ? (
                        <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-medium text-sky-800 dark:text-sky-200">
                          Principal
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 space-y-1 text-sm">
                      <p>
                        Tel: {contact.phone || "—"}
                        {contact.extension ? ` ext. ${contact.extension}` : ""}
                      </p>
                      <p className="break-all">Mail: {contact.email || "—"}</p>
                      {contact.notes ? (
                        <p className="text-xs text-muted-foreground">{contact.notes}</p>
                      ) : null}
                    </div>
                    {canWrite ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2 text-xs"
                          onClick={() => openEditContact(contact)}
                        >
                          <Pencil className="size-3.5" /> Editar
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-destructive/30 px-2 text-xs text-destructive"
                          onClick={() => void handleDeleteContact(contact)}
                        >
                          <Trash2 className="size-3.5" /> Eliminar
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : null}

        {!loading && view === "clientes" ? (
          <>
            <ResponsiveDataList
              emptyMessage="No hay clientes registrados."
              items={filteredClients.map((client) => ({
                key: client.id,
                title: client.name,
                subtitle: client.contactName || client.city || "Sin contacto",
                badge: (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs",
                      client.isActive
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {client.isActive ? "Activo" : "Inactivo"}
                  </span>
                ),
                fields: [
                  { label: "Teléfono", value: client.phone || "—" },
                  { label: "RFC", value: client.rfc || "—" },
                  {
                    label: "Ubicación",
                    value:
                      [client.city, client.state].filter(Boolean).join(", ") ||
                      "—",
                  },
                  {
                    label: "Directorio",
                    value: String(contactCountByClient.get(client.id) ?? 0),
                  },
                  {
                    label: "Equipos",
                    value: String(
                      equipment.filter((item) => item.clientId === client.id)
                        .length
                    ),
                  },
                ],
                actions: (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs"
                      onClick={() => openFicha(client)}
                    >
                      <BookUser className="size-3.5" />
                      Ficha
                    </button>
                    {canWrite ? (
                      <>
                        <button
                          type="button"
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs"
                          onClick={() => {
                            setEditingClient(client);
                            setClientFormOpen(true);
                          }}
                        >
                          <Pencil className="size-3.5" />
                          Editar
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-destructive/30 px-3 text-xs text-destructive"
                          onClick={() => void handleDeleteClient(client)}
                        >
                          <Trash2 className="size-3.5" />
                          Eliminar
                        </button>
                      </>
                    ) : null}
                  </div>
                ),
              }))}
            />
            <DesktopTable>
              <table className="min-w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Cliente</th>
                    <th className="px-3 py-2 font-medium">Contacto</th>
                    <th className="px-3 py-2 font-medium">Teléfono</th>
                    <th className="px-3 py-2 font-medium">Directorio</th>
                    <th className="px-3 py-2 font-medium">Ciudad</th>
                    <th className="px-3 py-2 font-medium">Estatus</th>
                    <th className="px-3 py-2 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-3 py-8 text-center text-muted-foreground"
                      >
                        No hay clientes registrados.
                      </td>
                    </tr>
                  ) : (
                    filteredClients.map((client) => (
                      <tr key={client.id} className="border-t border-border/70">
                        <td className="px-3 py-2 font-medium">{client.name}</td>
                        <td className="px-3 py-2">
                          {client.contactName || "—"}
                        </td>
                        <td className="px-3 py-2">{client.phone || "—"}</td>
                        <td className="px-3 py-2">
                          {contactCountByClient.get(client.id) ?? 0}
                        </td>
                        <td className="px-3 py-2">{client.city || "—"}</td>
                        <td className="px-3 py-2">
                          {client.isActive ? "Activo" : "Inactivo"}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8"
                              onClick={() => openFicha(client)}
                            >
                              Ficha
                            </Button>
                            {canWrite ? (
                              <>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-8"
                                  onClick={() => {
                                    setEditingClient(client);
                                    setClientFormOpen(true);
                                  }}
                                >
                                  Editar
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-8 text-destructive"
                                  onClick={() => void handleDeleteClient(client)}
                                >
                                  Eliminar
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </DesktopTable>
          </>
        ) : null}

        {!loading && view === "equipos" ? (
          <>
            <ResponsiveDataList
              emptyMessage="No hay equipos de levantamiento."
              items={filteredEquipment.map((item) => ({
                key: item.id,
                title: item.name,
                subtitle: `${clientNameById.get(item.clientId) ?? "Cliente"} · ${
                  item.serialNumber || "Sin serie"
                }`,
                badge: (
                  <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-xs text-sky-800 dark:text-sky-200">
                    {clientEquipmentStatusLabel(item.status)}
                  </span>
                ),
                fields: [
                  {
                    label: "Marca / modelo",
                    value: [item.brand, item.model].filter(Boolean).join(" ") || "—",
                  },
                  { label: "Ubicación", value: item.location || "—" },
                ],
                actions: canWrite ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs"
                      onClick={() => {
                        setEditingEquipment(item);
                        setEquipmentFormOpen(true);
                      }}
                    >
                      <Pencil className="size-3.5" />
                      Editar
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-destructive/30 px-3 text-xs text-destructive"
                      onClick={() => void handleDeleteEquipment(item)}
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
                    <th className="px-3 py-2 font-medium">Equipo</th>
                    <th className="px-3 py-2 font-medium">Cliente</th>
                    <th className="px-3 py-2 font-medium">Serie</th>
                    <th className="px-3 py-2 font-medium">Estado</th>
                    <th className="px-3 py-2 font-medium">Ubicación</th>
                    <th className="px-3 py-2 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEquipment.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-8 text-center text-muted-foreground"
                      >
                        No hay equipos de levantamiento.
                      </td>
                    </tr>
                  ) : (
                    filteredEquipment.map((item) => (
                      <tr key={item.id} className="border-t border-border/70">
                        <td className="px-3 py-2 font-medium">{item.name}</td>
                        <td className="px-3 py-2">
                          {clientNameById.get(item.clientId) ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          {item.serialNumber || "—"}
                        </td>
                        <td className="px-3 py-2">
                          {clientEquipmentStatusLabel(item.status)}
                        </td>
                        <td className="px-3 py-2">{item.location || "—"}</td>
                        <td className="px-3 py-2">
                          {canWrite ? (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                className="h-8"
                                onClick={() => {
                                  setEditingEquipment(item);
                                  setEquipmentFormOpen(true);
                                }}
                              >
                                Editar
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-8 text-destructive"
                                onClick={() => void handleDeleteEquipment(item)}
                              >
                                Eliminar
                              </Button>
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
          </>
        ) : null}

        {!loading && view === "historial" ? (
          <>
            <ResponsiveDataList
              emptyMessage="No hay servicios registrados."
              items={filteredServices.map((item) => ({
                key: item.id,
                title: item.title,
                subtitle: `${clientNameById.get(item.clientId) ?? "Cliente"} · ${clientServiceTypeLabel(item.serviceType)}`,
                badge: (
                  <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-xs text-violet-800 dark:text-violet-200">
                    {item.performedAt || "Sin fecha"}
                  </span>
                ),
                fields: [
                  { label: "Folio", value: item.folio || "—" },
                  { label: "Técnico", value: item.technician || "—" },
                  {
                    label: "Equipo",
                    value:
                      equipment.find((eq) => eq.id === item.equipmentId)
                        ?.name || "—",
                  },
                ],
                actions: canWrite ? (
                  <button
                    type="button"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-destructive/30 px-3 text-xs text-destructive"
                    onClick={() => void handleDeleteService(item)}
                  >
                    <Trash2 className="size-3.5" />
                    Eliminar
                  </button>
                ) : undefined,
              }))}
            />
            <DesktopTable>
              <table className="min-w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Fecha</th>
                    <th className="px-3 py-2 font-medium">Cliente</th>
                    <th className="px-3 py-2 font-medium">Tipo</th>
                    <th className="px-3 py-2 font-medium">Título</th>
                    <th className="px-3 py-2 font-medium">Técnico</th>
                    <th className="px-3 py-2 font-medium">Folio</th>
                    <th className="px-3 py-2 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredServices.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-3 py-8 text-center text-muted-foreground"
                      >
                        No hay servicios registrados.
                      </td>
                    </tr>
                  ) : (
                    filteredServices.map((item) => (
                      <tr key={item.id} className="border-t border-border/70">
                        <td className="px-3 py-2">{item.performedAt || "—"}</td>
                        <td className="px-3 py-2">
                          {clientNameById.get(item.clientId) ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          {clientServiceTypeLabel(item.serviceType)}
                        </td>
                        <td className="px-3 py-2 font-medium">{item.title}</td>
                        <td className="px-3 py-2">
                          {item.technician || "—"}
                        </td>
                        <td className="px-3 py-2">{item.folio || "—"}</td>
                        <td className="px-3 py-2">
                          {canWrite ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8 text-destructive"
                              onClick={() => void handleDeleteService(item)}
                            >
                              Eliminar
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
          </>
        ) : null}
      </div>
    </section>
  );
}
