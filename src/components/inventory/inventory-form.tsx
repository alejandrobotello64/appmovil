"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ASSET_STATUS_OPTIONS,
  CATALOG_CATEGORIES,
  categoryToItemKind,
  getSupplyCategoryMeta,
  INVENTORY_UNITS,
  type CatalogCategoryId,
  type InventoryItem,
  type InventoryItemInput,
  type ItemKind,
  type SupplyCategoryId,
} from "@/lib/inventory/types";
import { QUICK_BRANDS, normalizeBrand, uniqueBrands } from "@/lib/inventory/brands";
import {
  PRODUCT_COLORS,
  colorForBrand,
  productColorMeta,
} from "@/lib/inventory/colors";
import { cn } from "@/lib/utils";

type InventoryFormProps = {
  item?: InventoryItem | null;
  itemKind?: ItemKind;
  /** Bloquea la categoría a una tabla propia */
  lockedCategory?: SupplyCategoryId;
  /** Categorías que el usuario puede elegir en el catálogo unificado */
  allowedCategories?: CatalogCategoryId[];
  /** Marcas del catálogo para elegir en un toque. */
  quickBrands?: string[];
  onSubmit: (data: InventoryItemInput, imageFile?: File | null) => void;
  onCancel: () => void;
};

function emptyForm(
  kind: ItemKind,
  lockedCategory?: SupplyCategoryId
): InventoryItemInput {
  const category =
    kind === "equipo" ? "equipos" : lockedCategory ?? "insumos";
  return {
    sku: "",
    name: "",
    category,
    itemKind: kind,
    description: "",
    quantity: 0,
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
    tracksLot: false,
    tracksSerial: kind === "equipo",
    tracksExpiry: false,
    maxStock: 0,
    reorderPoint: 0,
    partNumber: "",
    manufacturer: "",
    subcategory: "",
    colorTag: "",
  };
}

