"use client";

import { useState, type ReactNode } from "react";
import { Loader2, Lock, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/ui/modal-shell";
import { UnitPhotoGallery, useUnitImages } from "@/components/inventory/unit-photo-gallery";
import { updateLotUnit, type LotUnitInput } from "@/lib/inventory/lots";
import {
  EDITABLE_SERIAL_STATUSES,
  isEditableSerialStatus,
  updateSerialUnit,
  type SerialUnitInput,
} from "@/lib/inventory/serials";
import {
  SERIAL_STATUS_LABELS,
  type InventoryLotStock,
  type InventorySerial,
} from "@/lib/inventory/tracking";
import { cn } from "@/lib/utils";

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20 disabled:opacity-70";

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("block space-y-1", className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function DateField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={inputClass}
      />
    </Field>
  );
}

function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}

function DialogFooter({
  canEdit,
  saving,
  disabled,
  onCancel,
  onSave,
}: {
  canEdit: boolean;
  saving: boolean;
  disabled: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  if (!canEdit) return null;
  return (
    <div className="flex justify-end gap-2 border-t border-border pt-4">
      <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
        Cancelar
      </Button>
      <Button
        type="button"
        onClick={onSave}
        disabled={disabled}
        className="bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        Guardar cambios
      </Button>
    </div>
  );
}

type UnitDialogBaseProps = {
  productName: string;
  canEdit: boolean;
  onClose: () => void;
  /** Se llama tras cualquier cambio guardado para recargar existencias. */
  onChanged: () => void;
};

export function SerialUnitDialog({
  productName,
  serial,
  canEdit,
  onClose,
  onChanged,
}: UnitDialogBaseProps & { serial: InventorySerial }) {
  const statusLocked = !isEditableSerialStatus(serial.status);
  const [form, setForm] = useState<SerialUnitInput>({
    serialNumber: serial.serialNumber,
    inventoryNumber: serial.inventoryNumber,
    status: serial.status,
    notes: serial.notes,
    manufacturedAt: serial.manufacturedAt,
    lastMaintenanceDate: serial.lastMaintenanceDate,
    nextMaintenanceDate: serial.nextMaintenanceDate,
    warrantyStart: serial.warrantyStart,
    warrantyEnd: serial.warrantyEnd,
  });
  const photos = useUnitImages(
    "serial_numbers",
    serial.id,
    { imagePath: serial.imagePath, imageUrl: serial.imageUrl, galleryImages: serial.galleryImages },
    onChanged
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const busy = saving || photos.busy;
  const locked = !canEdit || busy;

  const set = <K extends keyof SerialUnitInput>(key: K, value: SerialUnitInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function handleSave() {
    try {
      setError("");
      setSaving(true);
      await updateSerialUnit(serial.id, form);
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la pieza.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title={`Serie ${serial.serialNumber}`}
      description={`${productName}${serial.location ? ` · ${serial.location}` : ""}`}
      className="max-w-2xl"
      headerAction={
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          Cerrar
        </Button>
      }
    >
      <div className="space-y-5">
        <ErrorBanner message={error || photos.error} />

        <UnitPhotoGallery
          title="Fotos de la pieza"
          caption={`${productName} · Serie ${serial.serialNumber}`}
          images={photos.images}
          canEdit={canEdit}
          busy={busy}
          onAdd={(files) => void photos.add(files)}
          onRemove={(path) => void photos.remove(path)}
          onMakePrimary={(path) => void photos.makePrimary(path)}
        />

        <section className="grid gap-3 sm:grid-cols-2">
          <Field label="Número de serie">
            <input
              value={form.serialNumber}
              onChange={(e) => set("serialNumber", e.target.value)}
              disabled={locked}
              className={cn(inputClass, "font-mono")}
            />
          </Field>
          <Field label="N.º de inventario">
            <input
              value={form.inventoryNumber}
              onChange={(e) => set("inventoryNumber", e.target.value)}
              disabled={locked}
              placeholder="Opcional"
              className={inputClass}
            />
          </Field>
          <Field label="Estado">
            {statusLocked ? (
              <div
                className={cn(inputClass, "flex items-center gap-2 bg-muted/40")}
                title="Este estado lo controlan los movimientos de almacén"
              >
                <Lock className="size-3.5 text-muted-foreground" />
                {SERIAL_STATUS_LABELS[serial.status] ?? serial.status}
              </div>
            ) : (
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
                disabled={locked}
                className={inputClass}
              >
                {EDITABLE_SERIAL_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {SERIAL_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <DateField
            label="Fabricación"
            value={form.manufacturedAt}
            disabled={locked}
            onChange={(value) => set("manufacturedAt", value)}
          />
          <DateField
            label="Último mantenimiento"
            value={form.lastMaintenanceDate}
            disabled={locked}
            onChange={(value) => set("lastMaintenanceDate", value)}
          />
          <DateField
            label="Próximo mantenimiento"
            value={form.nextMaintenanceDate}
            disabled={locked}
            onChange={(value) => set("nextMaintenanceDate", value)}
          />
          <DateField
            label="Garantía desde"
            value={form.warrantyStart}
            disabled={locked}
            onChange={(value) => set("warrantyStart", value)}
          />
          <DateField
            label="Garantía hasta"
            value={form.warrantyEnd}
            disabled={locked}
            onChange={(value) => set("warrantyEnd", value)}
          />
          <Field label="Notas de la pieza" className="sm:col-span-2">
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              disabled={locked}
              rows={3}
              placeholder="Accesorios, condición física, observaciones…"
              className={cn(inputClass, "h-auto py-2")}
            />
          </Field>
        </section>

        <p className="text-xs text-muted-foreground">
          La ubicación y el almacén se cambian con &quot;Ubicar&quot; o con movimientos para no
          descuadrar existencias.
        </p>

        <DialogFooter
          canEdit={canEdit}
          saving={saving}
          disabled={busy}
          onCancel={onClose}
          onSave={() => void handleSave()}
        />
      </div>
    </ModalShell>
  );
}

export function LotUnitDialog({
  productName,
  lot,
  unit,
  canEdit,
  onClose,
  onChanged,
}: UnitDialogBaseProps & { lot: InventoryLotStock; unit: string }) {
  const details = lot.lot;
  const [form, setForm] = useState<LotUnitInput>({
    lotNumber: lot.lotNumber,
    manufacturedAt: lot.manufacturedAt,
    expiryDate: lot.expiryDate,
    notes: details?.notes ?? "",
  });
  const photos = useUnitImages(
    "lots",
    details?.id ?? "",
    {
      imagePath: details?.imagePath ?? "",
      imageUrl: details?.imageUrl ?? "",
      galleryImages: details?.galleryImages ?? [],
    },
    onChanged
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const editable = canEdit && Boolean(details);
  const busy = saving || photos.busy;
  const locked = !editable || busy;

  const set = <K extends keyof LotUnitInput>(key: K, value: LotUnitInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function handleSave() {
    if (!details) return;
    try {
      setError("");
      setSaving(true);
      await updateLotUnit(details.id, form);
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el lote.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title={`Lote ${lot.lotNumber}`}
      description={`${productName} · ${lot.quantity} ${unit}${
        lot.locations.length ? ` · ${lot.locations.join(", ")}` : ""
      }`}
      className="max-w-2xl"
      headerAction={
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          Cerrar
        </Button>
      }
    >
      <div className="space-y-5">
        <ErrorBanner message={error || photos.error} />

        <UnitPhotoGallery
          title="Fotos del lote"
          caption={`${productName} · Lote ${lot.lotNumber}`}
          images={photos.images}
          canEdit={editable}
          busy={busy}
          onAdd={(files) => void photos.add(files)}
          onRemove={(path) => void photos.remove(path)}
          onMakePrimary={(path) => void photos.makePrimary(path)}
        />

        <section className="grid gap-3 sm:grid-cols-2">
          <Field label="Número de lote" className="sm:col-span-2">
            <input
              value={form.lotNumber}
              onChange={(e) => set("lotNumber", e.target.value)}
              disabled={locked}
              className={cn(inputClass, "font-mono")}
            />
          </Field>
          <DateField
            label="Fabricación"
            value={form.manufacturedAt}
            disabled={locked}
            onChange={(value) => set("manufacturedAt", value)}
          />
          <DateField
            label="Caducidad"
            value={form.expiryDate}
            disabled={locked}
            onChange={(value) => set("expiryDate", value)}
          />
          <Field label="Notas del lote" className="sm:col-span-2">
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              disabled={locked}
              rows={3}
              placeholder="Proveedor, factura, condición del empaque, observaciones…"
              className={cn(inputClass, "h-auto py-2")}
            />
          </Field>
        </section>

        <p className="text-xs text-muted-foreground">
          La cantidad y la ubicación del lote se cambian con entradas, salidas o
          &quot;Ubicar&quot; para no descuadrar existencias.
        </p>

        <DialogFooter
          canEdit={editable}
          saving={saving}
          disabled={busy}
          onCancel={onClose}
          onSave={() => void handleSave()}
        />
      </div>
    </ModalShell>
  );
}
