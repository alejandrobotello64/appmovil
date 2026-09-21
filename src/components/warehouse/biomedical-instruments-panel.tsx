"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Camera,
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReadOnlyBanner } from "@/components/warehouse/read-only-banner";
import { getSession } from "@/lib/auth";
import { usePermissions } from "@/lib/auth/use-permissions";
import {
  clearBiomedicalInstrumentCertificate,
  clearBiomedicalInstrumentImage,
  createBiomedicalInstrument,
  deleteBiomedicalInstrument,
  getBiomedicalInstruments,
  updateBiomedicalInstrument,
  uploadBiomedicalInstrumentCertificate,
  uploadBiomedicalInstrumentImage,
} from "@/lib/biomedical-instruments/storage";
import {
  BIOMEDICAL_INSTRUMENT_TYPES,
  biomedicalInstrumentTypeLabel,
  type BiomedicalInstrument,
  type BiomedicalInstrumentInput,
  type BiomedicalInstrumentType,
} from "@/lib/biomedical-instruments/types";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none";

function emptyForm(): BiomedicalInstrumentInput {
  return {
    instrumentType: "seguridad_electrica",
    name: "",
    brand: "",
    model: "",
    serialNumber: "",
    assetTag: "",
    location: "",
    notes: "",
    certificateNumber: "",
    certificateExpiresAt: "",
    isActive: true,
  };
}

