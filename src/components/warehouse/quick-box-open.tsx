"use client";

import { useEffect, useState } from "react";
import { Loader2, PackageOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/ui/modal-shell";
import { getSession } from "@/lib/auth";
import {
  listQuickOpenBoxes,
  openBoxToPieces,
  piecesPerBoxFromName,
  suggestedBoxCount,
  type QuickOpenBox,
  type QuickOpenTarget,
} from "@/lib/warehouse/box-opening";

type Draft = { boxes: string; per: string; balanceId: string };

function draftFor(box: QuickOpenBox): Draft {
  const balance = box.balances[0];
  const fromCatalog = box.piecesPerUnit && box.piecesPerUnit > 0 ? box.piecesPerUnit : 0;
  const per = fromCatalog || piecesPerBoxFromName(box.name) || 0;
  const count = suggestedBoxCount(box.shortage, per, balance?.available ?? 0);
  return {
    boxes: String(count || 1),
    per: per ? String(per) : "",
    balanceId: balance?.id ?? "",
  };
}

function balanceLabel(box: QuickOpenBox, balanceId: string) {
  const balance = box.balances.find((item) => item.id === balanceId) ?? box.balances[0];
  if (!balance) return "";
  return [
    balance.warehouseCode || balance.warehouseName,
    balance.locationName,
    balance.lotNumber ? `lote ${balance.lotNumber}` : "",
    `${balance.available} caja(s)`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function QuickBoxOpenButton({
  targets,
  disabled,
  onOpened,
}: {
  targets: QuickOpenTarget[];
  disabled?: boolean;
  onOpened: (pieceId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const pieceTargets = targets.filter((target) => target.productId);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={disabled || !pieceTargets.length}
        onClick={() => setOpen(true)}
      >
        <PackageOpen className="size-4" /> Aperturar cajas
      </Button>
      {open ? (
        <QuickBoxOpenDialog
          targets={targets}
          onClose={() => setOpen(false)}
          onOpened={onOpened}
        />
      ) : null}
    </>
  );
}

function QuickBoxOpenDialog({
  targets,
  onClose,
  onOpened,
}: {
  targets: QuickOpenTarget[];
  onClose: () => void;
  onOpened: (pieceId: string) => void;
}) {
  const [boxes, setBoxes] = useState<QuickOpenBox[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    let active = true;
    listQuickOpenBoxes(targets)
      .then((rows) => {
        if (!active) return;
        const next: Record<string, Draft> = {};
        for (const row of rows) next[row.boxId] = draftFor(row);
        setDrafts(next);
        setBoxes(rows);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "No se pudieron buscar las cajas.");
        setBoxes([]);
      });
    return () => {
      active = false;
    };
    // La lista se arma al abrir el diálogo, con el surtimiento ya elegido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function patch(boxId: string, next: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [boxId]: { ...current[boxId], ...next } }));
  }

  async function openOne(box: QuickOpenBox) {
    const draft = drafts[box.boxId];
    const balance = box.balances.find((item) => item.id === draft?.balanceId) ?? box.balances[0];
    const count = Number(draft?.boxes);
    const per = Number(draft?.per);
    if (!balance) {
      setError("Esa caja ya no tiene existencia en la ubicación elegida.");
      return;
    }
    if (!Number.isInteger(count) || count <= 0) {
      setError("Indica cuántas cajas vas a abrir.");
      return;
    }
    if (count > balance.available) {
      setError(`Solo hay ${balance.available} caja(s) en ${balance.locationName || "esa ubicación"}.`);
      return;
    }
    if (!Number.isInteger(per) || per <= 0) {
      setError("Indica cuántas piezas trae cada caja.");
      return;
    }
    const session = getSession();
    if (!session?.username) {
      setError("Tu sesión expiró. Vuelve a iniciar sesión.");
      return;
    }
    setBusyId(box.boxId);
    setError("");
    setNotice("");
    try {
      const result = await openBoxToPieces({
        boxProductId: box.boxId,
        pieceProductId: box.pieceId,
        boxes: count,
        piecesPerBox: per,
        warehouseId: balance.warehouseId,
        locationId: balance.locationId,
        lotNumber: balance.lotNumber,
        expiryDate: balance.expiryDate || null,
        createdBy: session.username,
        note: "Apertura rápida desde surtimiento",
      });
      setNotice(
        `Se abrieron ${count} caja(s) de ${box.sku}. Entraron ${result.piecesAdded} piezas a ${box.pieceSku}.`
      );
      setBoxes((current) =>
        (current ?? [])
          .map((item) => {
            if (item.boxId !== box.boxId) return item;
            const balances = item.balances
              .map((row) =>
                row.id === balance.id ? { ...row, available: Math.max(0, row.available - count) } : row
              )
              .filter((row) => row.available > 0);
            return { ...item, balances, shortage: Math.max(0, item.shortage - result.piecesAdded) };
          })
          .filter((item) => item.balances.length > 0)
      );
      onOpened(box.pieceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir la caja.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <ModalShell
      title="Aperturar cajas"
      description="Convierte cajas del pedido en su presentación en piezas, en el mismo almacén y lote, para poder surtir."
      className="max-w-2xl"
      headerAction={
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
          <X className="size-4" />
        </Button>
      }
    >
      <div className="space-y-3">
        {error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
            {notice}
          </p>
        ) : null}
        {boxes === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Buscando cajas con existencia…
          </p>
        ) : boxes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ninguna pieza de este surtimiento tiene cajas disponibles. Cuando entre mercancía en caja,
            se puede abrir desde Apertura de caja.
          </p>
        ) : (
          boxes.map((box) => {
            const draft = drafts[box.boxId] ?? draftFor(box);
            const balance = box.balances.find((item) => item.id === draft.balanceId) ?? box.balances[0];
            const count = Number(draft.boxes);
            const per = Number(draft.per);
            const piecesOut =
              Number.isInteger(count) && count > 0 && Number.isInteger(per) && per > 0 ? count * per : 0;
            return (
              <article key={box.boxId} className="space-y-3 rounded-xl border border-border p-3">
                <div>
                  <p className="text-sm font-medium">
                    {box.sku} · {box.name}
                  </p>
                  {box.partNumber.trim() ? (
                    <p className="font-mono text-xs text-muted-foreground">N.º de parte {box.partNumber.trim()}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Entran a {box.pieceSku} · {box.pieceName}
                    {box.shortage > 0 ? ` · faltan ${box.shortage} piezas` : ""}
                  </p>
                </div>
                {box.balances.length > 1 ? (
                  <label className="block text-xs text-muted-foreground">
                    Existencia
                    <select
                      className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground"
                      value={draft.balanceId}
                      onChange={(event) => patch(box.boxId, { balanceId: event.target.value })}
                    >
                      {box.balances.map((item) => (
                        <option key={item.id} value={item.id}>
                          {balanceLabel(box, item.id)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p className="text-xs text-muted-foreground">{balanceLabel(box, draft.balanceId)}</p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs text-muted-foreground">
                    Cajas a abrir
                    <input
                      type="number"
                      min={1}
                      max={balance?.available || undefined}
                      className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground"
                      value={draft.boxes}
                      onChange={(event) => patch(box.boxId, { boxes: event.target.value })}
                    />
                  </label>
                  <label className="block text-xs text-muted-foreground">
                    Piezas por caja
                    <input
                      type="number"
                      min={1}
                      className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground"
                      value={draft.per}
                      onChange={(event) => patch(box.boxId, { per: event.target.value })}
                    />
                  </label>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    {piecesOut > 0 ? `Entran ${piecesOut} piezas` : "Indica las piezas por caja"}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    disabled={Boolean(busyId) || !Number.isInteger(count) || count <= 0}
                    onClick={() => void openOne(box)}
                    className="bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                  >
                    {busyId === box.boxId ? <Loader2 className="size-3.5 animate-spin" /> : <PackageOpen className="size-3.5" />}
                    Abrir
                  </Button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </ModalShell>
  );
}
