import { daysUntilExpiry } from "@/lib/inventory/expiry";
import {
  SERIAL_STATUS_LABELS,
  type InventoryLotStock,
  type InventoryTracking,
} from "@/lib/inventory/tracking";
import type { InventoryItem } from "@/lib/inventory/types";
import { cn } from "@/lib/utils";
import { SortableTable } from "@/components/ui/sortable-table";

/** expiry: lote + caducidad · manufacture: lote + fabricación · auto: lo que tenga cada lote */
export type TrackingDateMode = "expiry" | "manufacture" | "auto";

const EXPIRY_WARNING_DAYS = 90;
const SUMMARY_LOTS = 2;

export function trackingColumnLabel(mode: TrackingDateMode) {
  if (mode === "expiry") return "Lote / caducidad";
  if (mode === "manufacture") return "Lote / fabricación";
  return "Lote / serie";
}

export function trackingSearchText(tracking: InventoryTracking | undefined) {
  if (!tracking) return "";
  return [
    ...tracking.lots.map((lot) => lot.lotNumber),
    ...tracking.serials.map((serial) => serial.serialNumber),
  ].join(" ");
}

function expiryState(date: string) {
  const days = date ? daysUntilExpiry(date) : null;
  if (days === null) return { tone: "", hint: "" };
  if (days < 0) return { tone: "text-destructive", hint: "caducado" };
  if (days === 0) return { tone: "text-destructive", hint: "caduca hoy" };
  if (days <= EXPIRY_WARNING_DAYS) {
    return {
      tone: "text-amber-700 dark:text-amber-300",
      hint: `${days} día${days === 1 ? "" : "s"}`,
    };
  }
  return { tone: "text-muted-foreground", hint: "" };
}

function LotDate({
  expiryDate,
  manufacturedAt,
  mode,
}: {
  expiryDate: string;
  manufacturedAt: string;
  mode: TrackingDateMode;
}) {
  const showExpiry = mode === "expiry" || (mode === "auto" && Boolean(expiryDate));
  if (showExpiry) {
    if (!expiryDate) {
      return <span className="text-amber-700 dark:text-amber-300">Sin caducidad</span>;
    }
    const { tone, hint } = expiryState(expiryDate);
    return (
      <span className={tone}>
        Cad. {expiryDate}
        {hint ? ` · ${hint}` : ""}
      </span>
    );
  }
  return (
    <span className="text-muted-foreground">
      {manufacturedAt ? `Fab. ${manufacturedAt}` : "Sin fecha de fabricación"}
    </span>
  );
}

function legacyLabel(item: InventoryItem) {
  if (item.tracksSerial || item.itemKind === "equipo") return "Serie";
  if (item.tracksLot) return "Lote";
  return "Serie / lote";
}

function lotQuantity(lot: InventoryLotStock, unit: string) {
  return `${lot.quantity} ${unit}`.trim();
}

type TrackingProps = {
  item: InventoryItem;
  tracking: InventoryTracking | undefined;
  mode: TrackingDateMode;
};

/** Resumen compacto para tablas y tarjetas: lotes más próximos a caducar o series. */
export function TrackingSummary({ item, tracking, mode }: TrackingProps) {
  const lots = tracking?.lots ?? [];
  const serials = tracking?.serials ?? [];

  if (lots.length > 0) {
    const hidden = lots.length - SUMMARY_LOTS;
    return (
      <div className="space-y-1 text-xs">
        {lots.slice(0, SUMMARY_LOTS).map((lot) => (
          <div key={lot.lotNumber}>
            <p className="font-medium text-foreground">
              Lote {lot.lotNumber || "—"}
              <span className="font-normal text-muted-foreground">
                {" "}
                · {lotQuantity(lot, item.unit)}
              </span>
            </p>
            <p>
              <LotDate
                expiryDate={lot.expiryDate}
                manufacturedAt={lot.manufacturedAt}
                mode={mode}
              />
            </p>
          </div>
        ))}
        {hidden > 0 ? (
          <p className="text-muted-foreground">
            +{hidden} lote{hidden === 1 ? "" : "s"} más
          </p>
        ) : null}
      </div>
    );
  }

  if (serials.length > 0) {
    const hidden = serials.length - 1;
    return (
      <div className="text-xs">
        <p className="font-medium text-foreground">Serie {serials[0].serialNumber}</p>
        <p className="text-muted-foreground">
          {SERIAL_STATUS_LABELS[serials[0].status] ?? serials[0].status}
          {hidden > 0 ? ` · +${hidden} serie${hidden === 1 ? "" : "s"}` : ""}
        </p>
      </div>
    );
  }

  if (item.serialNumber) {
    return (
      <div className="text-xs">
        <p className="font-medium text-foreground">
          {legacyLabel(item)} {item.serialNumber}
        </p>
        {item.expiryDate || item.manufacturedAt ? (
          <p>
            <LotDate
              expiryDate={item.expiryDate}
              manufacturedAt={item.manufacturedAt}
              mode={mode}
            />
          </p>
        ) : null}
      </div>
    );
  }

  return <span className="text-xs text-muted-foreground">—</span>;
}

/** Detalle para la ficha: existencia por lote y números de serie vigentes. */
export function TrackingDetail({ item, tracking, mode }: TrackingProps) {
  const lots = tracking?.lots ?? [];
  const serials = tracking?.serials ?? [];
  const dateHeader =
    mode === "expiry" ? "Caducidad" : mode === "manufacture" ? "Fabricación" : "Caducidad / fabricación";

  if (lots.length === 0 && serials.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {item.serialNumber
          ? `Sin lotes ni series con existencia registrados. ${legacyLabel(item)} capturado: ${item.serialNumber}.`
          : "Sin lotes ni números de serie con existencia registrados."}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {lots.length > 0 ? (
        <div>
          <p className="mb-2 text-sm font-semibold">
            Lotes en existencia ({lots.length})
          </p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <SortableTable className="min-w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Lote</th>
                  <th className="px-3 py-2 font-medium">Cantidad</th>
                  <th className="px-3 py-2 font-medium">{dateHeader}</th>
                  <th className="px-3 py-2 font-medium">Ubicación</th>
                </tr>
              </thead>
              <tbody>
                {lots.map((lot) => (
                  <tr key={lot.lotNumber} className="border-t border-border/70">
                    <td className="px-3 py-2 font-mono text-xs">{lot.lotNumber || "—"}</td>
                    <td className="px-3 py-2">{lotQuantity(lot, item.unit)}</td>
                    <td className="px-3 py-2 text-xs">
                      <LotDate
                        expiryDate={lot.expiryDate}
                        manufacturedAt={lot.manufacturedAt}
                        mode={mode}
                      />
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {lot.locations.join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </SortableTable>
          </div>
        </div>
      ) : null}

      {serials.length > 0 ? (
        <div>
          <p className="mb-2 text-sm font-semibold">
            Números de serie ({serials.length})
          </p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <SortableTable className="min-w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Serie</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Ubicación</th>
                </tr>
              </thead>
              <tbody>
                {serials.map((serial) => (
                  <tr key={serial.serialNumber} className="border-t border-border/70">
                    <td className="px-3 py-2 font-mono text-xs">{serial.serialNumber}</td>
                    <td className="px-3 py-2 text-xs">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 font-medium",
                          serial.status === "disponible"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "bg-muted text-foreground"
                        )}
                      >
                        {SERIAL_STATUS_LABELS[serial.status] ?? serial.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {serial.location || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </SortableTable>
          </div>
        </div>
      ) : null}
    </div>
  );
}
