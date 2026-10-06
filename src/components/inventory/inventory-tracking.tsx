import { Eye, Pencil } from "lucide-react";
import { daysUntilExpiry } from "@/lib/inventory/expiry";
import {
  SERIAL_STATUS_LABELS,
  type InventoryLotStock,
  type InventorySerial,
  type InventoryTracking,
} from "@/lib/inventory/tracking";
import type { InventoryItem } from "@/lib/inventory/types";
import { cn } from "@/lib/utils";
import { SortableTable } from "@/components/ui/sortable-table";

/** expiry: lote + caducidad · manufacture: lote + fabricación · both: las dos fechas · auto: lo que tenga cada lote */
export type TrackingDateMode = "expiry" | "manufacture" | "both" | "auto";

const EXPIRY_WARNING_DAYS = 90;
const SUMMARY_LOTS = 2;

export function trackingColumnLabel(mode: TrackingDateMode) {
  if (mode === "expiry") return "Lote / caducidad";
  if (mode === "manufacture") return "Lote / fabricación";
  if (mode === "both") return "Lote / fechas";
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
  if (mode === "both" || mode === "auto") {
    if (!expiryDate && !manufacturedAt) {
      return <span className="text-muted-foreground">Sin fechas</span>;
    }
    const expiry = expiryDate ? expiryState(expiryDate) : null;
    return (
      <span>
        {manufacturedAt ? (
          <span className="text-muted-foreground">Fab. {manufacturedAt}</span>
        ) : null}
        {manufacturedAt && expiryDate ? " · " : null}
        {expiryDate ? (
          <span className={expiry?.tone}>
            Cad. {expiryDate}
            {expiry?.hint ? ` · ${expiry.hint}` : ""}
          </span>
        ) : null}
      </span>
    );
  }
  const showExpiry = mode === "expiry";
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

type PhotoSource = { imageUrl: string; galleryImages: { url: string }[] };

function photoCount(source: PhotoSource | null | undefined) {
  if (!source) return 0;
  return (source.imageUrl ? 1 : 0) + source.galleryImages.length;
}

function UnitPhotoThumb({
  source,
  label,
  onOpen,
}: {
  source: PhotoSource | null | undefined;
  label: string;
  onOpen?: () => void;
}) {
  const count = photoCount(source);
  const cover = source?.imageUrl || source?.galleryImages[0]?.url || "";
  if (!cover) return <span className="text-muted-foreground">—</span>;

  const thumb = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cover} alt={label} className="size-full object-cover" />
      {count > 1 ? (
        <span className="absolute bottom-0 right-0 rounded-tl-md bg-black/65 px-1 text-[10px] font-semibold leading-4 text-white">
          {count}
        </span>
      ) : null}
    </>
  );
  const className = "relative block size-10 overflow-hidden rounded-md border border-border";
  const title = `${count} foto${count === 1 ? "" : "s"} · ${label}`;

  if (onOpen) {
    return (
      <button type="button" className={className} title={title} onClick={onOpen}>
        {thumb}
      </button>
    );
  }
  return (
    <a href={cover} target="_blank" rel="noreferrer" className={className} title={title}>
      {thumb}
    </a>
  );
}

function UnitActionButton({ canEdit, onClick }: { canEdit: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
      title={canEdit ? "Editar datos y fotos" : "Ver detalle y fotos"}
    >
      {canEdit ? <Pencil className="size-3.5" /> : <Eye className="size-3.5" />}
      {canEdit ? "Editar" : "Ver"}
    </button>
  );
}

type TrackingDetailProps = TrackingProps & {
  /** Abre la ficha de una pieza serializada (editar datos y fotos). */
  onOpenSerial?: (serial: InventorySerial) => void;
  /** Abre la ficha de un lote (editar datos y fotos). */
  onOpenLot?: (lot: InventoryLotStock) => void;
  canEditUnits?: boolean;
};

