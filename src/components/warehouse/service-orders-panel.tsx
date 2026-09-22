"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Camera,
  FileDown,
  Plus,
  Search,
  Trash2,
  ArrowLeft,
  MessageSquarePlus,
  Package,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReadOnlyBanner } from "@/components/warehouse/read-only-banner";
import { getSession } from "@/lib/auth";
import { usePermissions } from "@/lib/auth/use-permissions";
import { getClientEquipment, getClients } from "@/lib/clients/storage";
import type { Client, ClientEquipment } from "@/lib/clients/types";
import { getInventoryItems } from "@/lib/inventory/storage";
import type { InventoryItem } from "@/lib/inventory/types";
import {
  downloadServiceDeliveryPdf,
  downloadServiceQuotePdf,
  downloadServiceWorkOrderPdf,
} from "@/lib/service-orders/pdf";
import {
  addLinkedEquipment,
  addServiceOrderInstrument,
  addServiceOrderNote,
  applyChecklistTemplate,
  createServiceOrder,
  deleteServiceOrder,
  deleteServiceOrderDocument,
  deleteServiceOrderImage,
  getChecklistTemplates,
  getServiceOrders,
  removeLinkedEquipment,
  removeServiceOrderInstrument,
  replaceServiceOrderLines,
  setServiceOrderStatus,
  updateChecklistItem,
  updateServiceOrder,
  uploadServiceOrderDocument,
  uploadServiceOrderImage,
} from "@/lib/service-orders/storage";
import { getBiomedicalInstruments } from "@/lib/biomedical-instruments/storage";
import { listStaffMembers, type StaffMember } from "@/lib/users/staff";
import { StaffSelect } from "@/components/warehouse/staff-select";
import {
  biomedicalInstrumentTypeLabel,
  type BiomedicalInstrument,
} from "@/lib/biomedical-instruments/types";
import {
  createServiceOrderRequisition,
  getServiceOrderRequisitions,
} from "@/lib/service-orders/requisition-storage";
import {
  requisitionStatusLabel,
  type ServiceOrderRequisition,
} from "@/lib/service-orders/requisitions";
import {
  CHECKLIST_RESULTS,
  IMAGE_STAGES,
  LINKED_EQUIPMENT_RELATIONS,
  SERVICE_LINE_KINDS,
  SERVICE_LINE_STATUSES,
  SERVICE_ORDER_STATUSES,
  SERVICE_TYPES,
  computeServiceTotals,
  lineAmount,
  serviceLineKindLabel,
  serviceOrderStatusLabel,
  serviceTypeLabel,
  timeInStatus,
  type ChecklistResult,
  type ChecklistTemplate,
  type ImageStage,
  type ServiceLineKind,
  type ServiceOrder,
  type ServiceOrderInput,
  type ServiceOrderLineInput,
  type ServiceOrderStatus,
  type ServiceType,
} from "@/lib/service-orders/types";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none";

type DetailTab = "recepcion" | "diagnostico" | "servicios" | "mensajes" | "entrega";

