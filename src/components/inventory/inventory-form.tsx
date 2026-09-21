"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ASSET_STATUS_OPTIONS,
  categoryRequiresExpiry,
  categoryRequiresManufactureDate,
  getSupplyCategoryMeta,
  INVENTORY_UNITS,
  type InventoryItem,
  type InventoryItemInput,
  type ItemKind,
  type SupplyCategoryId,
} from "@/lib/inventory/types";

type InventoryFormProps = {
  item?: InventoryItem | null;
  itemKind?: ItemKind;
  /** Bloquea la categoría a una tabla propia */
  lockedCategory?: SupplyCategoryId;
  onSubmit: (data: InventoryItemInput, imageFile?: File | null) => void;
  onCancel: () => void;
};

function emptyForm(
  kind: ItemKind,
  lockedCategory?: SupplyCategoryId
): InventoryItemInput {
  const category =
    kind === "equipo" ? "equipos" : lockedCategory ?? "insumos";
  const requiresExpiry =
    kind !== "equipo" && categoryRequiresExpiry(category);
  const requiresManufactureDate = categoryRequiresManufactureDate(category);
  return {
    sku: "",
    name: "",
    category,
    itemKind: kind,
    description: "",
    quantity: kind === "equipo" ? 1 : 0,
    minStock: kind === "equipo" ? 0 : 0,
    unit: "pieza",
    location: "",
    brand: "",
    model: "",
    serialNumber: "",
    unitPrice: 0,
    supplier: "",
    expiryDate: "",
    manufacturedAt: "",
    notes: "",
    assetStatus: "operativo",
    lastMaintenanceDate: "",
    nextMaintenanceDate: "",
    isActive: true,
    tracksLot: kind !== "equipo" ? requiresExpiry : false,
    tracksSerial: kind === "equipo",
    tracksExpiry: requiresExpiry && !requiresManufactureDate,
    maxStock: 0,
    reorderPoint: 0,
    partNumber: "",
    manufacturer: "",
    subcategory: "",
  };
}