/** Detalle para la ficha: existencia por lote y números de serie vigentes. */
export function TrackingDetail({
  item,
  tracking,
  mode,
  onOpenSerial,
  onOpenLot,
  canEditUnits = false,
}: TrackingDetailProps) {
  const lots = tracking?.lots ?? [];
  const serials = tracking?.serials ?? [];
  const showLotNotes = lots.some((lot) => lot.lot?.notes);
  const showLotPhoto = lots.some((lot) => photoCount(lot.lot) > 0);
  const showInventory = serials.some((serial) => serial.inventoryNumber);
  const showManufacture = serials.some((serial) => serial.manufacturedAt);
  const showNotes = serials.some((serial) => serial.notes);
  const showMaintenance = serials.some(
    (serial) => serial.lastMaintenanceDate || serial.nextMaintenanceDate
  );
  const showPhoto = serials.some((serial) => photoCount(serial) > 0);
  const dateHeader =
    mode === "expiry"
      ? "Caducidad"
      : mode === "manufacture"
        ? "Fabricación"
        : "Caducidad / fabricación";

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
                  {showLotNotes ? <th className="px-3 py-2 font-medium">Notas</th> : null}
                  <th className="px-3 py-2 font-medium">Ubicación</th>
                  {showLotPhoto ? (
                    <th className="px-3 py-2 font-medium" data-sort="off">
                      Fotos
                    </th>
                  ) : null}
                  {onOpenLot ? (
                    <th className="px-3 py-2 text-right font-medium" data-sort="off">
                      <span className="sr-only">Acciones</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {lots.map((lot) => (
                  <tr key={lot.lot?.id || lot.lotNumber} className="border-t border-border/70">
                    <td className="px-3 py-2 font-mono text-xs">{lot.lotNumber || "—"}</td>
                    <td className="px-3 py-2">{lotQuantity(lot, item.unit)}</td>
                    <td className="px-3 py-2 text-xs">
                      <LotDate
                        expiryDate={lot.expiryDate}
                        manufacturedAt={lot.manufacturedAt}
                        mode={mode}
                      />
                    </td>
                    {showLotNotes ? (
                      <td className="max-w-[16rem] px-3 py-2 text-xs">{lot.lot?.notes || "—"}</td>
                    ) : null}
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {lot.locations.join(", ") || "—"}
                    </td>
                    {showLotPhoto ? (
                      <td className="px-3 py-2 text-xs">
                        <UnitPhotoThumb
                          source={lot.lot}
                          label={`Lote ${lot.lotNumber}`}
                          onOpen={onOpenLot && lot.lot ? () => onOpenLot(lot) : undefined}
                        />
                      </td>
                    ) : null}
                    {onOpenLot ? (
                      <td className="px-3 py-2 text-right">
                        {lot.lot ? (
                          <UnitActionButton
                            canEdit={canEditUnits}
                            onClick={() => onOpenLot(lot)}
                          />
                        ) : null}
                      </td>
                    ) : null}
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
                  {showInventory ? (
                    <th className="px-3 py-2 font-medium">Inventario</th>
                  ) : null}
                  <th className="px-3 py-2 font-medium">Estado</th>
                  {showManufacture ? (
                    <th className="px-3 py-2 font-medium">Fabricación</th>
                  ) : null}
                  {showNotes ? <th className="px-3 py-2 font-medium">Notas</th> : null}
                  {showMaintenance ? (
                    <th className="px-3 py-2 font-medium">Mantenimiento</th>
                  ) : null}
                  <th className="px-3 py-2 font-medium">Ubicación</th>
                  {showPhoto ? (
                    <th className="px-3 py-2 font-medium" data-sort="off">
                      Fotos
                    </th>
                  ) : null}
                  {onOpenSerial ? (
                    <th className="px-3 py-2 text-right font-medium" data-sort="off">
                      <span className="sr-only">Acciones</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {serials.map((serial) => (
                  <tr key={serial.id || serial.serialNumber} className="border-t border-border/70">
                    <td className="px-3 py-2 font-mono text-xs">{serial.serialNumber}</td>
                    {showInventory ? (
                      <td className="px-3 py-2 text-xs">{serial.inventoryNumber || "—"}</td>
                    ) : null}
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
                    {showManufacture ? (
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {serial.manufacturedAt || "—"}
                      </td>
                    ) : null}
                    {showNotes ? (
                      <td className="max-w-[16rem] px-3 py-2 text-xs">{serial.notes || "—"}</td>
                    ) : null}
                    {showMaintenance ? (
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {serial.lastMaintenanceDate ? (
                          <p>Último: {serial.lastMaintenanceDate}</p>
                        ) : null}
                        {serial.nextMaintenanceDate ? (
                          <p>Próximo: {serial.nextMaintenanceDate}</p>
                        ) : null}
                        {!serial.lastMaintenanceDate && !serial.nextMaintenanceDate ? "—" : null}
                      </td>
                    ) : null}
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {serial.location || "—"}
                    </td>
                    {showPhoto ? (
                      <td className="px-3 py-2 text-xs">
                        <UnitPhotoThumb
                          source={serial}
                          label={`Serie ${serial.serialNumber}`}
                          onOpen={onOpenSerial ? () => onOpenSerial(serial) : undefined}
                        />
                      </td>
                    ) : null}
                    {onOpenSerial ? (
                      <td className="px-3 py-2 text-right">
                        <UnitActionButton
                          canEdit={canEditUnits}
                          onClick={() => onOpenSerial(serial)}
                        />
                      </td>
                    ) : null}
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
