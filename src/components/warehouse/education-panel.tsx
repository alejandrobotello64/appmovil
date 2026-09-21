"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Camera,
  GraduationCap,
  Pencil,
  Plus,
  Printer,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DesktopTable,
  ResponsiveDataList,
} from "@/components/ui/responsive-data-list";
import { ReadOnlyBanner } from "@/components/warehouse/read-only-banner";
import { getSession } from "@/lib/auth";
import { usePermissions } from "@/lib/auth/use-permissions";
import { downloadTrainingPdf } from "@/lib/education/pdf";
import {
  addTrainingAttendee,
  clearAttendeeSignature,
  createEducationTraining,
  deleteEducationTraining,
  deleteTrainingAttendee,
  deleteTrainingPhoto,
  getEducationTrainings,
  updateEducationTraining,
  updateTrainingAttendee,
  uploadAttendeeSignature,
  uploadTrainingPhoto,
} from "@/lib/education/storage";
import {
  TRAINING_SHIFTS,
  trainingShiftLabel,
  type EducationAttendee,
  type EducationAttendeeInput,
  type EducationTraining,
  type EducationTrainingInput,
  type EducationTrainingPhoto,
} from "@/lib/education/types";
import { cn } from "@/lib/utils";

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20";

const EMPTY_SESSION: EducationTrainingInput = {
  name: "",
  trainingDate: new Date().toISOString().slice(0, 10),
  location: "",
  instructor: "",
  clientName: "",
  durationHours: null,
  notes: "",
};

const EMPTY_ATTENDEE: EducationAttendeeInput = {
  fullName: "",
  shift: "matutino",
  phone: "",
  jobTitle: "",
  employeeNumber: "",
  notes: "",
};

function SignaturePad({
  disabled,
  existingUrl,
  onSave,
  onClear,
}: {
  disabled?: boolean;
  existingUrl?: string;
  onSave: (blob: Blob) => Promise<void>;
  onClear: () => Promise<void>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 420;
    const height = 140;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setDirty(false);
  }, [existingUrl]);

  function pointerPos(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(event.pointerId);
    drawing.current = true;
    const { x, y } = pointerPos(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || disabled) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointerPos(event);
    ctx.lineTo(x, y);
    ctx.stroke();
    setDirty(true);
  }

  function onPointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    drawing.current = false;
    canvasRef.current?.releasePointerCapture(event.pointerId);
  }

  async function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas || !dirty) return;
    setSaving(true);
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (value) =>
            value
              ? resolve(value)
              : reject(new Error("No se pudo capturar la firma.")),
          "image/png"
        );
      });
      await onSave(blob);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setSaving(true);
    try {
      await onClear();
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.clientWidth, 140);
      }
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">Firma</span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || saving}
            onClick={() => void handleClear()}
          >
            Limpiar
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={disabled || saving || !dirty}
            onClick={() => void handleSave()}
            className="bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
          >
            {saving ? "Guardando…" : "Guardar firma"}
          </Button>
        </div>
      </div>
      {existingUrl && !dirty ? (
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={existingUrl}
            alt="Firma"
            className="h-36 w-full object-contain"
          />
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          className={cn(
            "h-36 w-full touch-none rounded-xl border border-dashed border-border bg-white",
            disabled ? "opacity-60" : "cursor-crosshair"
          )}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
      )}
    </div>
  );
}