type DraftLine = ServiceOrderLineInput & { key: string };

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function statusTone(status: ServiceOrderStatus) {
  switch (status) {
    case "entregado":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
    case "terminado":
      return "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200";
    case "en_proceso":
    case "diagnostico":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200";
    case "espera_refacciones":
      return "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
    case "cotizacion":
    case "borrador":
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
    case "recibido":
      return "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200";
    case "cancelado":
      return "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function emptyForm(): ServiceOrderInput {
  return {
    orderKind: "servicio",
    status: "recibido",
    priority: "normal",
    serviceType: "diagnostico",
    clientId: null,
    clientName: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    equipmentId: null,
    equipmentName: "",
    equipmentBrand: "",
    equipmentModel: "",
    equipmentSerial: "",
    equipmentLocation: "",
    deliveredBy: "",
    technician: "",
    advisor: "",
    checklistTemplateId: null,
    receptionAt: new Date().toISOString().slice(0, 10),
    promisedAt: "",
    faultReported: "",
    generalObservations: "",
    diagnosisNotes: "",
    serviceNotes: "",
    underWarranty: false,
    authorized: false,
    taxRate: 16,
    discount: 0,
  };
}

function newDraftLine(kind: ServiceLineKind = "insumos"): DraftLine {
  return {
    key: crypto.randomUUID(),
    lineKind: kind,
    productId: null,
    description: "",
    quantity: 1,
    unit: "pza",
    unitPrice: 0,
    lineStatus: "pendiente",
    notes: "",
  };
}

export function ServiceOrdersPanel() {
  const { canWrite } = usePermissions("ordenes_servicio");
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [equipment, setEquipment] = useState<ClientEquipment[]>([]);
  const [instrumentsCatalog, setInstrumentsCatalog] = useState<
    BiomedicalInstrument[]
  >([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ServiceOrderStatus | "todas">(
    "todas"
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showReception, setShowReception] = useState(false);
  const [form, setForm] = useState<ServiceOrderInput>(emptyForm);
  const [detailTab, setDetailTab] = useState<DetailTab>("recepcion");
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [note, setNote] = useState("");
  const [imageStage, setImageStage] = useState<ImageStage>("recepcion");
  const [docsOpen, setDocsOpen] = useState(false);
  const [linkedEqId, setLinkedEqId] = useState("");
  const [linkedRelation, setLinkedRelation] = useState<string>(
    LINKED_EQUIPMENT_RELATIONS[1]?.id ?? "Monitor asociado"
  );
  const [linkedNotes, setLinkedNotes] = useState("");
  const [usedInstrumentId, setUsedInstrumentId] = useState("");
  const [usedInstrumentNotes, setUsedInstrumentNotes] = useState("");
  const [orderRequisitions, setOrderRequisitions] = useState<
    ServiceOrderRequisition[]
  >([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const actor = getSession()?.username ?? "usuario";

  const selected = useMemo(
    () => orders.find((o) => o.id === selectedId) ?? null,
    [orders, selectedId]
  );

  const technicians = useMemo(
    () => staff.filter((member) => member.isTechnician),
    [staff]
  );
  const advisors = useMemo(
    () => staff.filter((member) => member.isServiceAdvisor),
    [staff]
  );

  async function reload() {
    setLoading(true);
    setError("");
    try {
      const [list, tpls, clientList, inventory, instruments, staffList] =
        await Promise.all([
          getServiceOrders(),
          getChecklistTemplates(),
          getClients(),
          getInventoryItems({ kind: "producto" }),
          getBiomedicalInstruments(),
          listStaffMembers().catch(() => [] as StaffMember[]),
        ]);
      setOrders(list);
      setTemplates(tpls);
      setClients(clientList.filter((c) => c.isActive));
      setProducts(inventory);
      setInstrumentsCatalog(instruments);
      setStaff(staffList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar órdenes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    if (!form.clientId) {
      setEquipment([]);
      return;
    }
    void getClientEquipment(form.clientId)
      .then(setEquipment)
      .catch(() => setEquipment([]));
  }, [form.clientId]);

  useEffect(() => {
    if (!selectedId) {
      setOrderRequisitions([]);
      return;
    }
    void getServiceOrderRequisitions({ serviceOrderId: selectedId })
      .then(setOrderRequisitions)
      .catch(() => setOrderRequisitions([]));
  }, [selectedId, selected?.updatedAt]);

  useEffect(() => {
    if (!selected) return;
    setDraftLines(
      selected.lines.map((line) => ({
        key: line.id,
        lineKind: line.lineKind,
        productId: line.productId,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unitPrice: line.unitPrice,
        lineStatus: line.lineStatus,
        notes: line.notes,
      }))
    );
  }, [selected?.id, selected?.updatedAt]);

  const counts = useMemo(() => {
    const map = Object.fromEntries(
      SERVICE_ORDER_STATUSES.map((s) => [s.id, 0])
    ) as Record<ServiceOrderStatus, number>;
    for (const order of orders) map[order.status] += 1;
    return map;
  }, [orders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter !== "todas" && order.status !== statusFilter) return false;
      if (!q) return true;
      return [
        order.folio,
        order.clientName,
        order.equipmentName,
        order.equipmentSerial,
        order.technician,
        order.contactPhone,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [orders, query, statusFilter]);

  const lineTotals = useMemo(
    () => computeServiceTotals(draftLines, form.discount ?? 0, form.taxRate ?? 16),
    [draftLines, form.discount, form.taxRate]
  );

  function openReception(asQuote: boolean) {
    setForm({
      ...emptyForm(),
      orderKind: asQuote ? "cotizacion" : "servicio",
      status: asQuote ? "cotizacion" : "recibido",
      checklistTemplateId: templates[0]?.id ?? null,
      createdBy: actor,
    });
    setShowReception(true);
    setSelectedId(null);
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    if (!form.clientName?.trim() && !form.clientId) {
      setError("Selecciona o escribe un cliente.");
      return;
    }
    try {
      setError("");
      const created = await createServiceOrder({
        ...form,
        createdBy: actor,
        lines: [],
      });
      await reload();
      setShowReception(false);
      setSelectedId(created.id);
      setDetailTab("recepcion");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la orden.");
    }
  }

  async function saveReceptionFields() {
    if (!selected || !canWrite) return;
    try {
      await updateServiceOrder(selected.id, {
        ...formFromOrder(selected),
        ...form,
        createdBy: actor,
        lines: undefined,
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    }
  }

  function formFromOrder(order: ServiceOrder): ServiceOrderInput {
    return {
      orderKind: order.orderKind,
      status: order.status,
      priority: order.priority,
      serviceType: order.serviceType,
      clientId: order.clientId,
      clientName: order.clientName,
      contactName: order.contactName,
      contactPhone: order.contactPhone,
      contactEmail: order.contactEmail,
      equipmentId: order.equipmentId,
      equipmentName: order.equipmentName,
      equipmentBrand: order.equipmentBrand,
      equipmentModel: order.equipmentModel,
      equipmentSerial: order.equipmentSerial,
      equipmentLocation: order.equipmentLocation,
      deliveredBy: order.deliveredBy,
      technician: order.technician,
      advisor: order.advisor,
      checklistTemplateId: order.checklistTemplateId,
      receptionAt: order.receptionAt.slice(0, 10),
      promisedAt: order.promisedAt.slice(0, 10),
      deliveredAt: order.deliveredAt.slice(0, 10),
      faultReported: order.faultReported,
      generalObservations: order.generalObservations,
      diagnosisNotes: order.diagnosisNotes,
      serviceNotes: order.serviceNotes,
      underWarranty: order.underWarranty,
      authorized: order.authorized,
      closed: order.closed,
      taxRate: order.taxRate,
      discount: order.discount,
    };
  }

  function openDetail(order: ServiceOrder) {
    setSelectedId(order.id);
    setShowReception(false);
    setForm(formFromOrder(order));
    setDetailTab("recepcion");
    setDocsOpen(false);
  }

  async function changeStatus(status: ServiceOrderStatus) {
    if (!selected || !canWrite) return;
    try {
      await setServiceOrderStatus(selected.id, status, actor);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar estatus.");
    }
  }

  async function saveLines() {
    if (!selected || !canWrite) return;
    try {
      await replaceServiceOrderLines(
        selected.id,
        draftLines.filter((l) => l.description.trim())
      );
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar partidas.");
    }
  }

  async function requestWarehouse() {
    if (!selected || !canWrite) return;
    try {
      setError("");
      await replaceServiceOrderLines(
        selected.id,
        draftLines.filter((l) => l.description.trim())
      );
      await reload();
      const latest = (await getServiceOrders()).find((o) => o.id === selected.id);
      if (!latest) throw new Error("No se pudo recargar la orden.");

      const requestable = latest.lines.filter(
        (line) =>
          Boolean(line.productId) &&
          (line.lineStatus === "pendiente" || line.lineStatus === "solicitado") &&
          line.lineKind !== "mano_obra" &&
          line.lineKind !== "otro"
      );

      const alreadyOpen = new Set(
        (
          await getServiceOrderRequisitions({ serviceOrderId: latest.id })
        ).flatMap((req) =>
          req.status === "cancelada" || req.status === "surtida"
            ? []
            : req.lines.map((l) => l.serviceOrderLineId).filter(Boolean)
        )
      );

      const fresh = requestable.filter((line) => !alreadyOpen.has(line.id));
      if (!fresh.length) {
        setError(
          "No hay partidas nuevas del catálogo para solicitar. Agrega productos y guárdalos primero."
        );
        return;
      }

      const created = await createServiceOrderRequisition({
        serviceOrderId: latest.id,
        requestedBy: actor,
        notes: `Solicitud desde ${latest.folio}`,
        lines: fresh.map((line) => ({
          serviceOrderLineId: line.id,
          productId: line.productId!,
          description: line.description,
          quantity: line.quantity,
          unit: line.unit,
        })),
      });
      setOrderRequisitions(
        await getServiceOrderRequisitions({ serviceOrderId: latest.id })
      );
      await reload();
      setError("");
      window.alert(
        `Solicitud ${created.folio} enviada a almacén (${created.lines.length} línea(s)).`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo solicitar a almacén."
      );
    }
  }

  async function onChecklistResult(
    itemId: string,
    result: ChecklistResult
  ) {
    if (!canWrite) return;
    try {
      await updateChecklistItem(itemId, result);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el punto.");
    }
  }

  async function onApplyTemplate(templateId: string) {
    if (!selected || !canWrite) return;
    try {
      await applyChecklistTemplate(selected.id, templateId, actor);
      setForm((f) => ({ ...f, checklistTemplateId: templateId }));
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo aplicar plantilla.");
    }
  }

  async function onUploadImage(file: File) {
    if (!selected || !canWrite) return;
    try {
      await uploadServiceOrderImage({
        orderId: selected.id,
        stage: imageStage,
        file,
        uploadedBy: actor,
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la imagen.");
    }
  }

  async function onDeleteImage(imageId: string) {
    if (!selected || !canWrite) return;
    const image = selected.images.find((i) => i.id === imageId);
    if (!image) return;
    try {
      await deleteServiceOrderImage(image);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la imagen.");
    }
  }

  async function onAddLinkedEquipment() {
    if (!selected || !canWrite) return;
    const eq = equipment.find((e) => e.id === linkedEqId);
    if (!eq && !linkedEqId) {
      setError("Selecciona un equipo del cliente para ligarlo.");
      return;
    }
    try {
      setError("");
      await addLinkedEquipment({
        orderId: selected.id,
        equipmentId: eq?.id ?? null,
        equipmentName: eq?.name ?? "",
        equipmentBrand: eq?.brand ?? "",
        equipmentModel: eq?.model ?? "",
        equipmentSerial: eq?.serialNumber ?? "",
        equipmentLocation: eq?.location ?? "",
        relationLabel: linkedRelation,
        notes: linkedNotes,
        createdBy: actor,
      });
      setLinkedEqId("");
      setLinkedNotes("");
      await reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo ligar el equipo."
      );
    }
  }

  async function onRemoveLinkedEquipment(linkId: string) {
    if (!canWrite) return;
    if (!confirm("¿Quitar este equipo ligado de la orden?")) return;
    try {
      setError("");
      await removeLinkedEquipment(linkId, actor);
      await reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo quitar el equipo ligado."
      );
    }
  }

  async function onAddUsedInstrument() {
    if (!selected || !canWrite) return;
    const inst = instrumentsCatalog.find((i) => i.id === usedInstrumentId);
    if (!inst) {
      setError("Selecciona un simulador o analizador del catálogo.");
      return;
    }
    if (!inst.serialNumber.trim()) {
      setError(
        "El instrumento seleccionado no tiene número de serie. Complétalo en Biomédica → Simuladores y analizadores."
      );
      return;
    }
    try {
      setError("");
      await addServiceOrderInstrument({
        orderId: selected.id,
        instrumentId: inst.id,
        instrumentType: inst.instrumentType,
        instrumentName: inst.name,
        instrumentBrand: inst.brand,
        instrumentModel: inst.model,
        instrumentSerial: inst.serialNumber,
        usageNotes: usedInstrumentNotes,
        createdBy: actor,
      });
      setUsedInstrumentId("");
      setUsedInstrumentNotes("");
      await reload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo agregar el instrumento a la orden."
      );
    }
  }

  async function onRemoveUsedInstrument(linkId: string) {
    if (!canWrite) return;
    if (!confirm("¿Quitar este instrumento de la orden?")) return;
    try {
      setError("");
      await removeServiceOrderInstrument(linkId, actor);
      await reload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo quitar el instrumento."
      );
    }
  }

  async function onUploadSafetyPdf(file: File) {
    if (!selected || !canWrite) return;
    try {
      setError("");
      await uploadServiceOrderDocument({
        orderId: selected.id,
        file,
        docType: "seguridad_electrica",
        title: "Examen de seguridad eléctrica",
        uploadedBy: actor,
      });
      await reload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo subir el PDF de seguridad eléctrica."
      );
    }
  }

  async function onDeleteDocument(docId: string) {
    if (!selected || !canWrite) return;
    const doc = selected.documents.find((d) => d.id === docId);
    if (!doc) return;
    try {
      await deleteServiceOrderDocument(doc);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el PDF.");
    }
  }

  async function sendNote() {
    if (!selected || !canWrite || !note.trim()) return;
    try {
      await addServiceOrderNote(selected.id, note, actor, true);
      setNote("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar la nota.");
    }
  }

  async function removeOrder(id: string) {
    if (!canWrite) return;
    if (!confirm("¿Eliminar esta orden de servicio?")) return;
    try {
      await deleteServiceOrder(id);
      setSelectedId(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  }

  function pickClient(clientId: string) {
    const client = clients.find((c) => c.id === clientId);
    setForm((f) => ({
      ...f,
      clientId: clientId || null,
      clientName: client?.name ?? "",
      contactName: client?.contactName ?? f.contactName,
      contactPhone: client?.phone ?? f.contactPhone,
      contactEmail: client?.email ?? f.contactEmail,
      equipmentId: null,
      equipmentName: "",
      equipmentBrand: "",
      equipmentModel: "",
      equipmentSerial: "",
      equipmentLocation: "",
    }));
  }

  function pickEquipment(equipmentId: string) {
    const eq = equipment.find((e) => e.id === equipmentId);
    setForm((f) => ({
      ...f,
      equipmentId: equipmentId || null,
      equipmentName: eq?.name ?? "",
      equipmentBrand: eq?.brand ?? "",
      equipmentModel: eq?.model ?? "",
      equipmentSerial: eq?.serialNumber ?? "",
      equipmentLocation: eq?.location ?? "",
    }));
  }

  function productsForKind(kind: ServiceLineKind) {
    if (kind === "mano_obra" || kind === "otro") return [];
    return products.filter((p) => p.category === kind);
  }

  if (showReception) {
    return (
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        {!canWrite ? <ReadOnlyBanner visible /> : null}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#3B46A5]">
              Recepción de equipo médico
            </h2>
            <p className="text-sm text-muted-foreground">
              Alta rápida de orden o cotización de servicio.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => setShowReception(false)}>
            Regresar
          </Button>
        </div>
        {error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <form onSubmit={onCreate} className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted-foreground">Cliente</span>
            <div className="flex gap-2">
              <select
                className={fieldClass}
                value={form.clientId ?? ""}
                onChange={(e) => pickClient(e.target.value)}
              >
                <option value="">Seleccionar cliente…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                className={fieldClass}
                placeholder="Nombre libre"
                value={form.clientName ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, clientName: e.target.value, clientId: null }))
                }
              />
            </div>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted-foreground">Equipo médico</span>
            <select
              className={fieldClass}
              value={form.equipmentId ?? ""}
              onChange={(e) => pickEquipment(e.target.value)}
              disabled={!form.clientId}
            >
              <option value="">
                {form.clientId ? "Seleccionar equipo del cliente…" : "Primero elige cliente"}
              </option>
              {equipment.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.name} · {eq.brand} {eq.model} · {eq.serialNumber}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Nombre del equipo</span>
            <input
              className={fieldClass}
              value={form.equipmentName ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, equipmentName: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Marca / modelo</span>
            <div className="grid grid-cols-2 gap-2">
              <input
                className={fieldClass}
                placeholder="Marca"
                value={form.equipmentBrand ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, equipmentBrand: e.target.value }))}
              />
              <input
                className={fieldClass}
                placeholder="Modelo"
                value={form.equipmentModel ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, equipmentModel: e.target.value }))}
              />
            </div>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Serie</span>
            <input
              className={fieldClass}
              value={form.equipmentSerial ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, equipmentSerial: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Persona que entrega</span>
            <input
              className={fieldClass}
              value={form.deliveredBy ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, deliveredBy: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Fecha recepción</span>
            <input
              type="date"
              className={fieldClass}
              value={form.receptionAt ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, receptionAt: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Tipo de servicio</span>
            <select
              className={fieldClass}
              value={form.serviceType}
              onChange={(e) =>
                setForm((f) => ({ ...f, serviceType: e.target.value as ServiceType }))
              }
            >
              {SERVICE_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Plantilla de revisión</span>
            <select
              className={fieldClass}
              value={form.checklistTemplateId ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, checklistTemplateId: e.target.value || null }))
              }
            >
              <option value="">Sin plantilla</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <StaffSelect
            label="Técnico"
            value={form.technician ?? ""}
            options={technicians}
            emptyLabel="Seleccionar técnico…"
            onChange={(value) => setForm((f) => ({ ...f, technician: value }))}
          />
          <StaffSelect
            label="Asesor de servicios"
            value={form.advisor ?? ""}
            options={advisors}
            emptyLabel="Seleccionar asesor…"
            onChange={(value) => setForm((f) => ({ ...f, advisor: value }))}
          />
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Prioridad</span>
            <select
              className={fieldClass}
              value={form.priority}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  priority: e.target.value as "normal" | "urgente",
                }))
              }
            >
              <option value="normal">Normal</option>
              <option value="urgente">Urgente</option>
            </select>
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={Boolean(form.underWarranty)}
              onChange={(e) =>
                setForm((f) => ({ ...f, underWarranty: e.target.checked }))
              }
            />
            Cubierta por garantía
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted-foreground">
              Falla reportada por el cliente
            </span>
            <textarea
              className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              value={form.faultReported ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, faultReported: e.target.value }))}
            />
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setShowReception(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!canWrite}
              className="bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
            >
              Guardar
            </Button>
          </div>
        </form>
      </section>
    );
  }

  if (selected) {
    const tabs: { id: DetailTab; label: string }[] = [
      { id: "recepcion", label: "Recepción" },
      { id: "diagnostico", label: `Diagnóstico (${selected.checklist.length})` },
      { id: "servicios", label: `Servicios (${selected.lines.length})` },
      { id: "mensajes", label: `Mensajes (${selected.events.length})` },
      { id: "entrega", label: "Entrega" },
    ];

    const linkedIds = new Set(
      selected.linkedEquipment
        .map((l) => l.equipmentId)
        .filter((id): id is string => Boolean(id))
    );
    const linkableEquipment = equipment.filter(
      (eq) => eq.id !== selected.equipmentId && !linkedIds.has(eq.id)
    );
    const usedInstrumentIds = new Set(
      (selected.instruments ?? [])
        .map((i) => i.instrumentId)
        .filter((id): id is string => Boolean(id))
    );
    const availableInstruments = instrumentsCatalog.filter(
      (inst) => !usedInstrumentIds.has(inst.id)
    );

    return (
      <section className="space-y-4">
        {!canWrite ? <ReadOnlyBanner visible /> : null}
        {error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div>
            <button
              type="button"
              className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setSelectedId(null)}
            >
              <ArrowLeft className="size-3.5" /> Lista de órdenes
            </button>
            <h2 className="text-lg font-semibold">
              {selected.clientName || "Sin cliente"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {[selected.equipmentName, selected.equipmentBrand, selected.equipmentModel]
                .filter(Boolean)
                .join(" · ")}
              {selected.equipmentSerial ? ` · Serie ${selected.equipmentSerial}` : ""}
            </p>
            {selected.linkedEquipment.length > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Ligados:{" "}
                {selected.linkedEquipment
                  .map(
                    (l) =>
                      `${l.relationLabel}${l.equipmentName ? ` (${l.equipmentName})` : ""}`
                  )
                  .join(" · ")}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Button type="button" variant="outline" onClick={() => setDocsOpen((v) => !v)}>
                <FileDown className="size-4" /> Opciones PDF
              </Button>
              {docsOpen ? (
                <div className="absolute right-0 z-20 mt-1 w-64 rounded-xl border border-border bg-card p-2 shadow-lg">
                  <button
                    type="button"
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      downloadServiceQuotePdf(selected);
                      setDocsOpen(false);
                    }}
                  >
                    Cotización para cliente
                  </button>
                  <button
                    type="button"
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      downloadServiceWorkOrderPdf(selected);
                      setDocsOpen(false);
                    }}
                  >
                    Orden de trabajo / calidad
                  </button>
                  <button
                    type="button"
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      downloadServiceDeliveryPdf(selected);
                      setDocsOpen(false);
                    }}
                  >
                    Acta de entrega
                  </button>
                </div>
              ) : null}
            </div>
            {canWrite ? (
              <Button
                type="button"
                variant="outline"
                className="text-destructive"
                onClick={() => void removeOrder(selected.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap gap-1 border-b border-border pb-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setDetailTab(tab.id)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm transition-colors",
                    detailTab === tab.id
                      ? "bg-[linear-gradient(135deg,rgba(0,191,255,0.18),rgba(59,70,165,0.22))] font-medium"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {detailTab === "recepcion" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-muted-foreground">Falla reportada</span>
                  <textarea
                    className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    value={form.faultReported ?? ""}
                    disabled={!canWrite}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, faultReported: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-muted-foreground">
                    Observaciones generales
                  </span>
                  <textarea
                    className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    value={form.generalObservations ?? ""}
                    disabled={!canWrite}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, generalObservations: e.target.value }))
                    }
                  />
                </label>
                <StaffSelect
                  label="Técnico"
                  value={form.technician ?? ""}
                  options={technicians}
                  disabled={!canWrite}
                  emptyLabel="Seleccionar técnico…"
                  onChange={(value) =>
                    setForm((f) => ({ ...f, technician: value }))
                  }
                />
                <StaffSelect
                  label="Asesor de servicios"
                  value={form.advisor ?? ""}
                  options={advisors}
                  disabled={!canWrite}
                  emptyLabel="Seleccionar asesor…"
                  onChange={(value) =>
                    setForm((f) => ({ ...f, advisor: value }))
                  }
                />
                <label className="block text-sm">
                  <span className="mb-1 block text-muted-foreground">Entrega aproximada</span>
                  <input
                    type="date"
                    className={fieldClass}
                    value={form.promisedAt ?? ""}
                    disabled={!canWrite}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, promisedAt: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-muted-foreground">Tipo</span>
                  <select
                    className={fieldClass}
                    value={form.serviceType}
                    disabled={!canWrite}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        serviceType: e.target.value as ServiceType,
                      }))
                    }
                  >
                    {SERVICE_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 self-end pb-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(form.underWarranty)}
                    disabled={!canWrite}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, underWarranty: e.target.checked }))
                    }
                  />
                  Cubierta por garantía
                </label>

                <div className="sm:col-span-2 space-y-3 rounded-xl border border-border bg-muted/20 p-3">
                  <div>
                    <h3 className="text-sm font-medium">Equipos ligados</h3>
                    <p className="text-xs text-muted-foreground">
                      Monitores, ventiladores u otros equipos asociados al principal
                      (por ejemplo monitor ↔ máquina de anestesia).
                    </p>
                  </div>

                  {selected.linkedEquipment.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Ningún equipo ligado aún.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {selected.linkedEquipment.map((link) => (
                        <li
                          key={link.id}
                          className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        >
                          <div>
                            <p className="font-medium">
                              {link.relationLabel}
                              {link.equipmentName ? ` · ${link.equipmentName}` : ""}
                            </p>
                            <p className="text-muted-foreground">
                              {[link.equipmentBrand, link.equipmentModel]
                                .filter(Boolean)
                                .join(" ")}
                              {link.equipmentSerial
                                ? ` · Serie ${link.equipmentSerial}`
                                : ""}
                              {link.equipmentLocation
                                ? ` · ${link.equipmentLocation}`
                                : ""}
                            </p>
                            {link.notes ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {link.notes}
                              </p>
                            ) : null}
                          </div>
                          {canWrite ? (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 text-destructive hover:underline"
                              onClick={() => void onRemoveLinkedEquipment(link.id)}
                            >
                              <Trash2 className="size-3.5" /> Quitar
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}

                  {canWrite ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="block text-sm sm:col-span-2">
                        <span className="mb-1 block text-muted-foreground">
                          Equipo del cliente
                        </span>
                        <select
                          className={fieldClass}
                          value={linkedEqId}
                          onChange={(e) => setLinkedEqId(e.target.value)}
                          disabled={!form.clientId || linkableEquipment.length === 0}
                        >
                          <option value="">
                            {!form.clientId
                              ? "La orden necesita un cliente con equipos"
                              : linkableEquipment.length === 0
                                ? "No hay más equipos disponibles"
                                : "Seleccionar equipo a ligar…"}
                          </option>
                          {linkableEquipment.map((eq) => (
                            <option key={eq.id} value={eq.id}>
                              {eq.name} · {eq.brand} {eq.model} · {eq.serialNumber}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block text-muted-foreground">
                          Relación
                        </span>
                        <select
                          className={fieldClass}
                          value={linkedRelation}
                          onChange={(e) => setLinkedRelation(e.target.value)}
                        >
                          {LINKED_EQUIPMENT_RELATIONS.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block text-muted-foreground">
                          Notas (opcional)
                        </span>
                        <input
                          className={fieldClass}
                          value={linkedNotes}
                          onChange={(e) => setLinkedNotes(e.target.value)}
                          placeholder="Ej. cable ECG incluido"
                        />
                      </label>
                      <div className="sm:col-span-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!linkedEqId}
                          onClick={() => void onAddLinkedEquipment()}
                        >
                          <Plus className="size-4" /> Agregar equipo ligado
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="sm:col-span-2">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-medium">Imágenes del equipo</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
                        value={imageStage}
                        onChange={(e) => setImageStage(e.target.value as ImageStage)}
                      >
                        {IMAGE_STAGES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void onUploadImage(file);
                          e.target.value = "";
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={!canWrite}
                        onClick={() => fileRef.current?.click()}
                      >
                        <Camera className="size-4" /> Subir imagen
                      </Button>
                    </div>
                  </div>
                  {selected.images.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin imágenes aún.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                      {selected.images.map((img) => (
                        <div
                          key={img.id}
                          className="overflow-hidden rounded-xl border border-border"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.fileUrl}
                            alt={img.caption || img.stage}
                            className="aspect-square w-full object-cover"
                          />
                          <div className="flex items-center justify-between gap-1 px-2 py-1 text-xs">
                            <span className="truncate text-muted-foreground">
                              {IMAGE_STAGES.find((s) => s.id === img.stage)?.label}
                            </span>
                            {canWrite ? (
                              <button
                                type="button"
                                className="text-destructive"
                                onClick={() => void onDeleteImage(img.id)}
                              >
                                ×
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {canWrite ? (
                  <div className="sm:col-span-2">
                    <Button
                      type="button"
                      onClick={() => void saveReceptionFields()}
                      className="bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                    >
                      Guardar recepción
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {detailTab === "diagnostico" ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-end gap-2">
                  <label className="block min-w-[220px] flex-1 text-sm">
                    <span className="mb-1 block text-muted-foreground">
                      Plantilla de revisión de puntos
                    </span>
                    <select
                      className={fieldClass}
                      value={form.checklistTemplateId ?? ""}
                      disabled={!canWrite}
                      onChange={(e) => {
                        const id = e.target.value;
                        setForm((f) => ({ ...f, checklistTemplateId: id || null }));
                        if (id) void onApplyTemplate(id);
                      }}
                    >
                      <option value="">Seleccionar…</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block text-sm">
                  <span className="mb-1 block text-muted-foreground">Notas de diagnóstico</span>
                  <textarea
                    className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    value={form.diagnosisNotes ?? ""}
                    disabled={!canWrite}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, diagnosisNotes: e.target.value }))
                    }
                    onBlur={() => {
                      if (canWrite) void saveReceptionFields();
                    }}
                  />
                </label>
                {selected.checklist.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aplica una plantilla para llenar la revisión de puntos del equipo.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {selected.checklist.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-border bg-background p-3"
                      >
                        <p className="mb-2 text-sm font-medium">{item.label}</p>
                        <div className="flex flex-wrap gap-1">
                          {CHECKLIST_RESULTS.filter((r) => r.id !== "pendiente").map(
                            (r) => (
                              <button
                                key={r.id}
                                type="button"
                                disabled={!canWrite}
                                onClick={() => void onChecklistResult(item.id, r.id)}
                                className={cn(
                                  "rounded-md px-2 py-1 text-xs",
                                  item.result === r.id
                                    ? r.id === "bien"
                                      ? "bg-emerald-600 text-white"
                                      : r.id === "danado"
                                        ? "bg-rose-600 text-white"
                                        : "bg-slate-600 text-white"
                                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                                )}
                              >
                                {r.label}
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
                  <div>
                    <h3 className="text-sm font-medium">
                      Simuladores y analizadores usados
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Registra los equipos de prueba utilizados en este servicio
                      (nombre, marca, modelo y número de serie).
                    </p>
                  </div>

                  {(selected.instruments ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Ningún instrumento registrado en esta orden.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {(selected.instruments ?? []).map((inst) => (
                        <li
                          key={inst.id}
                          className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        >
                          <div>
                            <p className="font-medium">
                              {biomedicalInstrumentTypeLabel(inst.instrumentType)}
                              {" · "}
                              {inst.instrumentName || "Sin nombre"}
                            </p>
                            <p className="text-muted-foreground">
                              {[inst.instrumentBrand, inst.instrumentModel]
                                .filter(Boolean)
                                .join(" ")}
                              {inst.instrumentSerial
                                ? ` · Serie ${inst.instrumentSerial}`
                                : " · Sin serie"}
                            </p>
                            {inst.usageNotes ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {inst.usageNotes}
                              </p>
                            ) : null}
                          </div>
                          {canWrite ? (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 text-destructive hover:underline"
                              onClick={() => void onRemoveUsedInstrument(inst.id)}
                            >
                              <Trash2 className="size-3.5" /> Quitar
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}

                  {canWrite ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="block text-sm sm:col-span-2">
                        <span className="mb-1 block text-muted-foreground">
                          Instrumento del catálogo
                        </span>
                        <select
                          className={fieldClass}
                          value={usedInstrumentId}
                          onChange={(e) => setUsedInstrumentId(e.target.value)}
                          disabled={availableInstruments.length === 0}
                        >
                          <option value="">
                            {availableInstruments.length === 0
                              ? "Sin equipos disponibles (alta en Biomédica → Simuladores)"
                              : "Seleccionar simulador / analizador…"}
                          </option>
                          {availableInstruments.map((inst) => (
                            <option key={inst.id} value={inst.id}>
                              {biomedicalInstrumentTypeLabel(inst.instrumentType)} ·{" "}
                              {inst.name}
                              {inst.brand || inst.model
                                ? ` · ${[inst.brand, inst.model].filter(Boolean).join(" ")}`
                                : ""}
                              {inst.serialNumber
                                ? ` · Serie ${inst.serialNumber}`
                                : " · Sin serie"}
                            </option>
                          ))}
                        </select>
                      </label>
                      {usedInstrumentId ? (
                        <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground sm:col-span-2">
                          {(() => {
                            const inst = instrumentsCatalog.find(
                              (i) => i.id === usedInstrumentId
                            );
                            if (!inst) return null;
                            return (
                              <>
                                <p>
                                  <span className="font-medium text-foreground">
                                    Datos del equipo:
                                  </span>{" "}
                                  {inst.name}
                                </p>
                                <p>
                                  Marca/modelo:{" "}
                                  {[inst.brand, inst.model]
                                    .filter(Boolean)
                                    .join(" ") || "—"}
                                </p>
                                <p>Número de serie: {inst.serialNumber || "—"}</p>
                                <p>
                                  Certificado:{" "}
                                  {inst.certificateNumber ||
                                    (inst.certificateUrl ? "PDF anexado" : "—")}
                                  {inst.certificateExpiresAt
                                    ? ` · vig. ${inst.certificateExpiresAt}`
                                    : ""}
                                </p>
                              </>
                            );
                          })()}
                        </div>
                      ) : null}
                      <label className="block text-sm sm:col-span-2">
                        <span className="mb-1 block text-muted-foreground">
                          Notas de uso (opcional)
                        </span>
                        <input
                          className={fieldClass}
                          value={usedInstrumentNotes}
                          onChange={(e) =>
                            setUsedInstrumentNotes(e.target.value)
                          }
                          placeholder="Ej. Prueba de seguridad eléctrica, canal 1"
                        />
                      </label>
                      <div className="sm:col-span-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!usedInstrumentId}
                          onClick={() => void onAddUsedInstrument()}
                        >
                          <Plus className="size-4" /> Agregar instrumento usado
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {detailTab === "servicios" ? (
              <div className="space-y-3">
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Tipo</th>
                        <th className="px-3 py-2">Descripción</th>
                        <th className="px-3 py-2">Cant</th>
                        <th className="px-3 py-2">P. unit.</th>
                        <th className="px-3 py-2">Estatus</th>
                        <th className="px-3 py-2">Importe</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {draftLines.map((line) => (
                        <tr key={line.key} className="border-t border-border">
                          <td className="px-2 py-2">
                            <select
                              className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                              value={line.lineKind}
                              disabled={!canWrite}
                              onChange={(e) =>
                                setDraftLines((rows) =>
                                  rows.map((r) =>
                                    r.key === line.key
                                      ? {
                                          ...r,
                                          lineKind: e.target.value as ServiceLineKind,
                                          productId: null,
                                        }
                                      : r
                                  )
                                )
                              }
                            >
                              {SERVICE_LINE_KINDS.map((k) => (
                                <option key={k.id} value={k.id}>
                                  {k.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <div className="space-y-1">
                              {productsForKind(line.lineKind).length ? (
                                <select
                                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                                  value={line.productId ?? ""}
                                  disabled={!canWrite}
                                  onChange={(e) => {
                                    const product = products.find(
                                      (p) => p.id === e.target.value
                                    );
                                    setDraftLines((rows) =>
                                      rows.map((r) =>
                                        r.key === line.key
                                          ? {
                                              ...r,
                                              productId: e.target.value || null,
                                              description:
                                                product?.name ?? r.description,
                                              unitPrice:
                                                Number(product?.unitPrice ?? r.unitPrice) ||
                                                0,
                                              unit: product?.unit || r.unit,
                                            }
                                          : r
                                      )
                                    );
                                  }}
                                >
                                  <option value="">Catálogo o libre…</option>
                                  {productsForKind(line.lineKind).map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.sku} · {p.name}
                                    </option>
                                  ))}
                                </select>
                              ) : null}
                              <input
                                className="h-9 w-full min-w-[180px] rounded-md border border-input bg-background px-2 text-xs"
                                value={line.description}
                                disabled={!canWrite}
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
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min={0.01}
                              step="any"
                              className="h-9 w-20 rounded-md border border-input bg-background px-2 text-xs"
                              value={line.quantity}
                              disabled={!canWrite}
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
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              className="h-9 w-24 rounded-md border border-input bg-background px-2 text-xs"
                              value={line.unitPrice}
                              disabled={!canWrite}
                              onChange={(e) =>
                                setDraftLines((rows) =>
                                  rows.map((r) =>
                                    r.key === line.key
                                      ? { ...r, unitPrice: Number(e.target.value) }
                                      : r
                                  )
                                )
                              }
                            />
                          </td>
                          <td className="px-2 py-2">
                            <select
                              className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                              value={line.lineStatus}
                              disabled={!canWrite}
                              onChange={(e) =>
                                setDraftLines((rows) =>
                                  rows.map((r) =>
                                    r.key === line.key
                                      ? {
                                          ...r,
                                          lineStatus: e.target
                                            .value as ServiceOrderLineInput["lineStatus"],
                                        }
                                      : r
                                  )
                                )
                              }
                            >
                              {SERVICE_LINE_STATUSES.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {money(lineAmount(line))}
                          </td>
                          <td className="px-2 py-2">
                            {canWrite ? (
                              <button
                                type="button"
                                className="text-destructive"
                                onClick={() =>
                                  setDraftLines((rows) =>
                                    rows.filter((r) => r.key !== line.key)
                                  )
                                }
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {canWrite ? (
                  <div className="flex flex-wrap gap-2">
                    {SERVICE_LINE_KINDS.filter((k) => k.id !== "otro").map((k) => (
                      <Button
                        key={k.id}
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setDraftLines((rows) => [...rows, newDraftLine(k.id)])
                        }
                      >
                        <Plus className="size-3.5" /> {k.label}
                      </Button>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      className="bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                      onClick={() => void saveLines()}
                    >
                      Guardar partidas
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void requestWarehouse()}
                    >
                      <Package className="size-3.5" /> Solicitar a almacén
                    </Button>
                  </div>
                ) : null}
                {orderRequisitions.length ? (
                  <div className="rounded-xl border border-border bg-muted/20 p-3">
                    <p className="mb-2 text-sm font-medium">
                      Solicitudes a almacén
                    </p>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {orderRequisitions.map((req) => (
                        <li key={req.id} className="flex flex-wrap gap-2">
                          <span className="font-medium text-foreground">
                            {req.folio}
                          </span>
                          <span>{requisitionStatusLabel(req.status)}</span>
                          <span>
                            {req.lines.length} línea(s) ·{" "}
                            {new Date(req.requestedAt).toLocaleString("es-MX")}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <a
                      href="/dashboard/almacen?tab=solicitudes"
                      className="mt-2 inline-block text-xs font-medium text-[#3B46A5] hover:underline"
                    >
                      Abrir bandeja de almacén
                    </a>
                  </div>
                ) : null}
                <p className="text-right text-sm font-medium">
                  Total: {money(lineTotals.total)}
                </p>
                <label className="block text-sm">
                  <span className="mb-1 block text-muted-foreground">
                    Notas del servicio (salen en PDF)
                  </span>
                  <textarea
                    className="min-h-16 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    value={form.serviceNotes ?? ""}
                    disabled={!canWrite}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, serviceNotes: e.target.value }))
                    }
                    onBlur={() => {
                      if (canWrite) void saveReceptionFields();
                    }}
                  />
                </label>
              </div>
            ) : null}

            {detailTab === "mensajes" ? (
              <div className="space-y-3">
                {canWrite ? (
                  <div className="space-y-2">
                    <textarea
                      className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Escribe un nuevo mensaje o nota interna…"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                    <Button type="button" onClick={() => void sendNote()}>
                      <MessageSquarePlus className="size-4" /> Enviar
                    </Button>
                  </div>
                ) : null}
                <ul className="space-y-2">
                  {selected.events.map((ev) => (
                    <li
                      key={ev.id}
                      className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    >
                      <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                          {ev.eventType} · {ev.createdBy || "sistema"}
                        </span>
                        <span>{new Date(ev.createdAt).toLocaleString("es-MX")}</span>
                      </div>
                      <p className="mt-1">{ev.message}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {detailTab === "entrega" ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-border p-4">
                  <h3 className="font-medium">Verificación de entrega</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Revisa checklist, evidencia fotográfica y genera el acta para el cliente
                    y calidad.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-sm">
                    <span className="rounded-full bg-muted px-3 py-1">
                      Puntos:{" "}
                      {
                        selected.checklist.filter((c) => c.result !== "pendiente")
                          .length
                      }
                      /{selected.checklist.length}
                    </span>
                    <span className="rounded-full bg-muted px-3 py-1">
                      Imágenes: {selected.images.length}
                    </span>
                    <span className="rounded-full bg-muted px-3 py-1">
                      PDFs seguridad:{" "}
                      {
                        selected.documents.filter(
                          (d) => d.docType === "seguridad_electrica"
                        ).length
                      }
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-medium">
                        Examen de seguridad eléctrica (PDF)
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Adjunta el reporte o certificado en PDF.
                      </p>
                    </div>
                    {canWrite ? (
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm hover:bg-muted">
                        <FileDown className="size-4" />
                        Subir PDF
                        <input
                          type="file"
                          accept="application/pdf,.pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void onUploadSafetyPdf(file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    ) : null}
                  </div>
                  {selected.documents.filter(
                    (d) => d.docType === "seguridad_electrica"
                  ).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Aún no hay PDFs de seguridad eléctrica en esta orden.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {selected.documents
                        .filter((d) => d.docType === "seguridad_electrica")
                        .map((doc) => (
                          <li
                            key={doc.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                          >
                            <div>
                              <a
                                href={doc.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium text-[#3B46A5] hover:underline"
                              >
                                {doc.title || doc.fileName}
                              </a>
                              <p className="text-xs text-muted-foreground">
                                {doc.fileName} ·{" "}
                                {new Date(doc.createdAt).toLocaleString("es-MX")}
                              </p>
                            </div>
                            {canWrite ? (
                              <button
                                type="button"
                                className="text-xs text-destructive hover:underline"
                                onClick={() => void onDeleteDocument(doc.id)}
                              >
                                Eliminar
                              </button>
                            ) : null}
                          </li>
                        ))}
                    </ul>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => downloadServiceDeliveryPdf(selected)}
                  >
                    <FileDown className="size-4" /> Imprimir entrega
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => downloadServiceWorkOrderPdf(selected)}
                  >
                    PDF calidad
                  </Button>
                  {canWrite && selected.status !== "entregado" ? (
                    <Button
                      type="button"
                      className="bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                      onClick={() => void changeStatus("entregado")}
                    >
                      Marcar entregado
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <aside className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div>
              <p className="text-xs text-muted-foreground">No. Orden</p>
              <p className="font-semibold">{selected.folio}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tipo</p>
              <p className="text-sm">{serviceTypeLabel(selected.serviceType)}</p>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Estatus</p>
              <select
                className={fieldClass}
                value={selected.status}
                disabled={!canWrite}
                onChange={(e) =>
                  void changeStatus(e.target.value as ServiceOrderStatus)
                }
              >
                {SERVICE_ORDER_STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Tiempo en estatus: {timeInStatus(selected.updatedAt)}
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(form.authorized)}
                disabled={!canWrite}
                onChange={(e) => {
                  setForm((f) => ({ ...f, authorized: e.target.checked }));
                  if (canWrite) {
                    void updateServiceOrder(selected.id, {
                      ...formFromOrder(selected),
                      authorized: e.target.checked,
                      createdBy: actor,
                      lines: undefined,
                    }).then(reload);
                  }
                }}
              />
              Autorizado por cliente
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(form.underWarranty)}
                disabled={!canWrite}
                onChange={(e) => {
                  setForm((f) => ({ ...f, underWarranty: e.target.checked }));
                  if (canWrite) {
                    void updateServiceOrder(selected.id, {
                      ...formFromOrder(selected),
                      underWarranty: e.target.checked,
                      createdBy: actor,
                      lines: undefined,
                    }).then(reload);
                  }
                }}
              />
              Cubierta por garantía
            </label>
            {selected.priority === "urgente" ? (
              <span className="inline-flex rounded-full bg-rose-600 px-2 py-0.5 text-xs font-medium text-white">
                Urgente
              </span>
            ) : null}
            {selected.underWarranty ? (
              <span className="inline-flex rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">
                Garantía
              </span>
            ) : null}
            <div className="space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
              <p>Recepción: {selected.receptionAt || "—"}</p>
              <p>Promesa: {selected.promisedAt || "—"}</p>
              <p>Creada: {new Date(selected.createdAt).toLocaleString("es-MX")}</p>
              <p>Total: {money(selected.total)}</p>
            </div>
          </aside>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {!canWrite ? <ReadOnlyBanner visible /> : null}
      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Órdenes y cotizaciones de servicio</h2>
          <p className="text-sm text-muted-foreground">
            Equipos médicos · revisión de puntos · evidencias · PDFs
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!canWrite}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => openReception(false)}
          >
            <Wrench className="size-4" /> Recepción
          </Button>
          <Button
            type="button"
            disabled={!canWrite}
            className="bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
            onClick={() => openReception(true)}
          >
            <Plus className="size-4" /> Cotización
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className={cn(fieldClass, "pl-9")}
            placeholder="Buscar orden, cliente, serie…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setStatusFilter("todas")}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium",
            statusFilter === "todas"
              ? "bg-[#3B46A5] text-white"
              : "bg-muted text-muted-foreground"
          )}
        >
          Todas ({orders.length})
        </button>
        {SERVICE_ORDER_STATUSES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStatusFilter(s.id)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              statusFilter === s.id
                ? "bg-[#3B46A5] text-white"
                : "bg-muted text-muted-foreground"
            )}
          >
            {s.label} ({counts[s.id]})
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-3">Cliente</th>
              <th className="px-3 py-3">Equipo</th>
              <th className="px-3 py-3">Partidas</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Identificadores</th>
              <th className="px-3 py-3">Total</th>
              <th className="px-3 py-3">Técnico</th>
              <th className="px-3 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  Cargando…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  No hay órdenes. Usa Recepción para crear la primera.
                </td>
              </tr>
            ) : (
              filtered.map((order) => (
                <tr key={order.id} className="border-t border-border align-top">
                  <td className="px-3 py-3">
                    <p className="font-medium">{order.clientName || "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.contactPhone || order.contactName || "—"}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <p>{order.equipmentName || "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {[order.equipmentBrand, order.equipmentModel, order.equipmentSerial]
                        .filter(Boolean)
                        .join(" · ") || "Sin datos"}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-xs">
                    {order.lines.length
                      ? order.lines
                          .slice(0, 3)
                          .map((l) => serviceLineKindLabel(l.lineKind))
                          .join(", ")
                      : "N/A"}
                    {order.lines.length > 3 ? "…" : ""}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        statusTone(order.status)
                      )}
                    >
                      {serviceOrderStatusLabel(order.status)}
                    </span>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {timeInStatus(order.updatedAt)}
                    </p>
                    {order.priority === "urgente" ? (
                      <span className="mt-1 inline-flex rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        Urgente
                      </span>
                    ) : null}
                    {order.underWarranty ? (
                      <span className="mt-1 ml-1 inline-flex rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        Garantía
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-xs">
                    <button
                      type="button"
                      className="text-[#3B46A5] hover:underline"
                      onClick={() => openDetail(order)}
                    >
                      {order.folio}
                    </button>
                    <p className="text-muted-foreground">
                      {serviceTypeLabel(order.serviceType)}
                    </p>
                  </td>
                  <td className="px-3 py-3">{money(order.total)}</td>
                  <td className="px-3 py-3 text-xs">{order.technician || "—"}</td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      className="text-xs font-medium text-[#3B46A5] hover:underline"
                      onClick={() => openDetail(order)}
                    >
                      Detalles
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