export function InventoryForm({
  item,
  itemKind = "producto",
  lockedCategory,
  allowedCategories,
  quickBrands,
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
      const next = emptyForm(itemKind, lockedCategory);
      if (
        !lockedCategory &&
        itemKind !== "equipo" &&
        allowedCategories?.length &&
        !allowedCategories.includes(next.category as CatalogCategoryId)
      ) {
        const first = allowedCategories[0];
        next.category = first;
        next.itemKind = categoryToItemKind(first);
      }
      setForm(next);
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
      galleryImages: _galleryImages,
      ...rest
    } = item;
    const category =
      itemKind === "equipo"
        ? "equipos"
        : lockedCategory ?? item.category;
    setForm({
      ...rest,
      itemKind: item.itemKind || itemKind,
      category,
      expiryDate: rest.expiryDate ?? "",
      manufacturedAt: rest.manufacturedAt ?? "",
    });
    setImageFile(null);
    setImagePreview(item.imageUrl || "");
    setClearExistingImage(false);
  }, [item, itemKind, lockedCategory, allowedCategories]);

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
      itemKind === "equipo"
        ? "equipos"
        : lockedCategory ?? form.category;
    const kind = categoryToItemKind(category);
    onSubmit(
      {
        ...form,
        brand: normalizeBrand(form.brand),
        manufacturer: normalizeBrand(form.manufacturer) || normalizeBrand(form.brand),
        colorTag: form.colorTag || "",
        itemKind: kind,
        category,
        quantity: kind === "equipo" && !item ? 0 : form.quantity,
        expiryDate: kind === "equipo" ? "" : form.expiryDate,
        manufacturedAt: form.manufacturedAt,
      },
      imageFile ? imageFile : clearExistingImage ? null : undefined
    );
  }

  const categoryOptions = (allowedCategories?.length
    ? CATALOG_CATEGORIES.filter((entry) =>
        allowedCategories.includes(entry.id)
      )
    : CATALOG_CATEGORIES);
  const isEquipment =
    itemKind === "equipo" ||
    form.itemKind === "equipo" ||
    form.category === "equipos";
  const lockedMeta = lockedCategory
    ? getSupplyCategoryMeta(lockedCategory)
    : null;
  const showCategoryPicker = !item && !lockedCategory && itemKind !== "equipo";
  const showPreview = Boolean(imagePreview) && !clearExistingImage;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        {isEquipment
          ? "Registro de equipo médico por modelo. La serie no es obligatoria aquí: se captura al dar entrada en Almacén."
          : `Registro de ${lockedMeta?.label.toLowerCase() ?? "artículo"}. La caducidad y la fecha de fabricación son opcionales.`}
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

        {showCategoryPicker ? (
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Categoría</span>
            <select
              value={form.category}
              onChange={(event) => {
                const next = event.target.value as CatalogCategoryId;
                const kind = categoryToItemKind(next);
                setForm((current) => ({
                  ...current,
                  category: next,
                  itemKind: kind,
                  tracksSerial: kind === "equipo" ? true : current.tracksSerial,
                  quantity: kind === "equipo" ? 0 : current.quantity,
                }));
              }}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
            >
              {categoryOptions.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
        ) : !isEquipment && lockedMeta ? (
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Categoría</span>
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
                ? "Existencia"
                : "Existencia inicial"}
          </span>
          <input
            required={!item && !isEquipment}
            type="number"
            min={0}
            value={form.quantity}
            disabled={Boolean(item) || isEquipment}
            onChange={(event) =>
              handleChange("quantity", Number(event.target.value))
            }
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none disabled:opacity-60"
          />
          {item ? (
            <span className="text-xs text-muted-foreground">
              La existencia se actualiza con entradas, salidas o traspasos.
            </span>
          ) : isEquipment ? (
            <span className="text-xs text-muted-foreground">
              Da de alta el modelo aquí. Las piezas y series se registran en
              Almacén → Entradas.
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
            <span className="text-sm font-medium">
              Número de serie (opcional)
            </span>
            <input
              value={form.serialNumber}
              placeholder="Se captura al dar entrada"
              onChange={(event) =>
                handleChange("serialNumber", event.target.value)
              }
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
            />
            <span className="text-xs text-muted-foreground">
              El catálogo es el modelo. Cada pieza recibe su serie en el
              registro de entradas.
            </span>
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
        <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Marca</span>
            <div className="mb-1.5 flex flex-wrap gap-1" aria-label="Marcas rápidas">
              {uniqueBrands([...(quickBrands ?? []), ...QUICK_BRANDS]).map((brand) => {
                const active = normalizeBrand(form.brand) === brand;
                const tone = productColorMeta(colorForBrand(brand));
                return (
                  <button
                    key={brand}
                    type="button"
                    onClick={() =>
                      setForm((current) => {
                        const keepCustom =
                          current.colorTag !== colorForBrand(current.brand);
                        return {
                          ...current,
                          brand,
                          colorTag: keepCustom
                            ? current.colorTag
                            : colorForBrand(brand),
                        };
                      })
                    }
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium",
                      active
                        ? cn(tone?.chip ?? "bg-[#3B46A5] text-white")
                        : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {brand}
                  </button>
                );
              })}
            </div>
            <input
              value={form.brand}
              onChange={(event) => handleChange("brand", event.target.value)}
              list="inventory-quick-brands"
              placeholder="Elige una marca rápida o escribe otra"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
            />
            <datalist id="inventory-quick-brands">
              {uniqueBrands([...(quickBrands ?? []), ...QUICK_BRANDS]).map((brand) => (
                <option key={brand} value={brand} />
              ))}
            </datalist>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">N.º de parte</span>
            <input
              value={form.partNumber}
              onChange={(event) => handleChange("partNumber", event.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
            />
          </label>
          <div className="space-y-1.5 md:col-span-2">
            <span className="text-sm font-medium">Color para separar</span>
            <div className="flex flex-wrap gap-1.5" aria-label="Color del producto">
              <button
                type="button"
                onClick={() => handleChange("colorTag", "")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                  !form.colorTag
                    ? "border-transparent bg-muted text-foreground ring-2 ring-offset-1 ring-ring"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                Sin color
              </button>
              {PRODUCT_COLORS.map((color) => {
                const active = form.colorTag === color.id;
                return (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() =>
                      handleChange("colorTag", active ? "" : color.id)
                    }
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                      active
                        ? cn(color.chip, "border-transparent ring-2 ring-offset-1 ring-ring")
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <span className={cn("size-2.5 rounded-full", color.swatch)} />
                    {color.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Elige un color para separar el producto en la lista. Pulsa el color
              activo o <span className="font-medium text-foreground">Sin color</span>{" "}
              para quitarlo; no se vuelve a aplicar el de la marca.
            </p>
          </div>
        </div>
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
            checked={form.tracksLot}
            onChange={(event) => handleChange("tracksLot", event.target.checked)}
          />
          Control por lote
        </label>
        {!isEquipment ? (
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
        ) : null}
        {!isEquipment ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.tracksExpiry}
              onChange={(event) =>
                handleChange("tracksExpiry", event.target.checked)
              }
            />
            Control de caducidad
          </label>
        ) : null}

        <label className="space-y-1.5 md:col-span-2">
          <span className="text-sm font-medium">
            Fecha de fabricación (opcional)
          </span>
          <input
            type="date"
            value={form.manufacturedAt}
            onChange={(event) =>
              handleChange("manufacturedAt", event.target.value)
            }
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
          />
        </label>

        {!isEquipment ? (
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-sm font-medium">
              Fecha de caducidad (opcional)
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
