"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  ChevronDown,
  Copy,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { ReadOnlyBanner } from "@/components/warehouse/read-only-banner";
import { getSession } from "@/lib/auth";
import { useSessionAccess } from "@/lib/auth/use-permissions";
import { catalogModelLabel } from "@/lib/inventory/product-label";
import { getInventoryItems } from "@/lib/inventory/storage";
import type { InventoryItem } from "@/lib/inventory/types";
import {
  canDeleteSupplyKits,
  canViewSupplyKits,
  canWriteSupplyKits,
} from "@/lib/kits/access";
import {
  createSupplyKit,
  deleteSupplyKit,
  duplicateSupplyKit,
  getSupplyKits,
  updateSupplyKit,
} from "@/lib/kits/storage";
import {
  KIT_EQUIPMENT_KIND_OPTIONS,
  KIT_SERVICE_TYPE_OPTIONS,
  kitEquipmentKindLabel,
  kitServiceTypeLabel,
  type SupplyKit,
  type SupplyKitLineInput,
  type SupplyKitServiceType,
} from "@/lib/kits/types";
import { matchesSearch } from "@/lib/search";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none";

type DraftKitLine = SupplyKitLineInput & {
  key: string;
  sku: string;
  name: string;
  model: string;
  category: string;
};

function linesFromKit(kit: SupplyKit): DraftKitLine[] {
  return kit.lines.map((line) => ({
    key: line.id,
    productId: line.productId,
    quantity: line.quantity,
    notes: line.notes,
    sku: line.productSku,
    name: line.productName,
    model: line.productModel,
    category: line.productCategory,
  }));
}

