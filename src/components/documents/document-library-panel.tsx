"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import {
  Check,
  ChevronDown,
  Download,
  ExternalLink,
  File as FileIcon,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  FolderOpen,
  Layers,
  LayoutGrid,
  Link2,
  Loader2,
  MonitorCog,
  Pencil,
  Plus,
  Presentation,
  Search,
  Tag,
  Trash2,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { ModalShell } from "@/components/ui/modal-shell";
import { ReadOnlyBanner } from "@/components/warehouse/read-only-banner";
import { getSession } from "@/lib/auth";
import type { WarehouseModule } from "@/lib/auth/permissions";
import { usePermissions } from "@/lib/auth/use-permissions";
import { mostCommon, normalizeKey } from "@/lib/equipment-grouping";
import { daysUntilExpiry } from "@/lib/inventory/expiry";
import {
  CATALOG_MAX_FILE_BYTES,
  deleteCatalogDocument,
  getCatalogDocuments,
  updateCatalogDocument,
  uploadCatalogDocument,
} from "@/lib/sales-catalog/storage";
import {
  CATALOG_DOC_TYPES,
  CATALOG_TYPES_WITH_VALIDITY,
  catalogDocTypeLabel,
  docTypesForArea,
  fileKind,
  formatFileSize,
  parseTags,
  type CatalogDocType,
  type CatalogDocument,
  type CatalogDocumentInput,
  type DocArea,
  type FileKind,
} from "@/lib/sales-catalog/types";
import { cn } from "@/lib/utils";

type AreaConfig = {
  module: WarehouseModule;
  title: string;
  description: string;
  emptyText: string;
  defaultType: CatalogDocType;
  defaultSort: SortId;
  titlePlaceholder: string;
  versionLabel: string;
  versionPlaceholder: string;
  versionBadge: (version: string) => string;
  tagsPlaceholder: string;
  descriptionPlaceholder: string;
  /** Días antes del vencimiento en que el documento se marca como "por vencer". */
  warnDays: number;
  validitySummary: boolean;
  /** Tipos que cada equipo debería tener; si faltan se ofrecen como acceso rápido. */
  keyTypes: CatalogDocType[];
};

const AREA_CONFIG: Record<DocArea, AreaConfig> = {
  ventas: {
    module: "catalogo_ventas",
    title: "Catálogo de ventas",
    description: "Brochures, folletos y presentaciones para compartir con clientes.",
    emptyText: "Aún no hay brochures, folletos ni presentaciones.",
    defaultType: "brochure",
    defaultSort: "recientes",
    titlePlaceholder: "Ej. Brochure monitores de signos vitales 2026",
    versionLabel: "Versión / edición",
    versionPlaceholder: "Ej. 2026-A, Rev. 3",
    versionBadge: (version) => `v${version.replace(/^v/i, "")}`,
    tagsPlaceholder: "Separadas por coma: UCI, neonatal, licitación",
    descriptionPlaceholder:
      "Notas para el equipo de ventas: qué incluye, para qué cliente sirve, etc.",
    warnDays: 30,
    validitySummary: false,
    keyTypes: ["brochure", "presentacion"],
  },
  biomedica: {
    module: "documentos_tecnicos",
    title: "Documentos técnicos",
    description:
      "Manuales de usuario y de servicio, fichas técnicas, boletines, procedimientos y diagramas de los equipos.",
    emptyText: "Aún no hay manuales ni documentos técnicos.",
    defaultType: "manual_servicio",
    defaultSort: "marca",
    titlePlaceholder: "Ej. Manual de servicio iMEC 10",
    versionLabel: "Versión / revisión",
    versionPlaceholder: "Ej. Rev. 3, software 2.1",
    versionBadge: (version) => `v${version.replace(/^v/i, "")}`,
    tagsPlaceholder: "Separadas por coma: calibración, firmware, desarmado",
    descriptionPlaceholder:
      "Notas para biomédica: versión de software aplicable, capítulos clave, herramientas necesarias, etc.",
    warnDays: 30,
    validitySummary: false,
    keyTypes: ["manual", "manual_servicio", "ficha_tecnica"],
  },
  almacen: {
    module: "registros_sanitarios",
    title: "Registros sanitarios",
    description:
      "Registros sanitarios, prórrogas y certificados de los productos, con control de vigencia.",
    emptyText: "Aún no hay registros sanitarios.",
    defaultType: "registro_sanitario",
    defaultSort: "vigencia",
    titlePlaceholder: "Ej. Registro sanitario monitor iMEC 10",
    versionLabel: "Número de registro / folio",
    versionPlaceholder: "Ej. 1234E2023 SSA",
    versionBadge: (version) => `Reg. ${version}`,
    tagsPlaceholder: "Separadas por coma: COFEPRIS, clase II, licitación",
    descriptionPlaceholder:
      "Titular, fabricante, productos que ampara, observaciones para renovar, etc.",
    warnDays: 90,
    validitySummary: true,
    keyTypes: ["registro_sanitario"],
  },
};

const VALIDITY_FILTERS = [
  { id: "vencidos", label: "Vencidos" },
  { id: "por_vencer", label: "Por vencer" },
  { id: "vigentes", label: "Vigentes" },
  { id: "sin_vigencia", label: "Sin fecha" },
] as const;

type ValidityFilter = (typeof VALIDITY_FILTERS)[number]["id"];

function validityStatus(validUntil: string, warnDays: number): ValidityFilter {
  const days = daysUntilExpiry(validUntil);
  if (days === null) return "sin_vigencia";
  if (days < 0) return "vencidos";
  if (days <= warnDays) return "por_vencer";
  return "vigentes";
}

