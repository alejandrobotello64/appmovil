"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, Link2, Loader2, ScanBarcode, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/ui/modal-shell";
import { CameraCodeReader } from "@/components/scan/camera-code-reader";
import { ScannedProduct } from "@/components/scan/scanned-product";
import { useSessionAccess } from "@/lib/auth/use-permissions";
import { inventoryModuleForCategory, permissionKey } from "@/lib/auth/permissions";
import { getInventoryItemsByIds } from "@/lib/inventory/storage";
import { searchCatalog, type GlobalSearchHit } from "@/lib/inventory/search";
import {
  addProductBarcode,
  linkableCode,
  resolveScan,
  SCAN_MATCH_LABELS,
  type ScanResult,
} from "@/lib/scan/lookup";

export type ScanRequest = { code: string; nonce: number };

function errorText(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

type LinkCodePanelProps = {
  code: string;
  onLinked: (result: ScanResult["matches"][number]["item"]) => void;
};

function LinkCodePanel({ code, onLinked }: LinkCodePanelProps) {
  const access = useSessionAccess();
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<GlobalSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [linkingId, setLinkingId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const value = term.trim();
    if (value.length < 2) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      searchCatalog(value)
        .then((rows) => {
          if (!cancelled) setHits(rows.filter((row) => row.kind !== "serie"));
        })
        .catch((reason) => {
          if (!cancelled) setError(errorText(reason, "No se pudo buscar."));
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [term]);

  async function link(hit: GlobalSearchHit) {
    setLinkingId(hit.id);
    setError("");
    try {
      const [item] = await getInventoryItemsByIds([hit.id]);
      if (!item) throw new Error("El producto ya no existe.");
      const itemModule = inventoryModuleForCategory(item.category);
      if (access.ready && !access.can(permissionKey(itemModule, "edit"))) {
        throw new Error("Tu rol no puede editar productos de esta categoría.");
      }
      onLinked(await addProductBarcode(item, code));
    } catch (reason) {
      setError(errorText(reason, "No se pudo vincular el código."));
    } finally {
      setLinkingId("");
    }
  }

  const visibleHits = term.trim().length >= 2 ? hits : [];

  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Link2 className="size-4 text-primary" />
        Vincular <span className="font-mono">{code}</span> a un producto existente
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Busca por SKU, nombre, marca o modelo…"
          className="h-11 w-full rounded-lg border border-border bg-background pr-3 pl-9 text-sm"
          autoFocus
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {searching ? <p className="text-xs text-muted-foreground">Buscando…</p> : null}
      {visibleHits.length ? (
        <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border">
          {visibleHits.map((hit) => (
            <li key={hit.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{hit.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[hit.partNumber, hit.subtitle].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => void link(hit)}
                disabled={!!linkingId}
                className="touch-target h-9 shrink-0"
              >
                {linkingId === hit.id ? "Vinculando…" : "Vincular"}
              </Button>
            </li>
          ))}
        </ul>
      ) : term.trim().length >= 2 && !searching ? (
        <p className="text-xs text-muted-foreground">Sin resultados.</p>
      ) : null}
    </div>
  );
}

type ScanDialogProps = {
  request: ScanRequest | null;
  onClose: () => void;
};

type LookupQuery = { code: string; id: number };
type LookupOutcome = { id: number; result: ScanResult | null; error: string };

export function ScanDialog({ request, onClose }: ScanDialogProps) {
  const [manual, setManual] = useState("");
  const [camera, setCamera] = useState(false);
  const [query, setQuery] = useState<LookupQuery | null>(
    request?.code ? { code: request.code, id: 1 } : null
  );
  const [outcome, setOutcome] = useState<LookupOutcome | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [linking, setLinking] = useState(false);
  const [seenRequest, setSeenRequest] = useState(request);
  const manualRef = useRef<HTMLInputElement>(null);

  const startLookup = useCallback((code: string) => {
    const value = code.trim();
    if (!value) return;
    setCamera(false);
    setLinking(false);
    setSelectedId("");
    setQuery((current) => ({ code: value, id: (current?.id ?? 0) + 1 }));
  }, []);

  if (request !== seenRequest) {
    setSeenRequest(request);
    if (request?.code) startLookup(request.code);
  }

  useEffect(() => {
    if (!query) return;
    let cancelled = false;
    resolveScan(query.code)
      .then((result) => {
        if (cancelled) return;
        setOutcome({ id: query.id, result, error: "" });
        if (result.matches.length === 1) setSelectedId(result.matches[0].item.id);
      })
      .catch((reason) => {
        if (!cancelled) {
          setOutcome({
            id: query.id,
            result: null,
            error: errorText(reason, "No se pudo buscar el código."),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const loading = query !== null && outcome?.id !== query.id;
  const current = !loading ? outcome : null;
  const result = current?.result ?? null;
  const error = current?.error ?? "";

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function submitManual(event: FormEvent) {
    event.preventDefault();
    const value = manual;
    setManual("");
    manualRef.current?.blur();
    startLookup(value);
  }

  const selected = result?.matches.find((match) => match.item.id === selectedId) ?? null;
  const scan = result?.scan;

  return (
    <ModalShell
      title="Escanear producto"
      description="Lee el código con el lector de la tablet, con la cámara o escríbelo."
      className="max-w-3xl"
      headerAction={
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
          <X />
        </Button>
      }
    >
      <div className="space-y-4">
        <form onSubmit={submitManual} className="flex flex-wrap gap-2">
          <div className="relative min-w-0 flex-1">
            <ScanBarcode className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={manualRef}
              autoFocus={!request?.code}
              value={manual}
              onChange={(event) => setManual(event.target.value)}
              placeholder="Escanea o escribe un código, SKU, lote o serie"
              className="h-11 w-full rounded-lg border border-border bg-background pr-3 pl-9 font-mono text-sm"
            />
          </div>
          <Button type="submit" disabled={!manual.trim() || loading} className="touch-target h-11 px-4">
            Buscar
          </Button>
          <Button
            type="button"
            variant={camera ? "secondary" : "outline"}
            onClick={() => setCamera((current) => !current)}
            className="touch-target h-11"
          >
            <Camera className="mr-1.5 size-4" />
            {camera ? "Cerrar cámara" : "Usar cámara"}
          </Button>
        </form>

        {camera ? <CameraCodeReader onDetected={startLookup} /> : null}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Buscando producto…
          </div>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {!loading && scan && !camera ? (
          <>
            <p className="text-xs text-muted-foreground">
              Código: <span className="font-mono text-foreground">{scan.code}</span>
              {scan.gs1?.gtin ? <> · GTIN {scan.gs1.gtin}</> : null}
            </p>

            {selected ? (
              <>
                {result.matches.length > 1 ? (
                  <Button type="button" variant="link" className="h-auto p-0" onClick={() => setSelectedId("")}>
                    ← Ver las {result.matches.length} coincidencias
                  </Button>
                ) : null}
                <ScannedProduct key={selected.item.id} match={selected} onNavigate={onClose} />
              </>
            ) : result.matches.length > 1 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  El código coincide con {result.matches.length} productos. Elige uno:
                </p>
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                  {result.matches.map((match) => (
                    <li key={match.item.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(match.item.id)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-muted"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {match.item.sku} · {match.item.name}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {SCAN_MATCH_LABELS[match.kind]}
                            {match.lotNumber ? ` · Lote ${match.lotNumber}` : ""}
                            {match.serialNumber ? ` · Serie ${match.serialNumber}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm tabular-nums">
                          {match.item.quantity} {match.item.unit}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  <p className="font-medium">Código no registrado</p>
                  <p className="text-muted-foreground">
                    Ningún producto tiene este código, SKU, lote o serie.
                    {scan.gs1?.lot ? ` Lote ${scan.gs1.lot}.` : ""}
                    {scan.gs1?.expiry ? ` Caducidad ${scan.gs1.expiry}.` : ""}
                  </p>
                </div>
                {linking ? (
                  <LinkCodePanel
                    code={linkableCode(scan)}
                    onLinked={(item) => {
                      setLinking(false);
                      setOutcome({
                        id: current!.id,
                        error: "",
                        result: {
                          scan,
                          matches: [
                            {
                              item,
                              kind: "barcode",
                              lotNumber: scan.gs1?.lot,
                              serialNumber: scan.gs1?.serial,
                              expiryDate: scan.gs1?.expiry,
                            },
                          ],
                        },
                      });
                      setSelectedId(item.id);
                    }}
                  />
                ) : (
                  <Button type="button" onClick={() => setLinking(true)} className="touch-target h-11">
                    <Link2 className="mr-1.5 size-4" />
                    Vincular a un producto
                  </Button>
                )}
              </div>
            )}
          </>
        ) : null}
      </div>
    </ModalShell>
  );
}
