"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  INVENTORY_CATEGORIES,
  INVENTORY_UNITS,
  type InventoryItem,
  type InventoryItemInput,
} from "@/lib/inventory/types";

const EMPTY_FORM: InventoryItemInput = {
  sku: "",
  name: "",
  category: "insumos",
  description: "",
  quantity: 0,
  minStock: 0,
  unit: "pieza",
  location: "",
  brand: "",
  model: "",
  serialNumber: "",
  unitPrice: 0,
  supplier: "",
  expiryDate: "",
  notes: "",
};

type InventoryFormProps = {
  item?: InventoryItem | null;
  onSubmit: (data: InventoryItemInput) => void;
  onCancel: () => void;
};

export function InventoryForm({ item, onSubmit, onCancel }: InventoryFormProps) {
  const [form, setForm] = useState<InventoryItemInput>(EMPTY_FORM);

  useEffect(() => {
    if (!item) {
      setForm(EMPTY_FORM);
      return;
    }
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } =
      item;
    setForm(rest);
  }, [item]);

  function handleChange<K extends keyof InventoryItemInput>(
    key: K,
    value: InventoryItemInput[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(form);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          <span className="text-sm font-medium">Nombre del producto</span>
          <input
            required
            value={form.name}
            onChange={(event) => handleChange("name", event.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20"
          />
        </label>
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
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20"
          >
            {INVENTORY_CATEGORIES.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Unidad</span>
          <select
            value={form.unit}
            onChange={(event) =>
              handleChange("unit", event.target.value as InventoryItemInput["unit"])
            }
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20"
          >
            {INVENTORY_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Cantidad</span>
          <input
            required
            type="number"
            min={0}
            value={form.quantity}
            onChange={(event) =>
              handleChange("quantity", Number(event.target.value))
            }
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20"
          />
        </label>
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
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Ubicación</span>
          <input
            value={form.location}
            onChange={(event) => handleChange("location", event.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Marca</span>
          <input
            value={form.brand}
            onChange={(event) => handleChange("brand", event.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Modelo</span>
          <input
            value={form.model}
            onChange={(event) => handleChange("model", event.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Número de serie</span>
          <input
            value={form.serialNumber}
            onChange={(event) =>
              handleChange("serialNumber", event.target.value)
            }
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20"
          />
        </label>
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
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium">Proveedor</span>
          <input
            value={form.supplier}
            onChange={(event) => handleChange("supplier", event.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20"
          />
        </label>
        <label className="space-y-1.5 md:col-span-2">
          <span className="text-sm font-medium">Fecha de caducidad</span>
          <input
            type="date"
            value={form.expiryDate}
            onChange={(event) => handleChange("expiryDate", event.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20"
          />
        </label>
        <label className="space-y-1.5 md:col-span-2">
          <span className="text-sm font-medium">Descripción</span>
          <textarea
            rows={3}
            value={form.description}
            onChange={(event) => handleChange("description", event.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20"
          />
        </label>
        <label className="space-y-1.5 md:col-span-2">
          <span className="text-sm font-medium">Notas</span>
          <textarea
            rows={2}
            value={form.notes}
            onChange={(event) => handleChange("notes", event.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20"
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
          {item ? "Guardar cambios" : "Agregar producto"}
        </Button>
      </div>
    </form>
  );
}
