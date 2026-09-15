"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  ASSET_STATUS_OPTIONS,
  CATALOG_CATEGORIES,
  INVENTORY_UNITS,
  PRODUCT_CATEGORIES,
  categoryToItemKind,
  type InventoryItem,
  type InventoryItemInput,
  type ItemKind,
} from "@/lib/inventory/types";

type InventoryFormProps = {
  item?: InventoryItem | null;
  itemKind?: ItemKind;
  catalogCategories?: boolean;
  onSubmit: (data: InventoryItemInput) => void;
  onCancel: () => void;
};

function emptyForm(kind: ItemKind): InventoryItemInput {
  return {
    sku: "",
    name: "",
    category: kind === "equipo" ? "equipos" : "insumos",
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
    notes: "",
    assetStatus: "operativo",
    lastMaintenanceDate: "",
    nextMaintenanceDate: "",
  };
}

export function InventoryForm({
  item,
  itemKind = "producto",
  catalogCategories = false,
  onSubmit,
  onCancel,
}: InventoryFormProps) {
  const [form, setForm] = useState<InventoryItemInput>(emptyForm(itemKind));

  useEffect(() => {
    if (!item) {
      setForm(emptyForm(itemKind));
      return;
    }
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } =
      item;
    setForm({ ...rest, itemKind: item.itemKind || itemKind });
  }, [item, itemKind]);

  function handleChange<K extends keyof InventoryItemInput>(
    key: K,
    value: InventoryItemInput[K]
  ) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "category") {
        const kind = categoryToItemKind(
          value as InventoryItemInput["category"]
        );
        next.itemKind = kind;
        if (kind === "equipo") {
          next.category = "equipos";
          next.quantity = Math.max(1, current.quantity || 1);
        }
      }
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const resolvedKind = catalogCategories
      ? categoryToItemKind(form.category)
      : itemKind;
    onSubmit({
      ...form,
      itemKind: resolvedKind,
      category: resolvedKind === "equipo" ? "equipos" : form.category,
      quantity:
        resolvedKind === "equipo" ? Math.max(1, form.quantity) : form.quantity,
    });
  }

  const isEquipment =
    (catalogCategories
      ? categoryToItemKind(form.category)
      : itemKind) === "equipo";
  const categoryChoices = catalogCategories
    ? CATALOG_CATEGORIES
    : PRODUCT_CATEGORIES;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        {isEquipment
          ? "Registro de equipo médico (activo): control por serie, estado y mantenimiento."
          : "Registro de producto consumible: insumos, medicamentos, refacciones y similares."}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-medium">SKU / Código</span>
          <input
            required
            value={form.sku}
            onChange={(event) => handleChange("sku", event.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium">
            {isEquipment ? "Nombre del equipo" : "Nombre del producto"}
          </span>
          <input
            required
            value={form.name}
            onChange={(event) => handleChange("name", event.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20"
          />
        </label>

        {!isEquipment || catalogCategories ? (
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Categoría</span>
            <select
              value={form.category}
              onChange={(event) =>
                handleChange(
                  "category",
                  event.target.value as InventoryItemInput["category"]
                )
              }
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
            >
              {categoryChoices.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
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
            {isEquipment ? "Cantidad de activos" : "Cantidad"}
          </span>
          <input
            required
            type="number"
            min={isEquipment ? 1 : 0}
            value={form.quantity}
            onChange={(event) =>
              handleChange("quantity", Number(event.target.value))
            }
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
          />
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

        {!isEquipment ? (
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-sm font-medium">Fecha de caducidad</span>
            <input
              type="date"
              value={form.expiryDate}
              onChange={(event) =>
                handleChange("expiryDate", event.target.value)
              }
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none"
            />
          </label>
        ) : (
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
        )}

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
