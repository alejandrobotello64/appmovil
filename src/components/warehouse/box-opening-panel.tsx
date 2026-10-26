"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Loader2, PackageOpen } from "lucide-react";
import { ReadOnlyBanner } from "@/components/warehouse/read-only-banner";
import { Button } from "@/components/ui/button";
import {
  Alert,
  Field,
  ProductPicker,
  inputClass,
  primaryButtonClass,
} from "@/components/warehouse/movements/movement-ui";
import { getSession } from "@/lib/auth";
import { usePermissions } from "@/lib/auth/use-permissions";
import { createInventoryItem, getInventoryItems } from "@/lib/inventory/storage";
import type { InventoryItem } from "@/lib/inventory/types";
import {
  listRecentBoxOpenings,
  openBoxToPieces,
  piecePresentationName,
  piecesPerBoxFromName,
  suggestPieceProducts,
  type BoxOpeningRecord,
  type BoxOpeningResult,
} from "@/lib/warehouse/box-opening";
import { getProductStock, type StockBalance } from "@/lib/warehouse/movements";

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(date);
}

export function BoxOpeningPanel() {
  const { canWrite } = usePermissions("movimientos");
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [history, setHistory] = useState<BoxOpeningRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [box, setBox] = useState<InventoryItem | null>(null);
  const [piece, setPiece] = useState<InventoryItem | null>(null);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [balanceId, setBalanceId] = useState("");
  const [loadingStock, setLoadingStock] = useState(false);
  const [boxes, setBoxes] = useState(1);
  const [piecesPerBox, setPiecesPerBox] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [creatingPiece, setCreatingPiece] = useState(false);
  const [result, setResult] = useState<BoxOpeningResult | null>(null);

  const boxProducts = useMemo(
    () => products.filter((item) => item.isActive && item.unit === "caja"),
    [products]
  );
  const pieceProducts = useMemo(
    () =>
      products.filter(
        (item) => item.isActive && item.unit === "pieza" && item.itemKind !== "equipo"
      ),
    [products]
  );
  const suggestions = useMemo(
    () => (box ? suggestPieceProducts(box, products) : []),
    [box, products]
  );
  const source = balances.find((item) => item.id === balanceId) ?? null;
  const piecesEach = Number(piecesPerBox);
  const piecesOut =
    Number.isInteger(piecesEach) && piecesEach > 0 && boxes > 0 ? boxes * piecesEach : 0;

  useEffect(() => {
    let cancelled = false;
    Promise.all([getInventoryItems(), listRecentBoxOpenings()])
      .then(([items, openings]) => {
        if (cancelled) return;
        setProducts(items);
        setHistory(openings);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudo cargar el catálogo.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function rememberPieceLink(boxId: string, pieceId: string, perBox: number) {
    setProducts((current) =>
      current.map((item) =>
        item.id === boxId
          ? { ...item, pieceProductId: pieceId, piecesPerUnit: perBox }
          : item.id === pieceId
            ? item
            : item
      )
    );
  }

  function selectBox(item: InventoryItem | null) {
    setBox(item);
    setPiece(null);
    setBalances([]);
    setBalanceId("");
    setResult(null);
    setError("");
    const fromItem = item?.piecesPerUnit && item.piecesPerUnit > 0 ? item.piecesPerUnit : null;
    const fromName = item ? piecesPerBoxFromName(item.name) : null;
    setPiecesPerBox(String(fromItem || fromName || ""));
    setBoxes(1);
    if (!item) return;

    const suggested = suggestPieceProducts(item, products);
    if (suggested[0]) setPiece(suggested[0]);

    setLoadingStock(true);
    getProductStock(item.id)
      .then((stock) => {
        const available = stock.balances.filter((balance) => balance.available > 0);
        setBalances(available);
        setBalanceId(available.length === 1 ? available[0].id : "");
        setBoxes(available[0] ? 1 : 0);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "No se pudieron cargar las existencias.");
      })
      .finally(() => setLoadingStock(false));
  }

  async function createPiece() {
    if (!box || !canWrite) return;
    setCreatingPiece(true);
    setError("");
    try {
      const session = getSession();
      const created = await createInventoryItem(
        {
          sku: "",
          name: piecePresentationName(box.name),
          category: box.category === "equipos" ? "insumos" : box.category,
          itemKind: "producto",
          description: box.description,
          quantity: 0,
          minStock: 0,
          unit: "pieza",
          location: box.location,
          brand: box.brand,
          colorTag: box.colorTag,
          model: box.model,
          serialNumber: "",
          unitPrice: box.unitPrice,
          costPrice: box.costPrice,
          supplier: box.supplier,
          expiryDate: "",
          manufacturedAt: "",
          notes: `Presentación en piezas de ${box.sku}.`,
          assetStatus: "operativo",
          lastMaintenanceDate: "",
          nextMaintenanceDate: "",
          isActive: true,
          stockAlertsEnabled: box.stockAlertsEnabled,
          tracksLot: box.tracksLot,
          tracksSerial: false,
          tracksExpiry: box.tracksExpiry,
          maxStock: 0,
          reorderPoint: 0,
          partNumber: box.partNumber,
          manufacturer: box.manufacturer,
          subcategory: box.subcategory,
        },
        session?.username || "almacen"
      );
      setProducts((current) => [created, ...current]);
      setPiece(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la presentación en piezas.");
    } finally {
      setCreatingPiece(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canWrite || !box || !piece || !source) return;
    if (!Number.isInteger(boxes) || boxes <= 0) {
      setError("Indica cuántas cajas vas a abrir.");
      return;
    }
    if (boxes > source.available) {
      setError(`Solo hay ${source.available} caja(s) disponible(s) en esa ubicación.`);
      return;
    }
    if (!Number.isInteger(piecesEach) || piecesEach <= 0) {
      setError("Indica cuántas piezas trae cada caja.");
      return;
    }

    setSubmitting(true);
    setError("");
    setResult(null);
    try {
      const session = getSession();
      const opened = await openBoxToPieces({
        boxProductId: box.id,
        pieceProductId: piece.id,
        boxes,
        piecesPerBox: piecesEach,
        warehouseId: source.warehouseId,
        locationId: source.locationId,
        lotNumber: source.lotNumber,
        expiryDate: source.expiryDate,
        createdBy: session?.username || "almacen",
        note,
      });
      setResult(opened);
      rememberPieceLink(box.id, piece.id, piecesEach);
      setBox((current) =>
        current
          ? {
              ...current,
              quantity: opened.boxesLeft,
              piecesPerUnit: piecesEach,
              pieceProductId: piece.id,
            }
          : current
      );
      setPiece((current) =>
        current && current.id === piece.id
          ? { ...current, quantity: opened.pieceQuantity }
          : current
      );
      setProducts((current) =>
        current.map((item) => {
          if (item.id === box.id) return { ...item, quantity: opened.boxesLeft };
          if (item.id === piece.id) return { ...item, quantity: opened.pieceQuantity };
          return item;
        })
      );
      const stock = await getProductStock(box.id);
      const available = stock.balances.filter((balance) => balance.available > 0);
      setBalances(available);
      setBalanceId(available.find((balance) => balance.id === source.id)?.id ?? available[0]?.id ?? "");
      setHistory(await listRecentBoxOpenings());
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir la caja.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#00BFFF]/15 text-[#0b6f93]">
            <PackageOpen className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Apertura de caja</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Descuenta artículos que están en caja y da de alta la misma cantidad convertida a su
              presentación en piezas, en el mismo almacén, ubicación y lote.
            </p>
          </div>
        </div>
      </section>

      <ReadOnlyBanner
        visible={!canWrite}
        message="Puedes consultar las aperturas. Para abrir cajas hace falta permiso de registrar movimientos."
      />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {result ? (
        <Alert tone="success">
          Quedaron {result.boxesLeft} caja(s). Entraron {result.piecesAdded} piezas
          {result.pieceFolio ? ` (${result.pieceFolio})` : ""}. Salida de caja{" "}
          {result.boxFolio}.
        </Alert>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6"
      >
        <Field label="Artículo en caja" hint="Solo códigos cuya unidad es caja.">
          <ProductPicker
            products={boxProducts}
            value={box}
            disabled={!canWrite || loading}
            placeholder="Buscar caja por SKU, nombre o n.º de parte..."
            onChange={selectBox}
          />
        </Field>

        {loadingStock ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Cargando existencias…
          </p>
        ) : null}

        {box && !loadingStock && balances.length === 0 ? (
          <p className="text-sm text-muted-foreground">Este código no tiene cajas disponibles.</p>
        ) : null}

        {balances.length > 0 ? (
          <Field label="Existencia a abrir">
            <select
              className={inputClass}
              value={balanceId}
              disabled={!canWrite}
              onChange={(event) => {
                setBalanceId(event.target.value);
                setBoxes(1);
              }}
            >
              <option value="">Elige almacén, ubicación y lote</option>
              {balances.map((balance) => (
                <option key={balance.id} value={balance.id}>
                  {balance.warehouseCode} · {balance.locationName}
                  {balance.lotNumber ? ` · lote ${balance.lotNumber}` : ""} · {balance.available}{" "}
                  caja(s)
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cajas a abrir">
            <input
              type="number"
              min={1}
              max={source?.available || undefined}
              className={inputClass}
              value={boxes}
              disabled={!canWrite || !source}
              onChange={(event) => setBoxes(Number(event.target.value))}
            />
          </Field>
          <Field
            label="Piezas por caja"
            hint={
              box && piecesPerBoxFromName(box.name)
                ? `El nombre indica ${piecesPerBoxFromName(box.name)} por caja. Puedes corregirlo.`
                : "Cuántas piezas salen de una caja."
            }
          >
            <input
              type="number"
              min={1}
              className={inputClass}
              value={piecesPerBox}
              disabled={!canWrite || !box}
              onChange={(event) => setPiecesPerBox(event.target.value)}
            />
          </Field>
        </div>

        <Field
          label="Presentación en piezas"
          hint="El código que va a recibir las piezas. Si no existe, se puede crear con el mismo n.º de parte."
        >
          <ProductPicker
            products={pieceProducts}
            value={piece}
            disabled={!canWrite || !box}
            placeholder="Buscar la presentación en piezas..."
            onChange={setPiece}
          />
        </Field>

        {suggestions.length > 0 && piece?.id !== suggestions[0]?.id ? (
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, 4).map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={!canWrite}
                onClick={() => setPiece(item)}
                className="rounded-full border border-border px-3 py-1 text-left text-xs hover:bg-muted"
              >
                <span className="font-mono">{item.sku}</span> · {item.name}
              </button>
            ))}
          </div>
        ) : null}

        {box && suggestions.length === 0 && !piece ? (
          <Button
            type="button"
            variant="outline"
            disabled={!canWrite || creatingPiece}
            onClick={() => void createPiece()}
          >
            {creatingPiece ? <Loader2 className="size-4 animate-spin" /> : null}
            Crear presentación en piezas
          </Button>
        ) : null}

        {piecesOut > 0 ? (
          <p className="rounded-xl bg-muted/60 px-3 py-2 text-sm">
            {boxes} caja(s) salen y entran <strong>{piecesOut} piezas</strong>
            {piece ? ` a ${piece.sku}` : ""}.
          </p>
        ) : null}

        <Field label="Nota" hint="Opcional. Queda en el kardex junto con el detalle de la apertura.">
          <input
            className={inputClass}
            value={note}
            disabled={!canWrite}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ej. surtido de piso, lote abierto"
          />
        </Field>

        <Button
          type="submit"
          className={primaryButtonClass}
          disabled={!canWrite || submitting || !box || !piece || !source}
        >
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <PackageOpen className="size-4" />}
          Abrir caja
        </Button>
      </form>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <h3 className="text-sm font-semibold">Aperturas recientes</h3>
        {loading ? (
          <p className="mt-3 text-sm text-muted-foreground">Cargando historial…</p>
        ) : history.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Todavía no hay aperturas de caja.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {history.map((row) => (
              <li key={row.id} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">
                    <span className="font-mono">{row.folio}</span> · {row.productSku}
                  </p>
                  <p className="truncate text-muted-foreground">{row.productName}</p>
                  <p className="text-xs text-muted-foreground">{row.note}</p>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground sm:text-right">
                  {row.qtyOut > 0 ? `−${row.qtyOut} caja(s)` : `+${row.qtyIn} piezas`}
                  <br />
                  {formatWhen(row.occurredAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