const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-[#00BFFF]/30";

const FILE_KIND_META: Record<FileKind, { icon: LucideIcon; tone: string; label: string }> = {
  pdf: { icon: FileText, tone: "bg-red-500/10 text-red-600 dark:text-red-300", label: "PDF" },
  image: { icon: FileImage, tone: "bg-sky-500/10 text-sky-600 dark:text-sky-300", label: "Imagen" },
  video: { icon: FileVideo, tone: "bg-violet-500/10 text-violet-600 dark:text-violet-300", label: "Video" },
  sheet: { icon: FileSpreadsheet, tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300", label: "Hoja de cálculo" },
  doc: { icon: FileText, tone: "bg-blue-500/10 text-blue-600 dark:text-blue-300", label: "Documento" },
  slides: { icon: Presentation, tone: "bg-orange-500/10 text-orange-600 dark:text-orange-300", label: "Presentación" },
  other: { icon: FileIcon, tone: "bg-muted text-muted-foreground", label: "Archivo" },
};

const SORTS = [
  { id: "recientes", label: "Más recientes" },
  { id: "titulo", label: "Título (A-Z)" },
  { id: "marca", label: "Marca" },
  { id: "vigencia", label: "Vigencia próxima" },
] as const;

type SortId = (typeof SORTS)[number]["id"];

type FormState = {
  title: string;
  docType: CatalogDocType;
  brand: string;
  productLine: string;
  model: string;
  description: string;
  tags: string;
  version: string;
  validUntil: string;
};

function emptyForm(docType: CatalogDocType): FormState {
  return {
    title: "",
    docType,
    brand: "",
    productLine: "",
    model: "",
    description: "",
    tags: "",
    version: "",
    validUntil: "",
  };
}

function toInput(form: FormState): CatalogDocumentInput {
  return {
    title: form.title,
    docType: form.docType,
    brand: form.brand,
    productLine: form.productLine,
    model: form.model,
    description: form.description,
    tags: parseTags(form.tags),
    version: form.version,
    validUntil: form.validUntil,
  };
}

function docToInput(doc: CatalogDocument): CatalogDocumentInput {
  return {
    title: doc.title,
    docType: doc.docType,
    brand: doc.brand,
    productLine: doc.productLine,
    model: doc.model,
    description: doc.description,
    tags: doc.tags,
    version: doc.version,
    validUntil: doc.validUntil,
  };
}

const NO_EQUIPMENT_KEY = "none";

const TYPE_ORDER = new Map<string, number>(
  CATALOG_DOC_TYPES.map((type, index) => [type.id, index])
);

type GroupKind = "equipo" | "linea" | "marca" | "none";

type EquipmentFields = Pick<CatalogDocument, "brand" | "model" | "productLine">;

/**
 * Con modelo se agrupa por marca + modelo; sin modelo, por línea (documentos
 * generales como brochures de una línea); si no hay nada, en "Sin equipo".
 */
function equipmentKey(fields: EquipmentFields): string {
  const brand = normalizeKey(fields.brand);
  const model = normalizeKey(fields.model);
  if (model) return `equipo:${brand}|${model}`;
  const line = normalizeKey(fields.productLine);
  if (line) return `linea:${brand}|${line}`;
  if (brand) return `marca:${brand}`;
  return NO_EQUIPMENT_KEY;
}

type DocGroup = EquipmentFields & {
  key: string;
  kind: GroupKind;
  title: string;
  subtitle: string;
  docs: CatalogDocument[];
  latest: string;
  earliestValidity: string;
  validity: Record<ValidityFilter, number>;
};

function groupDocuments(docs: CatalogDocument[], sort: SortId, warnDays: number): DocGroup[] {
  const buckets = new Map<string, CatalogDocument[]>();
  for (const doc of docs) {
    const key = equipmentKey(doc);
    buckets.set(key, [...(buckets.get(key) ?? []), doc]);
  }
  const groups = Array.from(buckets.entries()).map(([key, rows]): DocGroup => {
    const kind = key.split(":")[0] as GroupKind;
    const brand = mostCommon(rows.map((row) => row.brand));
    const model = mostCommon(rows.map((row) => row.model));
    const productLine = mostCommon(rows.map((row) => row.productLine));
    const validity: Record<ValidityFilter, number> = {
      vencidos: 0,
      por_vencer: 0,
      vigentes: 0,
      sin_vigencia: 0,
    };
    for (const row of rows) validity[validityStatus(row.validUntil, warnDays)] += 1;
    const dates = rows.map((row) => row.validUntil).filter(Boolean).sort();
    const titleByKind: Record<GroupKind, string> = {
      equipo: [brand, model].filter(Boolean).join(" "),
      linea: productLine,
      marca: brand,
      none: "Sin equipo asignado",
    };
    const subtitleByKind: Record<GroupKind, string> = {
      equipo: productLine,
      linea: [brand, "documentos generales de la línea"].filter(Boolean).join(" · "),
      marca: "Documentos generales de la marca",
      none: "Documentos sin marca, modelo ni línea",
    };
    return {
      key,
      kind,
      brand,
      model,
      productLine,
      title: titleByKind[kind],
      subtitle: subtitleByKind[kind],
      docs: [...rows].sort(
        (a, b) =>
          (TYPE_ORDER.get(a.docType) ?? 99) - (TYPE_ORDER.get(b.docType) ?? 99) ||
          a.title.localeCompare(b.title, "es")
      ),
      latest: rows.reduce((max, row) => (row.createdAt > max ? row.createdAt : max), ""),
      earliestValidity: dates[0] ?? "",
      validity,
    };
  });
  return groups.sort((a, b) => {
    if (a.key === NO_EQUIPMENT_KEY) return 1;
    if (b.key === NO_EQUIPMENT_KEY) return -1;
    if (sort === "recientes") return b.latest.localeCompare(a.latest);
    if (sort === "vigencia") {
      return (a.earliestValidity || "9999").localeCompare(b.earliestValidity || "9999");
    }
    return a.title.localeCompare(b.title, "es");
  });
}

function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function titleFromFile(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}

export function SalesCatalogPanel() {
  return <DocumentLibraryPanel area="ventas" />;
}

export function TechnicalDocumentsPanel() {
  return <DocumentLibraryPanel area="biomedica" />;
}

export function SanitaryRegistrationsPanel() {
  return <DocumentLibraryPanel area="almacen" />;
}

export function DocumentLibraryPanel({ area }: { area: DocArea }) {
  const config = AREA_CONFIG[area];
  const { canCreate, canEdit, canDelete, canExport, canWrite } =
    usePermissions(config.module);
  const [documents, setDocuments] = useState<CatalogDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<CatalogDocType | "all">("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [validityFilter, setValidityFilter] = useState<ValidityFilter | "all">("all");
  const [sort, setSort] = useState<SortId>(config.defaultSort);
  const [view, setView] = useState<"equipos" | "todos">("equipos");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogDocument | null>(null);
  const [formPreset, setFormPreset] = useState<Partial<FormState> | null>(null);
  const [editingGroup, setEditingGroup] = useState<DocGroup | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getCatalogDocuments(area)
      .then((rows) => {
        if (active) setDocuments(rows);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "No se pudieron cargar los documentos.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [area]);

  const validityCounts = useMemo(() => {
    const counts: Record<ValidityFilter, number> = {
      vencidos: 0,
      por_vencer: 0,
      vigentes: 0,
      sin_vigencia: 0,
    };
    for (const doc of documents) counts[validityStatus(doc.validUntil, config.warnDays)] += 1;
    return counts;
  }, [documents, config.warnDays]);

  const brands = useMemo(
    () =>
      Array.from(new Set(documents.map((doc) => doc.brand.trim()).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b, "es")
      ),
    [documents]
  );

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const doc of documents) counts.set(doc.docType, (counts.get(doc.docType) ?? 0) + 1);
    return counts;
  }, [documents]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = documents.filter((doc) => {
      if (typeFilter !== "all" && doc.docType !== typeFilter) return false;
      if (brandFilter !== "all" && doc.brand.trim() !== brandFilter) return false;
      if (
        validityFilter !== "all" &&
        validityStatus(doc.validUntil, config.warnDays) !== validityFilter
      ) {
        return false;
      }
      if (!q) return true;
      return [
        doc.title,
        doc.brand,
        doc.productLine,
        doc.model,
        doc.description,
        doc.version,
        doc.fileName,
        catalogDocTypeLabel(doc.docType),
        ...doc.tags,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
    return [...rows].sort((a, b) => {
      if (sort === "titulo") return a.title.localeCompare(b.title, "es");
      if (sort === "marca") {
        return (a.brand || "~").localeCompare(b.brand || "~", "es") || a.title.localeCompare(b.title, "es");
      }
      if (sort === "vigencia") {
        return (a.validUntil || "9999").localeCompare(b.validUntil || "9999");
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [documents, search, typeFilter, brandFilter, validityFilter, config.warnDays, sort]);

  const groups = useMemo(
    () => groupDocuments(filtered, sort, config.warnDays),
    [filtered, sort, config.warnDays]
  );

  const allGroups = useMemo(
    () => groupDocuments(documents, "titulo", config.warnDays),
    [documents, config.warnDays]
  );

  const imageDocs = useMemo(() => {
    const ordered = view === "equipos" ? groups.flatMap((group) => group.docs) : filtered;
    return ordered.filter((doc) => fileKind(doc) === "image");
  }, [view, groups, filtered]);

  function openCreate(preset?: Partial<FormState>) {
    setEditing(null);
    setFormPreset(preset ?? null);
    setFormOpen(true);
  }

  function openEdit(doc: CatalogDocument) {
    setEditing(doc);
    setFormPreset(null);
    setFormOpen(true);
  }

  function toggleGroup(key: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleGroupSaved(saved: CatalogDocument[], complete: boolean) {
    setDocuments((current) =>
      current.map((doc) => saved.find((item) => item.id === doc.id) ?? doc)
    );
    if (!complete) return;
    setMessage(
      saved.length === 1
        ? "Datos del equipo actualizados."
        : `Datos del equipo actualizados en ${saved.length} documentos.`
    );
    setEditingGroup(null);
  }

  function openDocument(doc: CatalogDocument) {
    if (fileKind(doc) === "image") {
      setPreviewIndex(imageDocs.findIndex((item) => item.id === doc.id));
      return;
    }
    window.open(doc.fileUrl, "_blank", "noopener,noreferrer");
  }

  async function handleDownload(doc: CatalogDocument) {
    try {
      const response = await fetch(doc.fileUrl);
      if (!response.ok) throw new Error();
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = doc.fileName || doc.title;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(doc.fileUrl, "_blank", "noopener,noreferrer");
    }
  }

  async function handleCopyLink(doc: CatalogDocument) {
    try {
      await navigator.clipboard.writeText(doc.fileUrl);
      setCopiedId(doc.id);
      window.setTimeout(() => setCopiedId((current) => (current === doc.id ? null : current)), 1800);
    } catch {
      setError("No se pudo copiar el enlace.");
    }
  }

  async function handleDelete(doc: CatalogDocument) {
    if (!canDelete) return;
    if (!window.confirm(`¿Eliminar "${doc.title}"? El archivo se borrará.`)) return;
    try {
      setError("");
      await deleteCatalogDocument(doc);
      setDocuments((current) => current.filter((item) => item.id !== doc.id));
      setMessage("Documento eliminado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el documento.");
    }
  }

  function handleSaved(saved: CatalogDocument[], wasEdit: boolean) {
    setDocuments((current) => {
      if (wasEdit) {
        return current.map((doc) => saved.find((item) => item.id === doc.id) ?? doc);
      }
      return [...saved, ...current];
    });
    setMessage(
      wasEdit
        ? "Documento actualizado."
        : saved.length === 1
          ? "Documento agregado."
          : `${saved.length} documentos agregados.`
    );
    setFormOpen(false);
    setEditing(null);
    setFormPreset(null);
  }

  const hasFilters =
    search.trim() ||
    typeFilter !== "all" ||
    brandFilter !== "all" ||
    validityFilter !== "all";

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
        message="Tu rol es de consulta: puedes ver y descargar documentos, pero no subir ni editar."
      />

      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{config.title}</h2>
            <p className="text-sm text-muted-foreground">{config.description}</p>
          </div>
          {canCreate ? (
            <Button
              type="button"
              onClick={() => openCreate()}
              className="bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
            >
              <Upload className="size-4" /> Subir documentos
            </Button>
          ) : null}
        </div>

        {config.validitySummary && documents.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 border-b border-border p-4 md:grid-cols-4">
            {VALIDITY_FILTERS.map((item) => (
              <ValiditySummaryCard
                key={item.id}
                status={item.id}
                label={
                  item.id === "por_vencer"
                    ? `Por vencer (≤ ${config.warnDays} días)`
                    : item.label
                }
                count={validityCounts[item.id]}
                active={validityFilter === item.id}
                onClick={() =>
                  setValidityFilter((current) => (current === item.id ? "all" : item.id))
                }
              />
            ))}
          </div>
        ) : null}

        <div className="space-y-3 border-b border-border p-4">
          <div className="grid gap-2 md:grid-cols-[1fr_200px_180px_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por título, marca, modelo, etiqueta…"
                className={cn(fieldClass, "pl-9")}
                aria-label="Buscar documentos"
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
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortId)}
              className={fieldClass}
              aria-label="Ordenar"
            >
              {SORTS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <div
              role="group"
              aria-label="Vista"
              className="inline-flex h-10 rounded-lg border border-input bg-background p-0.5"
            >
              <ViewButton
                active={view === "equipos"}
                onClick={() => setView("equipos")}
                icon={Layers}
                label="Por equipo"
              />
              <ViewButton
                active={view === "todos"}
                onClick={() => setView("todos")}
                icon={LayoutGrid}
                label="Todos"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <TypeChip
              active={typeFilter === "all"}
              onClick={() => setTypeFilter("all")}
              label="Todos"
              count={documents.length}
            />
            {CATALOG_DOC_TYPES.filter((type) => typeCounts.get(type.id)).map((type) => (
              <TypeChip
                key={type.id}
                active={typeFilter === type.id}
                onClick={() => setTypeFilter(type.id)}
                label={type.label}
                count={typeCounts.get(type.id) ?? 0}
              />
            ))}
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando documentos…</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
              <FileText className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {hasFilters ? "Ningún documento coincide con los filtros." : config.emptyText}
              </p>
              {!hasFilters && canCreate ? (
                <Button type="button" variant="outline" onClick={() => openCreate()}>
                  <Upload className="size-4" /> Subir el primero
                </Button>
              ) : null}
            </div>
          ) : view === "equipos" ? (
            <div className="space-y-3">
              {groups.map((group) => (
                <EquipmentGroupCard
                  key={group.key}
                  group={group}
                  config={config}
                  collapsed={collapsed.has(group.key)}
                  copiedId={copiedId}
                  canCreate={canCreate}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  canExport={canExport}
                  onToggle={() => toggleGroup(group.key)}
                  onAdd={(docType) =>
                    openCreate({
                      brand: group.brand,
                      model: group.model,
                      productLine: group.productLine,
                      ...(docType ? { docType } : {}),
                    })
                  }
                  onEditGroup={() => setEditingGroup(group)}
                  onOpen={openDocument}
                  onDownload={(doc) => void handleDownload(doc)}
                  onCopy={(doc) => void handleCopyLink(doc)}
                  onEdit={openEdit}
                  onDelete={(doc) => void handleDelete(doc)}
                />
              ))}
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((doc) => (
                <CatalogCard
                  key={doc.id}
                  doc={doc}
                  config={config}
                  copied={copiedId === doc.id}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  canExport={canExport}
                  onOpen={() => openDocument(doc)}
                  onDownload={() => void handleDownload(doc)}
                  onCopy={() => void handleCopyLink(doc)}
                  onEdit={() => openEdit(doc)}
                  onDelete={() => void handleDelete(doc)}
                />
              ))}
            </ul>
          )}
          {!loading && filtered.length > 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {filtered.length} de {documents.length} documentos
              {view === "equipos"
                ? ` · ${groups.length} ${groups.length === 1 ? "grupo" : "grupos"}`
                : ""}
            </p>
          ) : null}
        </div>
      </section>

      {formOpen ? (
        <CatalogDocumentForm
          area={area}
          config={config}
          editing={editing}
          preset={formPreset}
          brands={brands}
          groups={allGroups}
          onCancel={() => {
            setFormOpen(false);
            setEditing(null);
            setFormPreset(null);
          }}
          onSaved={handleSaved}
        />
      ) : null}

      {editingGroup ? (
        <EquipmentForm
          group={editingGroup}
          brands={brands}
          onCancel={() => setEditingGroup(null)}
          onSaved={handleGroupSaved}
        />
      ) : null}

      {previewIndex != null && imageDocs[previewIndex] ? (
        <ImageLightbox
          images={imageDocs.map((doc) => ({
            src: doc.fileUrl,
            alt: doc.title,
            caption: `${doc.title} · ${catalogDocTypeLabel(doc.docType)}`,
          }))}
          index={previewIndex}
          onClose={() => setPreviewIndex(null)}
          onIndexChange={setPreviewIndex}
        />
      ) : null}
    </div>
  );
}

function TypeChip({
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

function ViewButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors",
        active
          ? "bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

const GROUP_ICONS: Record<GroupKind, LucideIcon> = {
  equipo: MonitorCog,
  linea: Tag,
  marca: Tag,
  none: FolderOpen,
};

const GROUP_VALIDITY_LABELS: Partial<Record<ValidityFilter, [string, string]>> = {
  vencidos: ["vencido", "vencidos"],
  por_vencer: ["por vencer", "por vencer"],
};

function EquipmentGroupCard({
  group,
  config,
  collapsed,
  copiedId,
  canCreate,
  canEdit,
  canDelete,
  canExport,
  onToggle,
  onAdd,
  onEditGroup,
  onOpen,
  onDownload,
  onCopy,
  onEdit,
  onDelete,
}: {
  group: DocGroup;
  config: AreaConfig;
  collapsed: boolean;
  copiedId: string | null;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  onToggle: () => void;
  onAdd: (docType?: CatalogDocType) => void;
  onEditGroup: () => void;
  onOpen: (doc: CatalogDocument) => void;
  onDownload: (doc: CatalogDocument) => void;
  onCopy: (doc: CatalogDocument) => void;
  onEdit: (doc: CatalogDocument) => void;
  onDelete: (doc: CatalogDocument) => void;
}) {
  const Icon = GROUP_ICONS[group.kind];
  const present = new Set<string>(group.docs.map((doc) => doc.docType));
  const missing =
    group.kind === "equipo" ? config.keyTypes.filter((type) => !present.has(type)) : [];
  const alerts = config.validitySummary
    ? (Object.keys(GROUP_VALIDITY_LABELS) as ValidityFilter[]).filter(
        (status) => group.validity[status] > 0
      )
    : [];
  const count = group.docs.length;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl",
              group.kind === "none"
                ? "bg-muted text-muted-foreground"
                : "bg-[#3B46A5]/10 text-[#3B46A5] dark:text-sky-300"
            )}
          >
            <Icon className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{group.title}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {[group.subtitle, `${count} ${count === 1 ? "documento" : "documentos"}`]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
          {alerts.map((status) => {
            const [one, many] = GROUP_VALIDITY_LABELS[status]!;
            const n = group.validity[status];
            return (
              <span
                key={status}
                className={cn(
                  "hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline",
                  VALIDITY_TONES[status]
                )}
              >
                {n} {n === 1 ? one : many}
              </span>
            );
          })}
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              collapsed ? "-rotate-90" : "rotate-0"
            )}
          />
        </button>
        {canEdit && group.kind !== "none" ? (
          <IconAction label="Editar datos del equipo" onClick={onEditGroup} icon={Pencil} />
        ) : null}
        {canCreate ? (
          <IconAction
            label={group.kind === "none" ? "Agregar documento" : "Agregar documento a este grupo"}
            onClick={() => onAdd()}
            icon={Plus}
          />
        ) : null}
      </div>

      {!collapsed ? (
        <>
          <ul className="divide-y divide-border border-t border-border">
            {group.docs.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                config={config}
                copied={copiedId === doc.id}
                canEdit={canEdit}
                canDelete={canDelete}
                canExport={canExport}
                onOpen={() => onOpen(doc)}
                onDownload={() => onDownload(doc)}
                onCopy={() => onCopy(doc)}
                onEdit={() => onEdit(doc)}
                onDelete={() => onDelete(doc)}
              />
            ))}
          </ul>
          {canCreate && missing.length ? (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-dashed border-border bg-muted/30 px-3 py-2">
              <span className="text-xs text-muted-foreground">Falta:</span>
              {missing.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => onAdd(type)}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#3B46A5]/40 px-2.5 py-0.5 text-xs font-medium text-[#3B46A5] hover:bg-[#3B46A5]/10 dark:text-sky-300"
                >
                  <Plus className="size-3" />
                  {catalogDocTypeLabel(type)}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function DocumentRow({
  doc,
  config,
  copied,
  canEdit,
  canDelete,
  canExport,
  onOpen,
  onDownload,
  onCopy,
  onEdit,
  onDelete,
}: {
  doc: CatalogDocument;
  config: AreaConfig;
  copied: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  onOpen: () => void;
  onDownload: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const kind = fileKind(doc);
  const meta = FILE_KIND_META[kind];
  const Icon = meta.icon;

  return (
    <li className="flex items-center gap-2 px-3 py-2.5">
      <button
        type="button"
        onClick={onOpen}
        className="group flex min-w-0 flex-1 items-center gap-3 text-left"
        aria-label={`Abrir ${doc.title}`}
        title={doc.description || doc.title}
      >
        {kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={doc.fileUrl} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", meta.tone)}>
            <Icon className="size-5" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium group-hover:underline">
            {doc.title}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1">
            <span className="rounded-full bg-[#00BFFF]/10 px-2 py-0.5 text-[11px] font-medium text-[#007bb0] dark:text-sky-300">
              {catalogDocTypeLabel(doc.docType)}
            </span>
            {doc.version ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {config.versionBadge(doc.version)}
              </span>
            ) : null}
            <ValidityBadge validUntil={doc.validUntil} warnDays={config.warnDays} />
            <span className="text-[11px] text-muted-foreground">
              {meta.label} · {formatFileSize(doc.fileSize)}
            </span>
          </span>
        </span>
      </button>
      <div className="flex shrink-0 items-center">
        {canExport ? <IconAction label="Descargar" onClick={onDownload} icon={Download} /> : null}
        <IconAction
          label={copied ? "Enlace copiado" : "Copiar enlace para compartir"}
          onClick={onCopy}
          icon={copied ? Check : Link2}
          className={copied ? "text-emerald-600" : undefined}
        />
        {canEdit ? <IconAction label="Editar datos" onClick={onEdit} icon={Pencil} /> : null}
        {canDelete ? (
          <IconAction
            label="Eliminar"
            onClick={onDelete}
            icon={Trash2}
            className="text-destructive hover:bg-destructive/10"
          />
        ) : null}
      </div>
    </li>
  );
}

function EquipmentForm({
  group,
  brands,
  onCancel,
  onSaved,
}: {
  group: DocGroup;
  brands: string[];
  onCancel: () => void;
  /** `complete` es falso si falló a medias: se reflejan los guardados y el modal sigue abierto. */
  onSaved: (saved: CatalogDocument[], complete: boolean) => void;
}) {
  const [brand, setBrand] = useState(group.brand);
  const [model, setModel] = useState(group.model);
  const [productLine, setProductLine] = useState(group.productLine);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const spellings = new Set(
    group.docs.map((doc) => `${doc.brand.trim()}|${doc.model.trim()}|${doc.productLine.trim()}`)
  ).size;
  const count = group.docs.length;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!brand.trim() && !model.trim() && !productLine.trim()) {
      setError("Captura al menos la marca, el modelo o la línea.");
      return;
    }
    setError("");
    setSubmitting(true);
    const saved: CatalogDocument[] = [];
    try {
      for (const doc of group.docs) {
        saved.push(
          await updateCatalogDocument(doc.id, { ...docToInput(doc), brand, model, productLine })
        );
      }
      onSaved(saved, true);
    } catch (err) {
      if (saved.length) onSaved(saved, false);
      setError(
        `${err instanceof Error ? err.message : "No se pudo guardar."} Se actualizaron ${saved.length} de ${count}; vuelve a intentarlo.`
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell
      title="Editar datos del equipo"
      description={`Se aplicará a ${count === 1 ? "el documento" : `los ${count} documentos`} de "${group.title}".`}
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
      <form onSubmit={onSubmit} className="space-y-4">
        {spellings > 1 ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            Los documentos tienen escrituras distintas de marca, modelo o línea. Al guardar quedarán
            todos iguales.
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Marca</span>
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              list="equipment-brands"
              className={fieldClass}
            />
            <datalist id="equipment-brands">
              {brands.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Modelo</span>
            <input value={model} onChange={(e) => setModel(e.target.value)} className={fieldClass} />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-medium">Línea / categoría</span>
            <input
              value={productLine}
              onChange={(e) => setProductLine(e.target.value)}
              className={fieldClass}
            />
          </label>
        </div>
        {error ? (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Guardar en {count} {count === 1 ? "documento" : "documentos"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

const VALIDITY_TONES: Record<ValidityFilter, string> = {
  vencidos: "bg-destructive/10 text-destructive",
  por_vencer: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  vigentes: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  sin_vigencia: "bg-muted text-muted-foreground",
};

function ValidityBadge({ validUntil, warnDays }: { validUntil: string; warnDays: number }) {
  const days = daysUntilExpiry(validUntil);
  if (days === null) return null;
  const status = validityStatus(validUntil, warnDays);
  const text =
    days < 0
      ? `Vencido ${formatDate(validUntil)}`
      : status === "por_vencer"
        ? `Vence en ${days} día${days === 1 ? "" : "s"}`
        : `Vigente al ${formatDate(validUntil)}`;
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", VALIDITY_TONES[status])}>
      {text}
    </span>
  );
}

function ValiditySummaryCard({
  status,
  label,
  count,
  active,
  onClick,
}: {
  status: ValidityFilter;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-xl border px-3 py-2 text-left transition-colors",
        active ? "border-[#00BFFF] ring-2 ring-[#00BFFF]/25" : "border-border hover:bg-muted/60"
      )}
    >
      <span className={cn("inline-block rounded-full px-2 py-0.5 text-[11px] font-medium", VALIDITY_TONES[status])}>
        {label}
      </span>
      <span className="mt-1 block text-2xl font-semibold tabular-nums">{count}</span>
    </button>
  );
}

function CatalogCard({
  doc,
  config,
  copied,
  canEdit,
  canDelete,
  canExport,
  onOpen,
  onDownload,
  onCopy,
  onEdit,
  onDelete,
}: {
  doc: CatalogDocument;
  config: AreaConfig;
  copied: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  onOpen: () => void;
  onDownload: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const kind = fileKind(doc);
  const meta = FILE_KIND_META[kind];
  const Icon = meta.icon;
  const product = [doc.brand, doc.model, doc.productLine].filter(Boolean).join(" · ");

  return (
    <li className="flex flex-col overflow-hidden rounded-xl border border-border bg-background transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={onOpen}
        className="group relative flex h-32 items-center justify-center overflow-hidden bg-muted/40"
        aria-label={`Abrir ${doc.title}`}
      >
        {kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={doc.fileUrl}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <span className={cn("flex size-16 items-center justify-center rounded-2xl", meta.tone)}>
            <Icon className="size-8" />
          </span>
        )}
        <span className="absolute top-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white">
          {catalogDocTypeLabel(doc.docType)}
        </span>
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-sm font-medium text-white opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">
          <ExternalLink className="mr-1.5 size-4" /> {kind === "image" ? "Ampliar" : "Abrir"}
        </span>
      </button>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div>
          <h3 className="line-clamp-2 text-sm font-semibold" title={doc.title}>
            {doc.title}
          </h3>
          {product ? <p className="truncate text-xs text-muted-foreground">{product}</p> : null}
        </div>
        {doc.description ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{doc.description}</p>
        ) : null}
        <div className="flex flex-wrap gap-1">
          {doc.version ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {config.versionBadge(doc.version)}
            </span>
          ) : null}
          <ValidityBadge validUntil={doc.validUntil} warnDays={config.warnDays} />
          {doc.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-[#3B46A5]/10 px-2 py-0.5 text-[11px] text-[#3B46A5] dark:text-sky-300"
            >
              #{tag}
            </span>
          ))}
        </div>
        <p className="mt-auto text-[11px] text-muted-foreground">
          {meta.label} · {formatFileSize(doc.fileSize)} · {formatDate(doc.createdAt)}
          {doc.uploadedBy ? ` · ${doc.uploadedBy}` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-1 border-t border-border pt-2">
          {canExport ? (
            <IconAction label="Descargar" onClick={onDownload} icon={Download} />
          ) : null}
          <IconAction
            label={copied ? "Enlace copiado" : "Copiar enlace para compartir"}
            onClick={onCopy}
            icon={copied ? Check : Link2}
            className={copied ? "text-emerald-600" : undefined}
          />
          <span className="flex-1" />
          {canEdit ? <IconAction label="Editar datos" onClick={onEdit} icon={Pencil} /> : null}
          {canDelete ? (
            <IconAction
              label="Eliminar"
              onClick={onDelete}
              icon={Trash2}
              className="text-destructive hover:bg-destructive/10"
            />
          ) : null}
        </div>
      </div>
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
        "inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground",
        className
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

function CatalogDocumentForm({
  area,
  config,
  editing,
  preset,
  brands,
  groups,
  onCancel,
  onSaved,
}: {
  area: DocArea;
  config: AreaConfig;
  editing: CatalogDocument | null;
  preset: Partial<FormState> | null;
  brands: string[];
  groups: DocGroup[];
  onCancel: () => void;
  onSaved: (saved: CatalogDocument[], wasEdit: boolean) => void;
}) {
  const [form, setForm] = useState<FormState>(() =>
    editing
      ? {
          title: editing.title,
          docType: editing.docType,
          brand: editing.brand,
          productLine: editing.productLine,
          model: editing.model,
          description: editing.description,
          tags: editing.tags.join(", "),
          version: editing.version,
          validUntil: editing.validUntil,
        }
      : { ...emptyForm(config.defaultType), ...preset }
  );
  const equipmentOptions = useMemo(
    () => groups.filter((group) => group.kind !== "none"),
    [groups]
  );
  const models = useMemo(
    () =>
      Array.from(
        new Set(groups.filter((group) => group.kind === "equipo").map((group) => group.model))
      ).sort((a, b) => a.localeCompare(b, "es")),
    [groups]
  );
  const currentEquipmentKey = equipmentKey(form);
  const selectedEquipment = equipmentOptions.some((group) => group.key === currentEquipmentKey)
    ? currentEquipmentKey
    : "";

  function selectEquipment(key: string) {
    const group = equipmentOptions.find((item) => item.key === key);
    setForm((current) => ({
      ...current,
      brand: group?.brand ?? "",
      model: group?.model ?? "",
      productLine: group?.productLine ?? "",
    }));
  }
  const typeOptions = useMemo(() => {
    const options: { id: CatalogDocType; label: string }[] = [...docTypesForArea(area)];
    if (editing && !options.some((type) => type.id === editing.docType)) {
      options.unshift({ id: editing.docType, label: catalogDocTypeLabel(editing.docType) });
    }
    return options;
  }, [area, editing]);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const showValidity =
    CATALOG_TYPES_WITH_VALIDITY.includes(form.docType) || Boolean(form.validUntil);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list);
    const tooBig = incoming.filter((file) => file.size > CATALOG_MAX_FILE_BYTES);
    const accepted = incoming.filter((file) => file.size <= CATALOG_MAX_FILE_BYTES);
    setError(
      tooBig.length
        ? `Se omitieron ${tooBig.length} archivo(s) de más de 50 MB: ${tooBig.map((f) => f.name).join(", ")}`
        : ""
    );
    const next = [...files];
    for (const file of accepted) {
      if (!next.some((f) => f.name === file.name && f.size === file.size)) next.push(file);
    }
    setFiles(next);
    if (next.length === 1 && !form.title.trim()) update("title", titleFromFile(next[0].name));
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!editing && files.length === 0) {
      setError("Elige al menos un archivo.");
      return;
    }
    if (editing && !form.title.trim()) {
      setError("El título es obligatorio.");
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        onSaved([await updateCatalogDocument(editing.id, toInput(form))], true);
        return;
      }
      const session = getSession();
      const uploadedBy = session?.fullName || session?.username || "";
      const saved: CatalogDocument[] = [];
      for (const [index, file] of files.entries()) {
        setProgress(`Subiendo ${index + 1} de ${files.length}: ${file.name}`);
        const title =
          files.length === 1 && form.title.trim() ? form.title : titleFromFile(file.name);
        saved.push(
          await uploadCatalogDocument({ ...toInput(form), area, title, file, uploadedBy })
        );
      }
      onSaved(saved, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el documento.");
    } finally {
      setSubmitting(false);
      setProgress("");
    }
  }

  const multiple = files.length > 1;

  return (
    <ModalShell
      title={editing ? "Editar documento" : `Subir documentos · ${config.title}`}
      description={
        editing
          ? `${editing.fileName} · ${formatFileSize(editing.fileSize)}`
          : "PDF, imágenes, Office o video, hasta 50 MB por archivo. Puedes subir varios a la vez."
      }
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
      <form onSubmit={onSubmit} className="space-y-4">
        {!editing ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "rounded-xl border-2 border-dashed p-5 text-center transition-colors",
              dragging ? "border-[#00BFFF] bg-[#00BFFF]/5" : "border-border"
            )}
          >
            <Upload className="mx-auto mb-2 size-7 text-[#3B46A5]" />
            <p className="text-sm font-medium">Arrastra los archivos aquí</p>
            <p className="mb-3 text-xs text-muted-foreground">o</p>
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              Elegir archivos
            </Button>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              accept="application/pdf,image/*,video/*,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.odt,.ods,.odp,.txt,.zip"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            {files.length ? (
              <ul className="mt-4 space-y-1.5 text-left">
                {files.map((file) => (
                  <li
                    key={`${file.name}-${file.size}`}
                    className="flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-1.5 text-xs"
                  >
                    <span className="min-w-0 truncate">{file.name}</span>
                    <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                      {formatFileSize(file.size)}
                      <button
                        type="button"
                        onClick={() => setFiles((current) => current.filter((f) => f !== file))}
                        className="rounded p-0.5 hover:bg-muted hover:text-destructive"
                        aria-label={`Quitar ${file.name}`}
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-medium">
              Título{multiple ? " (se usará el nombre de cada archivo)" : ""}
            </span>
            <input
              value={multiple ? "" : form.title}
              onChange={(e) => update("title", e.target.value)}
              disabled={multiple}
              placeholder={multiple ? "Automático por archivo" : config.titlePlaceholder}
              className={fieldClass}
            />
          </label>
          {equipmentOptions.length ? (
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-sm font-medium">Equipo</span>
              <select
                value={selectedEquipment}
                onChange={(e) => selectEquipment(e.target.value)}
                className={fieldClass}
              >
                <option value="">
                  {selectedEquipment || currentEquipmentKey === NO_EQUIPMENT_KEY
                    ? "Nuevo equipo o sin equipo (capturar abajo)"
                    : "Nuevo equipo (datos capturados abajo)"}
                </option>
                {equipmentOptions.map((group) => (
                  <option key={group.key} value={group.key}>
                    {group.title}
                    {group.kind === "equipo" && group.productLine ? ` · ${group.productLine}` : ""}
                    {` (${group.docs.length})`}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-muted-foreground">
                Elige un equipo existente para agrupar el documento con los demás, o captura marca y
                modelo nuevos.
              </span>
            </label>
          ) : null}
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Tipo de documento</span>
            <select
              value={form.docType}
              onChange={(e) => update("docType", e.target.value as CatalogDocType)}
              className={fieldClass}
            >
              {typeOptions.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Marca</span>
            <input
              value={form.brand}
              onChange={(e) => update("brand", e.target.value)}
              list="catalog-brands"
              placeholder="Ej. Mindray, Philips…"
              className={fieldClass}
            />
            <datalist id="catalog-brands">
              {brands.map((brand) => (
                <option key={brand} value={brand} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Modelo</span>
            <input
              value={form.model}
              onChange={(e) => update("model", e.target.value)}
              list="catalog-models"
              placeholder="Ej. iMEC 10"
              className={fieldClass}
            />
            <datalist id="catalog-models">
              {models.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Línea / categoría</span>
            <input
              value={form.productLine}
              onChange={(e) => update("productLine", e.target.value)}
              placeholder="Ej. Monitoreo, Anestesia, Consumibles"
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{config.versionLabel}</span>
            <input
              value={form.version}
              onChange={(e) => update("version", e.target.value)}
              placeholder={config.versionPlaceholder}
              className={fieldClass}
            />
          </label>
          {showValidity ? (
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Vigente hasta</span>
              <input
                type="date"
                value={form.validUntil}
                onChange={(e) => update("validUntil", e.target.value)}
                className={fieldClass}
              />
            </label>
          ) : null}
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-medium">Etiquetas</span>
            <input
              value={form.tags}
              onChange={(e) => update("tags", e.target.value)}
              placeholder={config.tagsPlaceholder}
              className={fieldClass}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-medium">Descripción</span>
            <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={3}
              placeholder={config.descriptionPlaceholder}
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
          {progress ? <p className="mr-auto text-xs text-muted-foreground">{progress}</p> : null}
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {editing
              ? "Guardar cambios"
              : files.length > 1
                ? `Subir ${files.length} documentos`
                : "Subir documento"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
