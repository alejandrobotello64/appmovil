"use client";

import { useMemo, useState } from "react";
import { Calculator, Plus, ShieldCheck, SlidersHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  IVA_RETENTION_TWO_THIRDS,
  SERVICE_TAX_PRESETS,
  computeServiceTotals,
  serviceTaxLabel,
  type ServiceLineKind,
  type ServicePricing,
} from "@/lib/service-orders/types";
import { cn } from "@/lib/utils";

const CHARGE_SUGGESTIONS = ["Viáticos", "Flete / envío", "Visita técnica", "Hospedaje"];

const inputClass =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none disabled:opacity-60";

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function percentLabel(value: number) {
  return `${Number(value.toFixed(4))}%`;
}

function taxPresetId(pricing: ServicePricing) {
  if (pricing.taxExempt) return "exento";
  const preset = SERVICE_TAX_PRESETS.find(
    (item) => !item.exempt && item.rate === Number(pricing.taxRate)
  );
  return preset ? preset.id : "otra";
}

function SummaryRow({
  label,
  value,
  tone = "default",
  strong = false,
}: {
  label: string;
  value: string;
  tone?: "default" | "negative" | "positive" | "muted";
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3 py-1 text-sm",
        strong && "font-semibold"
      )}
    >
      <span className={cn(tone === "muted" ? "text-muted-foreground" : "text-foreground/80")}>
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums",
          tone === "negative" && "text-rose-700 dark:text-rose-300",
          tone === "positive" && "text-sky-700 dark:text-sky-300",
          tone === "muted" && "text-muted-foreground"
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function ServicePricingSummary({
  lines,
  pricing,
  onChange,
  canEdit,
  underWarranty,
  dirty,
}: {
  lines: {
    quantity: number;
    unitPrice: number;
    discountPercent?: number;
    lineKind: ServiceLineKind;
  }[];
  pricing: ServicePricing;
  onChange: (next: ServicePricing) => void;
  canEdit: boolean;
  underWarranty: boolean;
  /** True when lines or pricing differ from what is saved. */
  dirty: boolean;
}) {
  const [customizing, setCustomizing] = useState(false);
  const [customTax, setCustomTax] = useState(false);
  const totals = useMemo(() => computeServiceTotals(lines, pricing), [lines, pricing]);
  const discountMode = pricing.discountPercent > 0 ? "percent" : "amount";
  const presetId = customTax ? "otra" : taxPresetId(pricing);

  function update(patch: Partial<ServicePricing>) {
    onChange({ ...pricing, ...patch });
  }

  function updateCharge(id: string, patch: Partial<ServicePricing["extraCharges"][number]>) {
    update({
      extraCharges: pricing.extraCharges.map((charge) =>
        charge.id === id ? { ...charge, ...patch } : charge
      ),
    });
  }

  function addCharge(label = "") {
    update({
      extraCharges: [
        ...pricing.extraCharges,
        { id: crypto.randomUUID(), label, amount: 0, taxable: true },
      ],
    });
  }

  const taxableCharges = pricing.extraCharges.filter((c) => c.taxable && c.amount > 0);
  const nonTaxableCharges = pricing.extraCharges.filter((c) => !c.taxable && c.amount > 0);

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <Calculator className="size-4" />
          Resumen de costos
          {dirty ? (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-200">
              Sin guardar
            </span>
          ) : null}
        </h4>
        {canEdit ? (
          <Button
            type="button"
            size="sm"
            variant={customizing ? "default" : "outline"}
            onClick={() => setCustomizing((value) => !value)}
          >
            <SlidersHorizontal className="size-3.5" />
            {customizing ? "Ocultar ajustes" : "Personalizar"}
          </Button>
        ) : null}
      </div>

      {underWarranty ? (
        <p className="mb-3 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-200">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          Orden cubierta por garantía: confirma si el cliente debe pagar este total o
          ajusta los importes.
        </p>
      ) : null}

      <div className={cn("grid gap-4", customizing && canEdit && "lg:grid-cols-2")}>
        {customizing && canEdit ? (
          <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-3">
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Impuesto</p>
              <div className="flex gap-2">
                <select
                  className={inputClass}
                  value={presetId}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "otra") {
                      setCustomTax(true);
                      update({ taxExempt: false });
                      return;
                    }
                    setCustomTax(false);
                    const preset = SERVICE_TAX_PRESETS.find((item) => item.id === value);
                    if (preset) update({ taxRate: preset.rate, taxExempt: preset.exempt });
                  }}
                >
                  {SERVICE_TAX_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                  <option value="otra">Otra tasa…</option>
                </select>
                {presetId === "otra" ? (
                  <div className="relative w-28 shrink-0">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="any"
                      className={cn(inputClass, "pr-6")}
                      value={pricing.taxRate}
                      onChange={(e) => update({ taxRate: Number(e.target.value) })}
                    />
                    <span className="pointer-events-none absolute right-2 top-2 text-xs text-muted-foreground">
                      %
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Descuento general (sobre partidas)
              </p>
              <div className="flex gap-2">
                <div className="inline-flex shrink-0 overflow-hidden rounded-md border border-input text-xs">
                  {(["percent", "amount"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={cn(
                        "px-3",
                        discountMode === mode
                          ? "bg-[#3B46A5] text-white"
                          : "bg-background text-muted-foreground hover:bg-muted/50"
                      )}
                      onClick={() =>
                        mode === "percent"
                          ? update({ discountPercent: pricing.discountPercent || 5, discount: 0 })
                          : update({ discountPercent: 0, discount: totals.discountAmount })
                      }
                    >
                      {mode === "percent" ? "%" : "$"}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={0}
                  max={discountMode === "percent" ? 100 : undefined}
                  step="any"
                  className={inputClass}
                  value={discountMode === "percent" ? pricing.discountPercent : pricing.discount}
                  onChange={(e) =>
                    discountMode === "percent"
                      ? update({ discountPercent: Number(e.target.value) })
                      : update({ discount: Number(e.target.value) })
                  }
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                También puedes poner descuento por partida en la columna “Desc. %”.
              </p>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Retenciones</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">
                  <span className="mb-1 block text-muted-foreground">ISR retenido %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    className={inputClass}
                    value={pricing.retentionIsrPercent}
                    onChange={(e) => update({ retentionIsrPercent: Number(e.target.value) })}
                  />
                </label>
                <label className="text-xs">
                  <span className="mb-1 block text-muted-foreground">IVA retenido %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    className={inputClass}
                    value={pricing.retentionIvaPercent}
                    onChange={(e) => update({ retentionIvaPercent: Number(e.target.value) })}
                  />
                </label>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                <button
                  type="button"
                  className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted/50"
                  onClick={() => update({ retentionIvaPercent: IVA_RETENTION_TWO_THIRDS })}
                >
                  IVA 2/3 ({IVA_RETENTION_TWO_THIRDS}%)
                </button>
                <button
                  type="button"
                  className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted/50"
                  onClick={() => update({ retentionIsrPercent: 10 })}
                >
                  ISR 10%
                </button>
                <button
                  type="button"
                  className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted/50"
                  onClick={() => update({ retentionIsrPercent: 1.25 })}
                >
                  ISR 1.25% (RESICO)
                </button>
                {pricing.retentionIsrPercent || pricing.retentionIvaPercent ? (
                  <button
                    type="button"
                    className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted/50"
                    onClick={() => update({ retentionIsrPercent: 0, retentionIvaPercent: 0 })}
                  >
                    Sin retenciones
                  </button>
                ) : null}
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Cargos adicionales</p>
              {pricing.extraCharges.length ? (
                <ul className="space-y-2">
                  {pricing.extraCharges.map((charge) => (
                    <li key={charge.id} className="flex flex-wrap items-center gap-2">
                      <input
                        className={cn(inputClass, "min-w-[140px] flex-1")}
                        placeholder="Concepto"
                        value={charge.label}
                        onChange={(e) => updateCharge(charge.id, { label: e.target.value })}
                      />
                      <input
                        type="number"
                        min={0}
                        step="any"
                        className={cn(inputClass, "w-28")}
                        value={charge.amount}
                        onChange={(e) =>
                          updateCharge(charge.id, { amount: Number(e.target.value) })
                        }
                      />
                      <label className="flex items-center gap-1 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={charge.taxable}
                          onChange={(e) => updateCharge(charge.id, { taxable: e.target.checked })}
                        />
                        Lleva IVA
                      </label>
                      <button
                        type="button"
                        className="text-destructive"
                        aria-label="Quitar cargo"
                        onClick={() =>
                          update({
                            extraCharges: pricing.extraCharges.filter((c) => c.id !== charge.id),
                          })
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-1">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] hover:bg-muted/50"
                  onClick={() => addCharge()}
                >
                  <Plus className="size-3" /> Cargo
                </button>
                {CHARGE_SUGGESTIONS.filter(
                  (label) => !pricing.extraCharges.some((charge) => charge.label === label)
                ).map((label) => (
                  <button
                    key={label}
                    type="button"
                    className="rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted/50"
                    onClick={() => addCharge(label)}
                  >
                    + {label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={pricing.showPricesInPdf}
                onChange={(e) => update({ showPricesInPdf: e.target.checked })}
              />
              <span>
                Mostrar importes y resumen en los PDF de cotización y orden de trabajo
                <span className="block text-muted-foreground">
                  Desmárcalo para servicios en garantía o internos.
                </span>
              </span>
            </label>
          </div>
        ) : null}

        <div className="space-y-3">
          {totals.byKind.length ? (
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Desglose por tipo</p>
              {totals.byKind.map((item) => (
                <SummaryRow key={item.kind} label={item.label} value={money(item.amount)} />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
              Agrega partidas para ver el resumen.
            </p>
          )}

          <div className="divide-y divide-border/60 rounded-lg border border-border p-3">
            <div>
              <SummaryRow label="Importe de partidas" value={money(totals.linesGross)} />
              {totals.lineDiscounts > 0 ? (
                <SummaryRow
                  label="Descuentos por partida"
                  value={`−${money(totals.lineDiscounts)}`}
                  tone="negative"
                />
              ) : null}
              {totals.discountAmount > 0 ? (
                <SummaryRow
                  label={
                    totals.discountPercent > 0
                      ? `Descuento general (${percentLabel(totals.discountPercent)})`
                      : "Descuento general"
                  }
                  value={`−${money(totals.discountAmount)}`}
                  tone="negative"
                />
              ) : null}
              {taxableCharges.map((charge) => (
                <SummaryRow
                  key={charge.id}
                  label={charge.label || "Cargo adicional"}
                  value={`+${money(charge.amount)}`}
                  tone="positive"
                />
              ))}
            </div>
            <div>
              <SummaryRow label="Subtotal" value={money(totals.subtotal)} strong />
              <SummaryRow
                label={serviceTaxLabel(totals)}
                value={money(totals.taxAmount)}
                tone={totals.taxAmount > 0 ? "default" : "muted"}
              />
              {nonTaxableCharges.map((charge) => (
                <SummaryRow
                  key={charge.id}
                  label={`${charge.label || "Cargo adicional"} (sin IVA)`}
                  value={`+${money(charge.amount)}`}
                  tone="positive"
                />
              ))}
              {totals.retentionIsr > 0 ? (
                <SummaryRow
                  label={`Retención ISR (${percentLabel(totals.retentionIsrPercent)})`}
                  value={`−${money(totals.retentionIsr)}`}
                  tone="negative"
                />
              ) : null}
              {totals.retentionIva > 0 ? (
                <SummaryRow
                  label={`Retención IVA (${percentLabel(totals.retentionIvaPercent)})`}
                  value={`−${money(totals.retentionIva)}`}
                  tone="negative"
                />
              ) : null}
            </div>
            <div className="flex items-baseline justify-between gap-3 pt-2">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-xl font-bold tabular-nums">{money(totals.total)}</span>
            </div>
          </div>
          {!pricing.showPricesInPdf ? (
            <p className="text-[11px] text-muted-foreground">
              Los importes no se imprimen en los PDF de esta orden.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