export function InventoryForm({
  item,
  itemKind = "producto",
  lockedCategory,
  onSubmit,
  onCancel,
}: InventoryFormProps) {
  const [form, setForm] = useState<InventoryItemInput>(
    emptyForm(itemKind, lockedCategory)
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [clearExistingImage, setClearExistingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!item) {
      setForm(emptyForm(itemKind, lockedCategory));
      setImageFile(null);
      setImagePreview("");
      setClearExistingImage(false);
      return;
    }
    const {
      id: _id,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      imagePath: _imagePath,
      imageUrl: _imageUrl,
      ...rest
    } = item;
    const category =
      itemKind === "equipo"
        ? "equipos"
        : lockedCategory ?? item.category;
    const requiresExpiry = categoryRequiresExpiry(category);
    const requiresManufactureDate = categoryRequiresManufactureDate(category);
    setForm({
      ...rest,
      itemKind: item.itemKind || itemKind,
      category,
      expiryDate: requiresManufactureDate ? "" : rest.expiryDate,
      manufacturedAt: rest.manufacturedAt ?? "",
      tracksExpiry: requiresExpiry,
      tracksLot: requiresExpiry || Boolean(rest.tracksLot),
    });
    setImageFile(null);
    setImagePreview(item.imageUrl || "");
    setClearExistingImage(false);
  }, [item, itemKind, lockedCategory]);

  useEffect(() => {
    if (!imageFile) return;
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  function handleChange<K extends keyof InventoryItemInput>(
    key: K,
    value: InventoryItemInput[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleImagePick(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    setImageFile(file);
    setClearExistingImage(false);
  }

  function handleClearImage() {
    setImageFile(null);
    setImagePreview("");
    setClearExistingImage(Boolean(item?.imageUrl));
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const category =
      itemKind === "equipo" ? "equipos" : lockedCategory ?? form.category;
    const requiresExpiry = categoryRequiresExpiry(category);
    const requiresManufactureDate = categoryRequiresManufactureDate(category);
    onSubmit(
      {
        ...form,
        itemKind,
        category,
        quantity: itemKind === "equipo" ? Math.max(1, form.quantity) : form.quantity,
        expiryDate: requiresManufactureDate ? "" : form.expiryDate,
        manufacturedAt: form.manufacturedAt,
        tracksExpiry: requiresExpiry,
        tracksLot: requiresExpiry || form.tracksLot,
      },
      imageFile ? imageFile : clearExistingImage ? null : undefined
    );
  }

  const isEquipment = itemKind === "equipo";
  const lockedMeta = lockedCategory
    ? getSupplyCategoryMeta(lockedCategory)
    : null;
  const requiresExpiry =
    !isEquipment &&
    categoryRequiresExpiry(lockedCategory ?? form.category);
  const requiresManufactureDate = categoryRequiresManufactureDate(
    isEquipment ? "equipos" : lockedCategory ?? form.category
  );
  const showPreview = Boolean(imagePreview) && !clearExistingImage;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        {isEquipment
          ? "Registro de equipo médico (activo): serie, fecha de fabricación, estado y mantenimiento."
          : requiresExpiry
            ? `Registro de ${lockedMeta?.label.toLowerCase() ?? "artículo"} con caducidad y lote obligatorios.`
            : requiresManufactureDate
              ? `Registro de ${lockedMeta?.label.toLowerCase() ?? "accesorio"} con fecha de fabricación. No lleva caducidad.`
              : `Registro de ${lockedMeta?.label.toLowerCase() ?? "artículo"} en tabla propia.`}
      </div>

      <div className="flex flex-wrap items-start gap-4 rounded-xl border border-border bg-background p-3">
        <div className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30">
          {showPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imagePreview}
              alt="Vista previa"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="px-2 text-center text-xs text-muted-foreground">
              Sin imagen
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium">Imagen del artículo</p>
          <p className="text-xs text-muted-foreground">
            Opcional. JPG, PNG o WebP. Se guarda al crear o actualizar el
            registro.
          </p>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              handleImagePick(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => imageInputRef.current?.click()}
            >
              <Camera className="size-4" />
              {showPreview ? "Cambiar imagen" : "Elegir imagen"}
            </Button>
            {showPreview || (item?.imageUrl && !clearExistingImage) ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-destructive"
                onClick={handleClearImage}
              >
                <Trash2 className="size-4" /> Quitar
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-medium">SKU / Código</span>
          <input
            required={Boolean(item)}
            value={form.sku}
            readOnly={!item}
            placeholder={
              item
                ? undefined
                : "Se asignará al guardar (ej. EQUIPO-000001)"
            }
            onChange={(event) => handleChange("sku", event.target.value)}
            className={
              item
                ? "h-10 w-full rounded-lg border border-input bg-muted/40 px-3 text-sm outline-none"
                : "h-10 w-full rounded-lg border border-input bg-muted/30 px-3 text-sm text-muted-foreground outline-none"
            }
          />
          {!item ? (
            <span className="text-xs text-muted-foreground">
              El SKU se genera solo según la categoría (INSUMOS-, MEDICAMENTOS-,
              ACCESORIOS-, EQUIPO-, etc.).
            </span>
          ) : null}
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium">
            {isEquipment
              ? "Nombre del equipo"
              : `Nombre del ${lockedMeta?.label.toLowerCase() ?? "artículo"}`}
          </span>
          <input
            required
            value={form.name}
            onChange={(event) => handleChange("name", event.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20"
          />
        </label>

        {!isEquipment && lockedMeta ? (
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Tabla</span>
            <p className="flex h-10 items-center rounded-lg border border-input bg-muted/40 px-3 text-sm">
              {lockedMeta.label}
            </p>
          </div>
        ) : null}

        {isEquipment ? (
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Estado del equipo</span>
            <select
              value={form.assetStatus}
              onChange={(event) =>
                handleChange(
                  "assetStatus",
                  event.target.value as InventoryItemInput["assetStatus"]
                )
              }
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
            >
              {ASSET_STATUS_OPTIONS.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="space-y-1.5">
          <span className="text-sm font-medium">Unidad</span>
          <select
            value={form.unit}
            onChange={(event) =>
              handleChange("unit", event.target.value as InventoryItemInput["unit"])
            }
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
          >
            {INVENTORY_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium">
            {item
              ? "Existencia (solo por movimientos)"
              : isEquipment
                ? "Existencia inicial"
                : "Existencia inicial"}
          </span>
          <input
            required={!item}
            type="number"
            min={0}
            value={form.quantity}
            disabled={Boolean(item)}
            onChange={(event) =>
              handleChange("quantity", Number(event.target.value))
            }
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none disabled:opacity-60"
          />
          {item ? (
            <span className="text-xs text-muted-foreground">
              La existencia se actualiza con entradas, salidas o traspasos.
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              Si capturas unidades, se genera una entrada con folio EM.
            </span>
          )}
        </label>

        {!isEquipment ? (
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Stock mínimo</span>
            <input
              required
              type="number"
              min={0}
              value={form.minStock}
              onChange={(event) =>
                handleChange("minStock", Number(event.target.value))
              }
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
            />
          </label>
        ) : (
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Número de serie</span>
            <input
              required
              value={form.serialNumber}
              onChange={(event) =>
                handleChange("serialNumber", event.target.value)
              }
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
            />
          </label>
        )}

        <label className="space-y-1.5">
          <span className="text-sm font-medium">Ubicación</span>
          <input
            value={form.location}
            onChange={(event) => handleChange("location", event.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Marca</span>
          <input
            value={form.brand}
            onChange={(event) => handleChange("brand", event.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Modelo</span>
          <input
            value={form.model}
            onChange={(event) => handleChange("model", event.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
          />
        </label>
        {!isEquipment ? (
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Número de serie / lote</span>
            <input
              value={form.serialNumber}
              onChange={(event) =>
                handleChange("serialNumber", event.target.value)
              }
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
            />
          </label>
        ) : null}
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Precio unitario</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.unitPrice}
            onChange={(event) =>
              handleChange("unitPrice", Number(event.target.value))
            }
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Proveedor</span>
          <input
            value={form.supplier}
            onChange={(event) => handleChange("supplier", event.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Número de parte</span>
          <input
            value={form.partNumber}
            onChange={(event) => handleChange("partNumber", event.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Fabricante</span>
          <input
            value={form.manufacturer}
            onChange={(event) =>
              handleChange("manufacturer", event.target.value)
            }
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
          />
        </label>

        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input
            type="checkbox"
            checked={form.tracksLot || requiresExpiry}
            disabled={requiresExpiry}
            onChange={(event) => handleChange("tracksLot", event.target.checked)}
          />
          Control por lote{requiresExpiry ? " (obligatorio)" : ""}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.tracksSerial}
            onChange={(event) =>
              handleChange("tracksSerial", event.target.checked)
            }
          />
          Control por número de serie
        </label>
        {!isEquipment && !requiresManufactureDate ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.tracksExpiry || requiresExpiry}
              disabled={requiresExpiry}
              onChange={(event) =>
                handleChange("tracksExpiry", event.target.checked)
              }
            />
            Control de caducidad{requiresExpiry ? " (obligatorio)" : ""}
          </label>
        ) : requiresManufactureDate && !isEquipment ? (
          <p className="text-sm text-muted-foreground">
            Los accesorios no controlan caducidad.
          </p>
        ) : null}

        {requiresManufactureDate ? (
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-sm font-medium">
              Fecha de fabricación (obligatoria)
            </span>
            <input
              type="date"
              required
              value={form.manufacturedAt}
              onChange={(event) =>
                handleChange("manufacturedAt", event.target.value)
              }
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
            />
          </label>
        ) : null}

        {!isEquipment && !requiresManufactureDate ? (
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-sm font-medium">
              Fecha de caducidad
              {requiresExpiry ? " (se captura en entradas)" : ""}
            </span>
            <input
              type="date"
              value={form.expiryDate}
              onChange={(event) =>
                handleChange("expiryDate", event.target.value)
              }
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
            />
          </label>
        ) : null}

        {isEquipment ? (
          <>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Último mantenimiento</span>
              <input
                type="date"
                value={form.lastMaintenanceDate}
                onChange={(event) =>
                  handleChange("lastMaintenanceDate", event.target.value)
                }
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Próximo mantenimiento</span>
              <input
                type="date"
                value={form.nextMaintenanceDate}
                onChange={(event) =>
                  handleChange("nextMaintenanceDate", event.target.value)
                }
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
              />
            </label>
          </>
        ) : null}

        <label className="space-y-1.5 md:col-span-2">
          <span className="text-sm font-medium">Descripción</span>
          <textarea
            rows={3}
            value={form.description}
            onChange={(event) => handleChange("description", event.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none"
          />
        </label>
        <label className="space-y-1.5 md:col-span-2">
          <span className="text-sm font-medium">Notas</span>
          <textarea
            rows={2}
            value={form.notes}
            onChange={(event) => handleChange("notes", event.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none"
          />
        </label>
      </div>

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="submit"
          className="border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white hover:opacity-90"
        >
          {item
            ? "Guardar cambios"
            : isEquipment
              ? "Registrar equipo"
              : "Agregar producto"}
        </Button>
      </div>
    </form>
  );
}