export function BiomedicalInstrumentsPanel() {
  const { canWrite } = usePermissions("ordenes_servicio");
  const [items, setItems] = useState<BiomedicalInstrument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<
    BiomedicalInstrumentType | "todos"
  >("todos");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BiomedicalInstrument | null>(null);
  const [form, setForm] = useState<BiomedicalInstrumentInput>(emptyForm);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingPdf, setPendingPdf] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const imageRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const actor = getSession()?.username ?? "usuario";

  async function reload() {
    setLoading(true);
    setError("");
    try {
      setItems(await getBiomedicalInstruments({ includeInactive: true }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudieron cargar equipos."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    if (!pendingImage) return;
    const url = URL.createObjectURL(pendingImage);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingImage]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchesType =
        typeFilter === "todos" || item.instrumentType === typeFilter;
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        [
          item.name,
          item.brand,
          item.model,
          item.serialNumber,
          item.assetTag,
          item.certificateNumber,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      return matchesType && matchesQuery;
    });
  }, [items, query, typeFilter]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setPendingImage(null);
    setPendingPdf(null);
    setImagePreview("");
    setFormOpen(true);
  }

  function openEdit(item: BiomedicalInstrument) {
    setEditing(item);
    setForm({
      instrumentType: item.instrumentType,
      name: item.name,
      brand: item.brand,
      model: item.model,
      serialNumber: item.serialNumber,
      assetTag: item.assetTag,
      location: item.location,
      notes: item.notes,
      certificateNumber: item.certificateNumber,
      certificateExpiresAt: item.certificateExpiresAt,
      isActive: item.isActive,
    });
    setPendingImage(null);
    setPendingPdf(null);
    setImagePreview(item.imageUrl || "");
    setFormOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    try {
      setError("");
      let saved: BiomedicalInstrument;
      if (editing) {
        saved = await updateBiomedicalInstrument(editing.id, form);
      } else {
        saved = await createBiomedicalInstrument({
          ...form,
          createdBy: actor,
        });
      }
      if (pendingImage) {
        saved = await uploadBiomedicalInstrumentImage(saved.id, pendingImage);
      }
      if (pendingPdf) {
        saved = await uploadBiomedicalInstrumentCertificate(
          saved.id,
          pendingPdf
        );
      }
      setFormOpen(false);
      setEditing(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    }
  }

  async function onDelete(item: BiomedicalInstrument) {
    if (!canWrite) return;
    if (!confirm(`¿Eliminar «${item.name}»?`)) return;
    try {
      await deleteBiomedicalInstrument(item.id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  }

  async function onUploadImage(item: BiomedicalInstrument, file: File) {
    if (!canWrite) return;
    try {
      await uploadBiomedicalInstrumentImage(item.id, file);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir imagen.");
    }
  }

  async function onUploadPdf(item: BiomedicalInstrument, file: File) {
    if (!canWrite) return;
    try {
      await uploadBiomedicalInstrumentCertificate(item.id, file);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir PDF.");
    }
  }

  if (formOpen) {
    return (
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        {!canWrite ? <ReadOnlyBanner visible /> : null}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#3B46A5]">
              {editing ? "Editar equipo" : "Alta de equipo biomédico"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Seguridad eléctrica, simuladores y analizadores con foto y PDF de
              certificación.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setFormOpen(false)}
          >
            Regresar
          </Button>
        </div>

        {error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-wrap items-start gap-4 rounded-xl border border-border bg-muted/20 p-3 sm:col-span-2">
            <div className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background">
              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagePreview}
                  alt="Vista previa"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="px-2 text-center text-xs text-muted-foreground">
                  Sin foto
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-sm font-medium">Foto y certificación</p>
              <input
                ref={imageRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setPendingImage(file);
                  if (!file && editing?.imageUrl) {
                    setImagePreview(editing.imageUrl);
                  }
                  e.target.value = "";
                }}
              />
              <input
                ref={pdfRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  setPendingPdf(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => imageRef.current?.click()}
                >
                  <Camera className="size-4" /> Elegir foto
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => pdfRef.current?.click()}
                >
                  <FileText className="size-4" /> PDF certificación
                </Button>
              </div>
              {pendingPdf ? (
                <p className="text-xs text-muted-foreground">
                  PDF listo: {pendingPdf.name}
                </p>
              ) : editing?.certificateName ? (
                <p className="text-xs text-muted-foreground">
                  Certificado actual: {editing.certificateName}
                </p>
              ) : null}
            </div>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Tipo</span>
            <select
              className={fieldClass}
              value={form.instrumentType}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  instrumentType: e.target.value as BiomedicalInstrumentType,
                }))
              }
            >
              {BIOMEDICAL_INSTRUMENT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Nombre</span>
            <input
              required
              className={fieldClass}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ej. Analizador Fluke ESA615"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Marca</span>
            <input
              className={fieldClass}
              value={form.brand ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Modelo</span>
            <input
              className={fieldClass}
              value={form.model ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">
              Número de serie
            </span>
            <input
              required
              className={fieldClass}
              value={form.serialNumber ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, serialNumber: e.target.value }))
              }
              placeholder="Obligatorio"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">
              Placa / asset tag
            </span>
            <input
              className={fieldClass}
              value={form.assetTag ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, assetTag: e.target.value }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Ubicación</span>
            <input
              className={fieldClass}
              value={form.location ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, location: e.target.value }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">
              No. certificado
            </span>
            <input
              className={fieldClass}
              value={form.certificateNumber ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, certificateNumber: e.target.value }))
              }
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">
              Vigencia del certificado
            </span>
            <input
              type="date"
              className={fieldClass}
              value={form.certificateExpiresAt ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  certificateExpiresAt: e.target.value,
                }))
              }
            />
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(form.isActive)}
              onChange={(e) =>
                setForm((f) => ({ ...f, isActive: e.target.checked }))
              }
            />
            Activo / disponible para órdenes
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted-foreground">Notas</span>
            <textarea
              className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              value={form.notes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormOpen(false)}
            >
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

  return (
    <section className="space-y-4">
      {!canWrite ? <ReadOnlyBanner visible /> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#3B46A5]">
            Simuladores y analizadores
          </h2>
          <p className="text-sm text-muted-foreground">
            Alta de equipos de seguridad eléctrica, simuladores y analizadores.
            Captura nombre, serie, foto y PDF de certificación.
          </p>
        </div>
        {canWrite ? (
          <Button
            type="button"
            onClick={openCreate}
            className="bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
          >
            <Plus className="size-4" /> Nuevo equipo
          </Button>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className={cn(fieldClass, "pl-9")}
            placeholder="Buscar por nombre, serie, certificado…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          className={cn(fieldClass, "w-auto")}
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(e.target.value as BiomedicalInstrumentType | "todos")
          }
        >
          <option value="todos">Todos los tipos</option>
          {BIOMEDICAL_INSTRUMENT_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No hay equipos registrados. Usa «Nuevo equipo» para dar de alta el
          primero.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <article
              key={item.id}
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
            >
              <div className="aspect-[4/3] bg-muted/30">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    Sin foto
                  </div>
                )}
              </div>
              <div className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {biomedicalInstrumentTypeLabel(item.instrumentType)}
                      {!item.isActive ? " · Inactivo" : ""}
                    </p>
                    <h3 className="font-medium">{item.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {[item.brand, item.model].filter(Boolean).join(" ")}
                      {item.serialNumber ? ` · Serie ${item.serialNumber}` : ""}
                    </p>
                  </div>
                </div>
                {item.certificateUrl ? (
                  <a
                    href={item.certificateUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[#3B46A5] hover:underline"
                  >
                    <FileText className="size-3.5" />
                    {item.certificateName || "Ver certificado PDF"}
                    {item.certificateExpiresAt
                      ? ` · vig. ${item.certificateExpiresAt}`
                      : ""}
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Sin PDF de certificación
                  </p>
                )}
                {canWrite ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(item)}
                    >
                      <Pencil className="size-3.5" /> Editar
                    </Button>
                    <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-input px-2.5 py-1.5 text-xs hover:bg-muted">
                      <Camera className="size-3.5" /> Foto
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void onUploadImage(item, file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-input px-2.5 py-1.5 text-xs hover:bg-muted">
                      <FileText className="size-3.5" /> PDF
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void onUploadPdf(item, file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {item.imageUrl ? (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:underline"
                        onClick={() =>
                          void clearBiomedicalInstrumentImage(item.id).then(
                            reload
                          )
                        }
                      >
                        Quitar foto
                      </button>
                    ) : null}
                    {item.certificateUrl ? (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:underline"
                        onClick={() =>
                          void clearBiomedicalInstrumentCertificate(
                            item.id
                          ).then(reload)
                        }
                      >
                        Quitar PDF
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"
                      onClick={() => void onDelete(item)}
                    >
                      <Trash2 className="size-3.5" /> Eliminar
                    </button>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
