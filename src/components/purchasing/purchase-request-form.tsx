"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/ui/modal-shell";
import { Notice, fieldClass, primaryButtonClass, textareaClass } from "@/components/tools/tools-shared";
import { useSessionAccess } from "@/lib/auth/use-permissions";
import { getInventoryItems } from "@/lib/inventory/storage";
import type { InventoryItem } from "@/lib/inventory/types";
import { createPurchaseRequest } from "@/lib/purchasing/storage";
import {
  PURCHASE_PRIORITIES,
  type PurchasePriority,
  type PurchaseRequest,
  type RequisitionShortage,
} from "@/lib/purchasing/types";
import type { ServiceOrderRequisition } from "@/lib/service-orders/requisitions";
import { cn } from "@/lib/utils";
import { formatQty } from "./purchasing-shared";

type DraftLine = {
  key: string;
  include: boolean;
  requisitionLineId: string | null;
  productId: string | null;
  productSku: string;
  productName: string;
  description: string;
  unit: string;
  quantity: string;
  stockAtRequest: number;
  shortage?: RequisitionShortage;
};

let draftSeq = 0;
const nextKey = () => `draft-${++draftSeq}`;

function originRef(requisition: ServiceOrderRequisition) {
  return requisition.sourceType === "cotizacion"
    ? `cotización ${requisition.quoteFolio || "—"}`
    : `OS ${requisition.serviceOrderFolio || "—"}`;
}

function linesFromShortages(shortages: RequisitionShortage[]): DraftLine[] {
  return shortages.map((item) => ({
    key: item.lineId,
    include: item.shortage > 0,
    requisitionLineId: item.lineId,
    productId: item.productId,
    productSku: item.productSku,
    productName: item.description,
    description: item.description,
    unit: item.unit,
    quantity: formatQty(item.shortage > 0 ? item.shortage : Math.max(0, item.pending - item.inPurchase)),
    stockAtRequest: item.available,
    shortage: item,
  }));
}

export type PurchaseRequestFormProps = {
  onClose: () => void;
  onCreated: (request: PurchaseRequest) => void;
} & (
  | { mode: "manual" }
  | { mode: "faltantes"; requisition: ServiceOrderRequisition; shortages: RequisitionShortage[] }
);