export function EducationPanel() {
  const { canWrite } = usePermissions("educacion");
  const [items, setItems] = useState<EducationTraining[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EducationTrainingInput>(EMPTY_SESSION);
  const [selected, setSelected] = useState<EducationTraining | null>(null);
  const [attendeeForm, setAttendeeForm] =
    useState<EducationAttendeeInput>(EMPTY_ATTENDEE);
  const [editingAttendeeId, setEditingAttendeeId] = useState<string | null>(
    null
  );
  const [signingAttendee, setSigningAttendee] =
    useState<EducationAttendee | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [printing, setPrinting] = useState(false);

  async function refresh(keepId?: string | null) {
    const rows = await getEducationTrainings();
    setItems(rows);
    const id = keepId ?? selected?.id ?? editingId;
    if (id) {
      setSelected(rows.find((row) => row.id === id) ?? null);
    }
  }

  useEffect(() => {
    void refresh()
      .catch((err) =>
        setError(
          err instanceof Error
            ? err.message
            : "No se pudieron cargar las capacitaciones."
        )
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setEditingId(null);
    setSelected(null);
    setForm({
      ...EMPTY_SESSION,
      trainingDate: new Date().toISOString().slice(0, 10),
    });
    setAttendeeForm(EMPTY_ATTENDEE);
    setEditingAttendeeId(null);
    setSigningAttendee(null);
    setFormOpen(true);
    setError("");
    setMessage("");
  }

  function openEdit(item: EducationTraining) {
    setEditingId(item.id);
    setSelected(item);
    setForm({
      name: item.name,
      trainingDate: item.trainingDate,
      location: item.location,
      instructor: item.instructor,
      clientName: item.clientName,
      durationHours: item.durationHours,
      notes: item.notes,
    });
    setAttendeeForm(EMPTY_ATTENDEE);
    setEditingAttendeeId(null);
    setSigningAttendee(null);
    setFormOpen(true);
    setError("");
    setMessage("");
  }

  async function handleSubmitSession(event: FormEvent) {
    event.preventDefault();
    if (!canWrite) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const session = getSession();
      if (editingId) {
        const updated = await updateEducationTraining(editingId, form);
        setSelected(updated);
        setMessage("Datos de la capacitación actualizados.");
        await refresh(editingId);
      } else {
        const created = await createEducationTraining({
          ...form,
          createdBy: session?.fullName || session?.username || "",
        });
        setEditingId(created.id);
        setSelected(created);
        setMessage(
          "Capacitación creada. Agrega los asistentes, firmas y fotos."
        );
        await refresh(created.id);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo guardar la capacitación."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveAttendee(event: FormEvent) {
    event.preventDefault();
    if (!canWrite || !selected) return;
    setSubmitting(true);
    setError("");
    try {
      if (editingAttendeeId) {
        await updateTrainingAttendee(editingAttendeeId, attendeeForm);
        setMessage("Asistente actualizado.");
      } else {
        await addTrainingAttendee(selected.id, attendeeForm);
        setMessage("Asistente agregado.");
      }
      setAttendeeForm(EMPTY_ATTENDEE);
      setEditingAttendeeId(null);
      await refresh(selected.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo guardar el asistente."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(item: EducationTraining) {
    if (!canWrite) return;
    const ok = window.confirm(
      `¿Eliminar la capacitación "${item.name}" y todos sus asistentes?`
    );
    if (!ok) return;
    setSubmitting(true);
    try {
      await deleteEducationTraining(item.id);
      if (selected?.id === item.id) setSelected(null);
      if (editingId === item.id) {
        setFormOpen(false);
        setEditingId(null);
      }
      await refresh(null);
      setMessage("Capacitación eliminada.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo eliminar la capacitación."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteAttendee(attendee: EducationAttendee) {
    if (!canWrite) return;
    const ok = window.confirm(`¿Quitar a "${attendee.fullName}" de la lista?`);
    if (!ok) return;
    setSubmitting(true);
    try {
      await deleteTrainingAttendee(attendee);
      if (signingAttendee?.id === attendee.id) setSigningAttendee(null);
      await refresh(selected?.id);
      setMessage("Asistente eliminado.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo eliminar el asistente."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePhotoUpload(files: FileList | null) {
    if (!canWrite || !selected || !files?.length) return;
    setPhotoUploading(true);
    setError("");
    try {
      const session = getSession();
      for (const file of Array.from(files)) {
        await uploadTrainingPhoto({
          trainingId: selected.id,
          file,
          uploadedBy: session?.fullName || session?.username || "",
        });
      }
      await refresh(selected.id);
      setMessage("Fotografías agregadas.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudieron subir las fotos."
      );
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handleDeletePhoto(photo: EducationTrainingPhoto) {
    if (!canWrite) return;
    setPhotoUploading(true);
    try {
      await deleteTrainingPhoto(photo);
      await refresh(selected?.id);
      setMessage("Foto eliminada.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo eliminar la foto."
      );
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handlePrint(item: EducationTraining) {
    setPrinting(true);
    setError("");
    try {
      await downloadTrainingPdf(item);
      setMessage("Hoja de asistencia generada.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo generar el PDF de la capacitación."
      );
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className="space-y-4">
      {!canWrite ? <ReadOnlyBanner visible /> : null}
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

      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <GraduationCap className="size-5 text-[#3B46A5]" />
              Capacitaciones de especialistas
            </h2>
            <p className="text-sm text-muted-foreground">
              Registra la sesión, varios asistentes con turno/teléfono/firma, fotos
              y genera la hoja imprimible con logo MAS.
            </p>
          </div>
          {canWrite ? (
            <Button
              type="button"
              onClick={openCreate}
              className="bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
            >
              <Plus className="size-4" />
              Nueva capacitación
            </Button>
          ) : null}
        </div>

        <div className="p-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando capacitaciones…</p>
          ) : (
            <>
              <ResponsiveDataList
                emptyMessage="No hay capacitaciones registradas."
                items={items.map((item) => ({
                  key: item.id,
                  title: item.name,
                  subtitle: `${item.trainingDate || "Sin fecha"} · ${item.attendees.length} asistente${item.attendees.length === 1 ? "" : "s"}`,
                  badge: (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {item.folio}
                    </span>
                  ),
                  fields: [
                    { label: "Lugar", value: item.location || "—" },
                    { label: "Instructor", value: item.instructor || "—" },
                    { label: "Cliente/sede", value: item.clientName || "—" },
                    { label: "Fotos", value: String(item.photos.length) },
                  ],
                  actions: (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium"
                      >
                        <Pencil className="size-3.5" />
                        Abrir
                      </button>
                      <button
                        type="button"
                        disabled={printing}
                        onClick={() => void handlePrint(item)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium"
                      >
                        <Printer className="size-3.5" />
                        Imprimir
                      </button>
                      {canWrite ? (
                        <button
                          type="button"
                          onClick={() => void handleDelete(item)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-destructive/30 px-3 text-xs font-medium text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      ) : null}
                    </div>
                  ),
                }))}
              />
              <DesktopTable>
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/50 text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Folio</th>
                      <th className="px-3 py-2 font-medium">Capacitación</th>
                      <th className="px-3 py-2 font-medium">Fecha</th>
                      <th className="px-3 py-2 font-medium">Lugar</th>
                      <th className="px-3 py-2 font-medium">Asistentes</th>
                      <th className="px-3 py-2 font-medium">Fotos</th>
                      <th className="px-3 py-2 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-3 py-8 text-center text-muted-foreground"
                        >
                          No hay capacitaciones registradas.
                        </td>
                      </tr>
                    ) : (
                      items.map((item) => (
                        <tr key={item.id} className="border-t border-border/70">
                          <td className="px-3 py-2 font-medium">{item.folio}</td>
                          <td className="px-3 py-2">{item.name}</td>
                          <td className="px-3 py-2">
                            {item.trainingDate || "—"}
                          </td>
                          <td className="px-3 py-2">{item.location || "—"}</td>
                          <td className="px-3 py-2">{item.attendees.length}</td>
                          <td className="px-3 py-2">{item.photos.length}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => openEdit(item)}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted"
                              >
                                <Pencil className="size-3.5" />
                                Abrir
                              </button>
                              <button
                                type="button"
                                disabled={printing}
                                onClick={() => void handlePrint(item)}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted"
                              >
                                <Printer className="size-3.5" />
                                PDF
                              </button>
                              {canWrite ? (
                                <button
                                  type="button"
                                  onClick={() => void handleDelete(item)}
                                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-destructive/30 px-2.5 text-xs font-medium text-destructive"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
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
          )}
        </div>
      </section>

      {formOpen ? (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/50">
          <div className="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-6">
            <div className="flex max-h-[min(94dvh,980px)] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
              <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
                <div>
                  <h3 className="text-lg font-semibold">
                    {editingId ? "Editar capacitación" : "Alta de capacitación"}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Primero guarda la sesión. Luego agrega a cada persona
                    (nombre, turno, teléfono y firma) y genera el PDF.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selected ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={printing}
                      onClick={() => void handlePrint(selected)}
                    >
                      <Printer className="size-4" />
                      Imprimir hoja
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFormOpen(false);
                      setEditingId(null);
                      setSigningAttendee(null);
                    }}
                  >
                    <X className="size-4" /> Cerrar
                  </Button>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4 sm:px-5">
                <form
                  onSubmit={handleSubmitSession}
                  className="grid gap-4 rounded-xl border border-border bg-muted/20 p-4 sm:grid-cols-2"
                >
                  <h4 className="text-sm font-semibold sm:col-span-2">
                    Datos de la sesión
                  </h4>
                  <label className="space-y-1.5 sm:col-span-2">
                    <span className="text-sm font-medium">
                      Nombre de la capacitación *
                    </span>
                    <input
                      required
                      disabled={!canWrite}
                      className={inputClass}
                      value={form.name}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          name: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium">Fecha</span>
                    <input
                      type="date"
                      disabled={!canWrite}
                      className={inputClass}
                      value={form.trainingDate}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          trainingDate: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium">Duración (horas)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      disabled={!canWrite}
                      className={inputClass}
                      value={form.durationHours ?? ""}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          durationHours: e.target.value
                            ? Number(e.target.value)
                            : null,
                        }))
                      }
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium">Lugar</span>
                    <input
                      disabled={!canWrite}
                      className={inputClass}
                      value={form.location}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          location: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium">Cliente / sede</span>
                    <input
                      disabled={!canWrite}
                      className={inputClass}
                      value={form.clientName}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          clientName: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="space-y-1.5 sm:col-span-2">
                    <span className="text-sm font-medium">Instructor MAS</span>
                    <input
                      disabled={!canWrite}
                      className={inputClass}
                      value={form.instructor}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          instructor: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="space-y-1.5 sm:col-span-2">
                    <span className="text-sm font-medium">Notas / temario</span>
                    <textarea
                      rows={3}
                      disabled={!canWrite}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none"
                      value={form.notes}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          notes: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <div className="flex justify-end sm:col-span-2">
                    <Button
                      type="submit"
                      disabled={!canWrite || submitting}
                      className="bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                    >
                      {submitting
                        ? "Guardando…"
                        : editingId
                          ? "Guardar sesión"
                          : "Crear capacitación"}
                    </Button>
                  </div>
                </form>

                {selected && editingId === selected.id ? (
                  <>
                    <section className="space-y-4 rounded-xl border border-border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-semibold">
                            Asistentes ({selected.attendees.length})
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            Agrega varias personas con sus datos y firma individual.
                          </p>
                        </div>
                      </div>

                      {canWrite ? (
                        <form
                          onSubmit={handleSaveAttendee}
                          className="grid gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-3 sm:grid-cols-2"
                        >
                          <p className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
                            <UserPlus className="size-4" />
                            {editingAttendeeId
                              ? "Editar asistente"
                              : "Agregar asistente"}
                          </p>
                          <label className="space-y-1.5 sm:col-span-2">
                            <span className="text-sm font-medium">Nombre completo *</span>
                            <input
                              required
                              className={inputClass}
                              value={attendeeForm.fullName}
                              onChange={(e) =>
                                setAttendeeForm((current) => ({
                                  ...current,
                                  fullName: e.target.value,
                                }))
                              }
                            />
                          </label>
                          <label className="space-y-1.5">
                            <span className="text-sm font-medium">Puesto</span>
                            <input
                              className={inputClass}
                              value={attendeeForm.jobTitle}
                              onChange={(e) =>
                                setAttendeeForm((current) => ({
                                  ...current,
                                  jobTitle: e.target.value,
                                }))
                              }
                            />
                          </label>
                          <label className="space-y-1.5">
                            <span className="text-sm font-medium">No. empleado</span>
                            <input
                              className={inputClass}
                              value={attendeeForm.employeeNumber}
                              onChange={(e) =>
                                setAttendeeForm((current) => ({
                                  ...current,
                                  employeeNumber: e.target.value,
                                }))
                              }
                            />
                          </label>
                          <label className="space-y-1.5">
                            <span className="text-sm font-medium">Turno</span>
                            <select
                              className={inputClass}
                              value={attendeeForm.shift}
                              onChange={(e) =>
                                setAttendeeForm((current) => ({
                                  ...current,
                                  shift: e.target.value,
                                }))
                              }
                            >
                              {TRAINING_SHIFTS.map((shift) => (
                                <option key={shift.id} value={shift.id}>
                                  {shift.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="space-y-1.5">
                            <span className="text-sm font-medium">Teléfono</span>
                            <input
                              type="tel"
                              className={inputClass}
                              value={attendeeForm.phone}
                              onChange={(e) =>
                                setAttendeeForm((current) => ({
                                  ...current,
                                  phone: e.target.value,
                                }))
                              }
                            />
                          </label>
                          <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
                            {editingAttendeeId ? (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setEditingAttendeeId(null);
                                  setAttendeeForm(EMPTY_ATTENDEE);
                                }}
                              >
                                Cancelar edición
                              </Button>
                            ) : null}
                            <Button
                              type="submit"
                              disabled={submitting}
                              className="bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                            >
                              {editingAttendeeId
                                ? "Actualizar asistente"
                                : "Agregar a la lista"}
                            </Button>
                          </div>
                        </form>
                      ) : null}

                      <div className="space-y-2">
                        {selected.attendees.length === 0 ? (
                          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                            Aún no hay personas en esta capacitación.
                          </p>
                        ) : (
                          selected.attendees.map((attendee) => (
                            <div
                              key={attendee.id}
                              className="rounded-xl border border-border bg-background p-3"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <p className="font-medium text-foreground">
                                    {attendee.fullName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {[
                                      attendee.jobTitle,
                                      trainingShiftLabel(attendee.shift),
                                      attendee.phone,
                                      attendee.employeeNumber
                                        ? `No. ${attendee.employeeNumber}`
                                        : "",
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Firma:{" "}
                                    {attendee.signatureUrl
                                      ? "Capturada"
                                      : "Pendiente"}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {canWrite ? (
                                    <>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setEditingAttendeeId(attendee.id);
                                          setAttendeeForm({
                                            fullName: attendee.fullName,
                                            shift: attendee.shift || "matutino",
                                            phone: attendee.phone,
                                            jobTitle: attendee.jobTitle,
                                            employeeNumber:
                                              attendee.employeeNumber,
                                            notes: attendee.notes,
                                          });
                                        }}
                                      >
                                        Editar
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          setSigningAttendee(
                                            signingAttendee?.id === attendee.id
                                              ? null
                                              : attendee
                                          )
                                        }
                                      >
                                        Firma
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          void handleDeleteAttendee(attendee)
                                        }
                                      >
                                        <Trash2 className="size-3.5" />
                                      </Button>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                              {signingAttendee?.id === attendee.id ? (
                                <div className="mt-3 border-t border-border pt-3">
                                  <SignaturePad
                                    disabled={!canWrite}
                                    existingUrl={attendee.signatureUrl}
                                    onSave={async (blob) => {
                                      await uploadAttendeeSignature(
                                        attendee.id,
                                        selected.id,
                                        blob
                                      );
                                      await refresh(selected.id);
                                      setMessage(
                                        `Firma de ${attendee.fullName} guardada.`
                                      );
                                    }}
                                    onClear={async () => {
                                      await clearAttendeeSignature(attendee);
                                      await refresh(selected.id);
                                      setMessage("Firma eliminada.");
                                    }}
                                  />
                                </div>
                              ) : null}
                            </div>
                          ))
                        )}
                      </div>
                    </section>

                    <section className="space-y-3 rounded-xl border border-border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-semibold">
                            Fotografías de la capacitación
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            Evidencias del evento (aparecen en el PDF).
                          </p>
                        </div>
                        {canWrite ? (
                          <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium hover:bg-muted">
                            <Camera className="size-3.5" />
                            {photoUploading ? "Subiendo…" : "Agregar fotos"}
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="sr-only"
                              disabled={photoUploading}
                              onChange={(event) => {
                                void handlePhotoUpload(event.target.files);
                                event.target.value = "";
                              }}
                            />
                          </label>
                        ) : null}
                      </div>
                      {selected.photos.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                          Sin fotografías todavía.
                        </p>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {selected.photos.map((photo) => (
                            <div
                              key={photo.id}
                              className="overflow-hidden rounded-xl border border-border"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={photo.fileUrl}
                                alt={photo.caption || "Evidencia"}
                                className="h-36 w-full object-cover"
                              />
                              {canWrite ? (
                                <div className="flex justify-end p-2">
                                  <button
                                    type="button"
                                    onClick={() => void handleDeletePhoto(photo)}
                                    className="inline-flex size-8 items-center justify-center rounded-lg border border-border text-destructive"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
