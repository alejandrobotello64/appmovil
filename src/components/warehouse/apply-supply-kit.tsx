"use client";

import { useMemo, useState } from "react";
import { Boxes, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/ui/modal-shell";
import { SearchInput } from "@/components/ui/search-input";
import {
  createSupplyKit,
  kitToServiceLines,
  suggestedSupplyKits,
  type KitServiceLine,
} from "@/lib/kits/storage";
import {
  kitEquipmentKindLabel,
  kitServiceTypeLabel,
  type SupplyKit,
  type SupplyKitServiceType,
} from "@/lib/kits/types";
import { inferEquipmentKind } from "@/lib/service-orders/types";
import { matchesSearch } from "@/lib/search";
import { cn } from "@/lib/utils";

type CatalogLine = {
  productId?: string | null;
  description: string;
  quantity: number;
  notes?: string;
};

export function ApplySupplyKitBar({
  kits,
  canEdit,
  serviceType,
  equipmentName,
  equipmentBrand,
  equipmentModel,
  currentLines,
  actor,
  onApply,
  onKitCreated,
}: {
  kits: SupplyKit[];
  canEdit: boolean;
  serviceType?: string;
  equipmentName?: string;
  equipmentBrand?: string;
  equipmentModel?: string;
  currentLines: CatalogLine[];
  actor: string;
  onApply: (lines: KitServiceLine[]) => void;
  onKitCreated?: (kit: SupplyKit) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const equipmentKind = inferEquipmentKind(
    equipmentName ?? "",
    equipmentBrand ?? "",
    equipmentModel ?? ""
  );

  const { matching, rest } = useMemo(
    () =>
      suggestedSupplyKits(kits, {
        serviceType,
        equipmentKind,
        equipmentName,
        equipmentBrand,
        equipmentModel,
      }),
    [
      kits,
      serviceType,
      equipmentKind,
      equipmentName,
      equipmentBrand,
      equipmentModel,
    ]
  );

  const filtered = useMemo(() => {
    const list = [...matching, ...rest];
    return list.filter((kit) =>
      matchesSearch(query, [
        kit.code,
        kit.name,
        kit.description,
        kitServiceTypeLabel(kit.serviceType),
        kitEquipmentKindLabel(kit.equipmentKind),
        ...kit.lines.flatMap((line) => [line.productSku, line.productName]),
      ])
    );
  }, [matching, rest, query]);

  const selected = kits.find((kit) => kit.id === selectedId) ?? null;
  const saveableLines = currentLines.filter(
    (line) => line.productId && line.description.trim() && Number(line.quantity) > 0
  );

  if (!canEdit) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-[#3B46A5]/30 bg-[#3B46A5]/5 p-3">
        <Boxes className="size-4 shrink-0 text-[#3B46A5]" />
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          {matching.length
            ? `${matching.length} kit${matching.length === 1 ? "" : "s"} típico${
                matching.length === 1 ? "" : "s"
              } para este servicio.`
            : "Carga un kit del catálogo o guarda las partidas actuales como kit."}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setError("");
            setQuery("");
            setSelectedId(matching[0]?.id ?? kits.find((kit) => kit.isActive)?.id ?? null);
            setPickerOpen(true);
          }}
        >
          <Plus className="size-3.5" /> Aplicar kit
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!saveableLines.length}
          onClick={() => {
            setError("");
            setSaveName(
              `Kit ${kitServiceTypeLabel(serviceType ?? "")} · ${
                equipmentName || "servicio"
              }`.slice(0, 80)
            );
            setSaveOpen(true);
          }}
        >
          <Save className="size-3.5" /> Guardar como kit
        </Button>
      </div>

      {pickerOpen ? (
        <ModalShell
          title="Aplicar kit a la orden"
          description="Las cantidades se suman si el insumo ya está en las partidas. Luego guarda y solicita a almacén."
          headerAction={
            <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(false)}>
              Cerrar
            </Button>
          }
        >
          <div className="space-y-3">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Buscar kit o insumo…"
            />
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay kits activos. Créalos en Biomédica → Kits o en Almacén → Kits.
              </p>
            ) : (
              <ul className="max-h-56 space-y-1 overflow-y-auto">
                {filtered.map((kit) => {
                  const suggested = matching.some((item) => item.id === kit.id);
                  const active = selectedId === kit.id;
                  return (
                    <li key={kit.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(kit.id)}
                        className={cn(
                          "flex w-full flex-col rounded-lg border px-3 py-2 text-left text-sm",
                          active
                            ? "border-[#3B46A5] bg-[#3B46A5]/5"
                            : "border-border hover:bg-muted/40"
                        )}
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{kit.name}</span>
                          {suggested ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                              Sugerido
                            </span>
                          ) : null}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {kit.code} · {kitServiceTypeLabel(kit.serviceType)} ·{" "}
                          {kit.lines.length} insumo{kit.lines.length === 1 ? "" : "s"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {selected ? (
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="mb-2 text-sm font-medium">{selected.name}</p>
                {selected.description ? (
                  <p className="mb-2 text-xs text-muted-foreground">
                    {selected.description}
                  </p>
                ) : null}
                <ul className="space-y-1 text-xs">
                  {selected.lines.map((line) => (
                    <li key={line.id} className="flex justify-between gap-3">
                      <span>
                        {line.productSku} · {line.productName}
                      </span>
                      <span className="shrink-0 font-medium">
                        {line.quantity} {line.unit}
                      </span>
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  className="mt-3 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                  disabled={!selected.lines.length}
                  onClick={() => {
                    onApply(kitToServiceLines(selected));
                    setPickerOpen(false);
                  }}
                >
                  Agregar {selected.lines.length} partida
                  {selected.lines.length === 1 ? "" : "s"}
                </Button>
              </div>
            ) : null}
          </div>
        </ModalShell>
      ) : null}

      {saveOpen ? (
        <ModalShell
          title="Guardar partidas como kit"
          description="Quedan en el catálogo para la próxima orden del mismo tipo de servicio."
          headerAction={
            <Button type="button" variant="outline" size="sm" onClick={() => setSaveOpen(false)}>
              Cerrar
            </Button>
          }
        >
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Nombre del kit</span>
              <input
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Se guardan {saveableLines.length} insumo
              {saveableLines.length === 1 ? "" : "s"} del catálogo. La mano de obra
              y las partidas libres no entran al kit.
            </p>
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
            <Button
              type="button"
              disabled={saving || !saveName.trim() || !saveableLines.length}
              onClick={() => {
                void (async () => {
                  setSaving(true);
                  setError("");
                  try {
                    const created = await createSupplyKit({
                      name: saveName,
                      serviceType: (serviceType ?? "") as SupplyKitServiceType,
                      equipmentKind,
                      createdBy: actor,
                      lines: saveableLines.map((line) => ({
                        productId: line.productId as string,
                        quantity: Number(line.quantity),
                        notes: line.notes ?? "",
                      })),
                    });
                    onKitCreated?.(created);
                    setSaveOpen(false);
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "No se pudo guardar el kit."
                    );
                  } finally {
                    setSaving(false);
                  }
                })();
              }}
            >
              Guardar en el catálogo
            </Button>
          </div>
        </ModalShell>
      ) : null}
    </>
  );
}