export function SupplyKitsPanel() {
  const access = useSessionAccess();
  const canView = canViewSupplyKits(access.canView);
  const canWrite = canWriteSupplyKits(access.can);
  const canDelete = canDeleteSupplyKits(access.can);
  const session = getSession();
  const actor = session?.username ?? "usuario";

  const [kits, setKits] = useState<SupplyKit[]>([]);
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [serviceFilter, setServiceFilter] = useState<SupplyKitServiceType | "todas">(
    "todas"
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createServiceType, setCreateServiceType] =
    useState<SupplyKitServiceType>("preventivo");
  const [createEquipmentKind, setCreateEquipmentKind] = useState("");
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftServiceType, setDraftServiceType] =
    useState<SupplyKitServiceType>("");
  const [draftEquipmentKind, setDraftEquipmentKind] = useState("");
  const [draftActive, setDraftActive] = useState(true);
  const [draftLines, setDraftLines] = useState<DraftKitLine[]>([]);
  const [productQuery, setProductQuery] = useState("");

  async function reload() {
    setLoading(true);
    setError("");
    try {
      const [list, inventory] = await Promise.all([
        getSupplyKits({ includeInactive: true }),
        getInventoryItems({ kind: "producto" }),
      ]);
      setKits(list);
      setProducts(inventory.filter((item) => item.isActive !== false));
      if (openId && !list.some((kit) => kit.id === openId)) {
        setOpenId(list[0]?.id ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los kits.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const selected = kits.find((kit) => kit.id === openId) ?? null;

  useEffect(() => {
    if (!selected) {
      setDraftName("");
      setDraftDescription("");
      setDraftServiceType("");
      setDraftEquipmentKind("");
      setDraftActive(true);
      setDraftLines([]);
      return;
    }
    setDraftName(selected.name);
    setDraftDescription(selected.description);
    setDraftServiceType(selected.serviceType);
    setDraftEquipmentKind(selected.equipmentKind);
    setDraftActive(selected.isActive);
    setDraftLines(linesFromKit(selected));
    setProductQuery("");
  }, [selected?.id, selected?.updatedAt]);

  const visible = useMemo(
    () =>
      kits.filter((kit) => {
        if (serviceFilter !== "todas" && kit.serviceType !== serviceFilter) {
          return false;
        }
        return matchesSearch(query, [
          kit.code,
          kit.name,
          kit.description,
          kitServiceTypeLabel(kit.serviceType),
          kitEquipmentKindLabel(kit.equipmentKind),
          ...kit.lines.flatMap((line) => [line.productSku, line.productName, line.productModel]),
        ]);
      }),
    [kits, query, serviceFilter]
  );

  const productMatches = useMemo(() => {
    const taken = new Set(draftLines.map((line) => line.productId));
    return products
      .filter((item) => !taken.has(item.id))
      .filter((item) =>
        matchesSearch(productQuery, [
          item.sku,
          item.name,
          item.category,
          item.brand,
          item.model,
          item.partNumber,
        ])
      )
      .slice(0, 12);
  }, [products, draftLines, productQuery]);

  function addProduct(product: InventoryItem) {
    setDraftLines((rows) => [
      ...rows,
      {
        key: crypto.randomUUID(),
        productId: product.id,
        quantity: 1,
        notes: "",
        sku: product.sku,
        name: product.name,
        model: product.model,
        category: product.category,
      },
    ]);
    setProductQuery("");
  }

  async function createKit() {
    if (!canWrite || !createName.trim()) return;
    setSaving(true);
    setError("");
    try {
      const created = await createSupplyKit({
        name: createName,
        description: createDescription,
        serviceType: createServiceType,
        equipmentKind: createEquipmentKind,
        createdBy: actor,
        lines: [],
      });
      setCreateName("");
      setCreateDescription("");
      setShowCreate(false);
      await reload();
      setOpenId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el kit.");
    } finally {
      setSaving(false);
    }
  }

  async function saveSelected() {
    if (!selected || !canWrite) return;
    setSaving(true);
    setError("");
    try {
      await updateSupplyKit(selected.id, {
        name: draftName,
        description: draftDescription,
        serviceType: draftServiceType,
        equipmentKind: draftEquipmentKind,
        isActive: draftActive,
        lines: draftLines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          notes: line.notes,
        })),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el kit.");
    } finally {
      setSaving(false);
    }
  }

  async function copyKit(id: string) {
    if (!canWrite) return;
    setSaving(true);
    setError("");
    try {
      const copy = await duplicateSupplyKit(id, actor);
      await reload();
      setOpenId(copy.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo duplicar el kit.");
    } finally {
      setSaving(false);
    }
  }

  async function removeKit(id: string) {
    if (!canDelete) return;
    if (!window.confirm("¿Eliminar este kit del catálogo?")) return;
    setSaving(true);
    setError("");
    try {
      await deleteSupplyKit(id);
      if (openId === id) setOpenId(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el kit.");
    } finally {
      setSaving(false);
    }
  }

  if (access.ready && !canView) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Sin acceso a kits</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu rol no puede consultar el catálogo de kits de servicio.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#3B46A5]">
            Catálogo de kits
          </h2>
          <p className="text-sm text-muted-foreground">
            Arma listas típicas de insumos una vez y aplícalas en la orden de
            servicio, sin volver a cargar cada partida.
          </p>
        </div>
        {canWrite ? (
          <Button
            type="button"
            onClick={() => setShowCreate((value) => !value)}
          >
            <Plus className="size-4" /> Nuevo kit
          </Button>
        ) : null}
      </div>

      <ReadOnlyBanner visible={!canWrite} />

      {showCreate && canWrite ? (
        <div className="grid gap-3 rounded-2xl border border-dashed border-teal-300 bg-teal-50/40 p-4 dark:border-teal-800 dark:bg-teal-950/10 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted-foreground">Nombre</span>
            <input
              className={fieldClass}
              placeholder="Ej. Preventivo mensual · anestesia"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">
              Tipo de servicio
            </span>
            <select
              className={fieldClass}
              value={createServiceType}
              onChange={(e) =>
                setCreateServiceType(e.target.value as SupplyKitServiceType)
              }
            >
              {KIT_SERVICE_TYPE_OPTIONS.map((option) => (
                <option key={option.id || "any"} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Equipo típico</span>
            <select
              className={fieldClass}
              value={createEquipmentKind}
              onChange={(e) => setCreateEquipmentKind(e.target.value)}
            >
              {KIT_EQUIPMENT_KIND_OPTIONS.map((option) => (
                <option key={option.id || "any"} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted-foreground">
              Descripción (opcional)
            </span>
            <textarea
              className="min-h-16 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button
              type="button"
              disabled={saving || !createName.trim()}
              onClick={() => void createKit()}
            >
              Crear kit
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCreate(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Buscar kit, SKU o insumo…"
          className="sm:flex-1"
        />
        <select
          className={cn(fieldClass, "sm:w-56")}
          value={serviceFilter}
          onChange={(e) =>
            setServiceFilter(e.target.value as SupplyKitServiceType | "todas")
          }
        >
          <option value="todas">Todos los servicios</option>
          {KIT_SERVICE_TYPE_OPTIONS.filter((option) => option.id).map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando kits…</p>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          {query.trim() || serviceFilter !== "todas"
            ? "Ningún kit coincide con la búsqueda."
            : "Todavía no hay kits. Crea el primero con los insumos que siempre pides en un preventivo, un correctivo o una instalación."}
        </p>
      ) : (
        <div className="space-y-2">
          {visible.map((kit) => {
            const isOpen = openId === kit.id;
            return (
              <div
                key={kit.id}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : kit.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
                >
                  <Boxes className="size-4 shrink-0 text-[#3B46A5]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{kit.name}</p>
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200">
                        {kitServiceTypeLabel(kit.serviceType)}
                      </span>
                      {!kit.isActive ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Inactivo
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {kit.code} · {kitEquipmentKindLabel(kit.equipmentKind)} ·{" "}
                      {kit.lines.length} insumo{kit.lines.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <ChevronDown
                    className={cn(
                      "size-4 text-muted-foreground transition-transform",
                      isOpen ? "rotate-180" : "rotate-0"
                    )}
                  />
                </button>

                {isOpen && selected?.id === kit.id ? (
                  <div className="space-y-3 border-t border-border px-4 py-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm sm:col-span-2">
                        <span className="mb-1 block text-muted-foreground">
                          Nombre
                        </span>
                        <input
                          className={fieldClass}
                          value={draftName}
                          disabled={!canWrite}
                          onChange={(e) => setDraftName(e.target.value)}
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block text-muted-foreground">
                          Tipo de servicio
                        </span>
                        <select
                          className={fieldClass}
                          value={draftServiceType}
                          disabled={!canWrite}
                          onChange={(e) =>
                            setDraftServiceType(
                              e.target.value as SupplyKitServiceType
                            )
                          }
                        >
                          {KIT_SERVICE_TYPE_OPTIONS.map((option) => (
                            <option key={option.id || "any"} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block text-muted-foreground">
                          Equipo típico
                        </span>
                        <select
                          className={fieldClass}
                          value={draftEquipmentKind}
                          disabled={!canWrite}
                          onChange={(e) => setDraftEquipmentKind(e.target.value)}
                        >
                          {KIT_EQUIPMENT_KIND_OPTIONS.map((option) => (
                            <option key={option.id || "any"} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm sm:col-span-2">
                        <span className="mb-1 block text-muted-foreground">
                          Descripción
                        </span>
                        <textarea
                          className="min-h-16 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                          value={draftDescription}
                          disabled={!canWrite}
                          onChange={(e) => setDraftDescription(e.target.value)}
                        />
                      </label>
                      <label className="flex items-center gap-2 text-sm sm:col-span-2">
                        <input
                          type="checkbox"
                          checked={draftActive}
                          disabled={!canWrite}
                          onChange={(e) => setDraftActive(e.target.checked)}
                        />
                        Disponible para aplicar en órdenes
                      </label>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="min-w-full text-sm">
                        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2">SKU</th>
                            <th className="px-3 py-2">Insumo</th>
                            <th className="px-3 py-2">Cant</th>
                            <th className="px-3 py-2">Notas</th>
                            <th className="px-3 py-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {draftLines.length === 0 ? (
                            <tr>
                              <td
                                colSpan={5}
                                className="px-3 py-4 text-sm text-muted-foreground"
                              >
                                Este kit aún no tiene insumos. Búscalos abajo para
                                armar la lista típica.
                              </td>
                            </tr>
                          ) : (
                            draftLines.map((line) => (
                              <tr key={line.key} className="border-t border-border">
                                <td className="px-3 py-2 font-mono text-xs">
                                  {line.sku}
                                </td>
                                <td className="px-3 py-2">
                                  <p>{line.name}</p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {catalogModelLabel(line.model)} · {line.category}
                                  </p>
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
                                        rows.map((row) =>
                                          row.key === line.key
                                            ? {
                                                ...row,
                                                quantity: Number(e.target.value),
                                              }
                                            : row
                                        )
                                      )
                                    }
                                  />
                                </td>
                                <td className="px-2 py-2">
                                  <input
                                    className="h-9 w-full min-w-[120px] rounded-md border border-input bg-background px-2 text-xs"
                                    value={line.notes ?? ""}
                                    disabled={!canWrite}
                                    onChange={(e) =>
                                      setDraftLines((rows) =>
                                        rows.map((row) =>
                                          row.key === line.key
                                            ? { ...row, notes: e.target.value }
                                            : row
                                        )
                                      )
                                    }
                                  />
                                </td>
                                <td className="px-2 py-2">
                                  {canWrite ? (
                                    <button
                                      type="button"
                                      className="text-destructive"
                                      onClick={() =>
                                        setDraftLines((rows) =>
                                          rows.filter((row) => row.key !== line.key)
                                        )
                                      }
                                    >
                                      <Trash2 className="size-3.5" />
                                    </button>
                                  ) : null}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {canWrite ? (
                      <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
                        <p className="text-sm font-medium">Agregar insumo del catálogo</p>
                        <SearchInput
                          value={productQuery}
                          onChange={setProductQuery}
                          placeholder="SKU, nombre o número de parte…"
                        />
                        {productQuery.trim() ? (
                          productMatches.length ? (
                            <ul className="divide-y divide-border rounded-lg border border-border">
                              {productMatches.map((product) => (
                                <li key={product.id}>
                                  <button
                                    type="button"
                                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50"
                                    onClick={() => addProduct(product)}
                                  >
                                    <span>
                                      <span className="font-mono text-xs text-muted-foreground">
                                        {product.sku}
                                      </span>
                                      <span className="ml-2">{product.name}</span>
                                      <span className="ml-2 text-xs text-muted-foreground">
                                        {catalogModelLabel(product.model)}
                                      </span>
                                    </span>
                                    <Plus className="size-3.5 shrink-0" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              No hay artículos activos que coincidan, o ya están
                              en el kit.
                            </p>
                          )
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Escribe para buscar en el inventario (insumos,
                            refacciones, accesorios, medicamentos o reactivos).
                          </p>
                        )}
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                      {canWrite ? (
                        <Button
                          type="button"
                          disabled={saving || !draftName.trim()}
                          className="bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                          onClick={() => void saveSelected()}
                        >
                          Guardar kit
                        </Button>
                      ) : null}
                      {canWrite ? (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={saving}
                          onClick={() => void copyKit(kit.id)}
                        >
                          <Copy className="size-3.5" /> Duplicar
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={saving}
                          onClick={() => void removeKit(kit.id)}
                        >
                          <Trash2 className="size-3.5" /> Eliminar
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