export function PurchaseRequestForm(props: PurchaseRequestFormProps) {
  const { session } = useSessionAccess();
  const fromRequisition = props.mode === "faltantes";
  const [lines, setLines] = useState<DraftLine[]>(() =>
    props.mode === "faltantes" ? linesFromShortages(props.shortages) : []
  );
  const [priority, setPriority] = useState<PurchasePriority>("normal");
  const [neededBy, setNeededBy] = useState("");
  const [justification, setJustification] = useState(
    props.mode === "faltantes"
      ? `Material faltante para surtir ${props.requisition.folio} (${originRef(props.requisition)}).`
      : ""
  );
  const [notes, setNotes] = useState("");
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (fromRequisition) return;
    let active = true;
    getInventoryItems()
      .then((items) => {
        if (active) setProducts(items.filter((item) => item.isActive));
      })
      .catch(() => {
        if (active) setError("No se pudo cargar el catálogo; puedes capturar el material a mano.");
      });
    return () => {
      active = false;
    };
  }, [fromRequisition]);

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return products
      .filter((item) => `${item.sku} ${item.name} ${item.brand} ${item.model}`.toLowerCase().includes(term))
      .slice(0, 8);
  }, [products, search]);

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function addProduct(item: InventoryItem) {
    setLines((current) => [
      ...current,
      {
        key: nextKey(),
        include: true,
        requisitionLineId: null,
        productId: item.id,
        productSku: item.sku,
        productName: item.name,
        description: item.name,
        unit: item.unit,
        quantity: String(Math.max(1, item.minStock - item.quantity)),
        stockAtRequest: item.quantity,
      },
    ]);
    setSearch("");
  }

  function addFreeLine() {
    setLines((current) => [
      ...current,
      {
        key: nextKey(),
        include: true,
        requisitionLineId: null,
        productId: null,
        productSku: "",
        productName: "",
        description: "",
        unit: "pieza",
        quantity: "1",
        stockAtRequest: 0,
      },
    ]);
  }

  const selectedLines = lines.filter((line) => line.include && Number(line.quantity) > 0);

  async function onSubmit() {
    if (!session) return;
    if (!selectedLines.length) {
      setError("Selecciona al menos un material con cantidad mayor a 0.");
      return;
    }
    const missing = selectedLines.find((line) => !line.productId && !line.description.trim());
    if (missing) {
      setError("Describe el material que no está en el catálogo.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const created = await createPurchaseRequest({
        requisitionId: props.mode === "faltantes" ? props.requisition.id : null,
        priority,
        neededBy,
        justification,
        notes,
        requester: { username: session.username, fullName: session.fullName ?? null },
        lines: selectedLines.map((line) => ({
          requisitionLineId: line.requisitionLineId,
          productId: line.productId,
          productSku: line.productSku,
          productName: line.productName,
          description: line.description,
          unit: line.unit,
          quantity: Number(line.quantity),
          stockAtRequest: line.stockAtRequest,
        })),
      });
      props.onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la solicitud de compra.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title={fromRequisition ? "Solicitar compra de faltantes" : "Nueva solicitud de compra"}
      description={
        props.mode === "faltantes"
          ? `${props.requisition.folio} · ${originRef(props.requisition)} · ${props.requisition.clientName || "Sin cliente"}`
          : "Material que se necesita comprar aunque no venga de una orden de surtimiento."
      }
      className="max-w-4xl"
      headerAction={
        <Button type="button" variant="ghost" size="icon" onClick={props.onClose} aria-label="Cerrar">
          <X className="size-4" />
        </Button>
      }
    >
      <div className="space-y-4">
        <Notice tone="error">{error}</Notice>

        {fromRequisition ? (
          <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            El faltante es lo pendiente de surtir menos lo disponible en almacén y lo que ya está en otra compra
            abierta. Puedes ajustar la cantidad antes de enviarla a compras.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className={cn(fieldClass, "pl-9")}
                placeholder="Buscar en el catálogo por SKU, nombre, marca o modelo…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {matches.length ? (
              <ul className="divide-y divide-border rounded-lg border border-border bg-background">
                {matches.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => addProduct(item)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted/40"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{item.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.sku} · Stock {formatQty(item.quantity)} {item.unit} · Mín. {formatQty(item.minStock)}
                        </span>
                      </span>
                      <Plus className="size-4 shrink-0 text-[#3B46A5]" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <Button type="button" variant="outline" onClick={addFreeLine}>
              <Plus className="size-4" /> Material fuera de catálogo
            </Button>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                {fromRequisition ? <th className="w-10 px-3 py-2" /> : null}
                <th className="px-3 py-2">Material</th>
                {fromRequisition ? (
                  <>
                    <th className="px-3 py-2 text-center">Pendiente</th>
                    <th className="px-3 py-2 text-center">Disponible</th>
                    <th className="px-3 py-2 text-center">En compra</th>
                  </>
                ) : (
                  <th className="px-3 py-2 text-center">Stock</th>
                )}
                <th className="px-3 py-2">Unidad</th>
                <th className="px-3 py-2">Comprar</th>
                {!fromRequisition ? <th className="w-10 px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={fromRequisition ? 7 : 5} className="px-3 py-6 text-center text-muted-foreground">
                    {fromRequisition ? "Esta solicitud no tiene material pendiente." : "Busca un producto o agrega material fuera de catálogo."}
                  </td>
                </tr>
              ) : (
                lines.map((line) => (
                  <tr key={line.key} className={cn("border-t border-border align-top", !line.include && "opacity-60")}>
                    {fromRequisition ? (
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          className="mt-2 size-4 accent-[#3B46A5]"
                          checked={line.include}
                          onChange={(e) => updateLine(line.key, { include: e.target.checked })}
                          aria-label={`Incluir ${line.description}`}
                        />
                      </td>
                    ) : null}
                    <td className="min-w-56 px-3 py-2">
                      {line.productId ? (
                        <>
                          <p className="font-medium">{line.description}</p>
                          <p className="text-xs text-muted-foreground">{line.productSku || "Sin SKU"}</p>
                        </>
                      ) : (
                        <input
                          className={cn(fieldClass, "h-9")}
                          placeholder="Descripción del material"
                          value={line.description}
                          onChange={(e) => updateLine(line.key, { description: e.target.value })}
                        />
                      )}
                    </td>
                    {line.shortage ? (
                      <>
                        <td className="px-3 py-2 text-center tabular-nums">{formatQty(line.shortage.pending)}</td>
                        <td className="px-3 py-2 text-center tabular-nums">{formatQty(line.shortage.available)}</td>
                        <td className="px-3 py-2 text-center tabular-nums">{formatQty(line.shortage.inPurchase)}</td>
                      </>
                    ) : (
                      <td className="px-3 py-2 text-center tabular-nums">
                        {line.productId ? formatQty(line.stockAtRequest) : "—"}
                      </td>
                    )}
                    <td className="px-3 py-2">
                      {line.productId ? (
                        <span className="inline-block pt-2">{line.unit}</span>
                      ) : (
                        <input
                          className={cn(fieldClass, "h-9 w-24")}
                          value={line.unit}
                          onChange={(e) => updateLine(line.key, { unit: e.target.value })}
                        />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className={cn(fieldClass, "h-9 w-24")}
                        value={line.quantity}
                        disabled={!line.include}
                        onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                      />
                    </td>
                    {!fromRequisition ? (
                      <td className="px-3 py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Quitar"
                          onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Prioridad</span>
            <select className={fieldClass} value={priority} onChange={(e) => setPriority(e.target.value as PurchasePriority)}>
              {PURCHASE_PRIORITIES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Se necesita para (opcional)</span>
            <input type="date" className={fieldClass} value={neededBy} onChange={(e) => setNeededBy(e.target.value)} />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">
            Justificación {fromRequisition ? "" : <span className="text-destructive">*</span>}
          </span>
          <textarea className={textareaClass} value={justification} onChange={(e) => setJustification(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Notas para compras (marca preferida, proveedor sugerido…)</span>
          <textarea className={textareaClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" onClick={props.onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            className={primaryButtonClass}
            disabled={saving || !selectedLines.length}
            onClick={() => void onSubmit()}
          >
            <ShoppingCart className="size-4" />
            {saving ? "Enviando…" : `Enviar a compras (${selectedLines.length})`}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
