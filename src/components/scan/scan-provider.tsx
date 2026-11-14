"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { ScanBarcode } from "lucide-react";
import { ScanDialog, type ScanRequest } from "@/components/scan/scan-dialog";
import { useSessionAccess } from "@/lib/auth/use-permissions";
import { CATALOG_MODULES } from "@/lib/auth/permissions";
import { SCAN_TARGET_EVENT, useBarcodeScanner } from "@/lib/scan/use-barcode-scanner";
import {
  connectSerialScanner,
  disconnectSerialScanner,
  getSerialScannerState,
  getServerSerialScannerState,
  probeSerialScanner,
  setSerialBaudRate,
  setSerialScanHandler,
  subscribeSerialScanner,
  triggerSerialScanner,
  type SerialScannerState,
} from "@/lib/scan/serial-scanner";
import { cn } from "@/lib/utils";

type ScanContextValue = {
  allowed: boolean;
  openScanner: (code?: string) => void;
  serial: SerialScannerState;
  connectSerial: (options?: { replace?: boolean }) => Promise<void>;
  disconnectSerial: () => Promise<void>;
  setSerialBaud: (baudRate: number) => Promise<void>;
  triggerSerial: () => Promise<void>;
  probeSerial: () => Promise<void>;
};

const ScanContext = createContext<ScanContextValue | null>(null);

export function useScanner() {
  return useContext(ScanContext);
}

/** Escucha el lector de códigos en toda la app y muestra la ficha del producto. */
export function ScanProvider({ children }: { children: ReactNode }) {
  const access = useSessionAccess();
  const allowed =
    access.ready &&
    [...CATALOG_MODULES, "equipo" as const].some((module) => access.canView(module));
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState<ScanRequest | null>(null);
  const serial = useSyncExternalStore(
    subscribeSerialScanner,
    getSerialScannerState,
    getServerSerialScannerState
  );

  const openScanner = useCallback((code?: string) => {
    setRequest((current) =>
      code ? { code, nonce: (current?.nonce ?? 0) + 1 } : null
    );
    setOpen(true);
  }, []);

  useBarcodeScanner(openScanner, { enabled: allowed });

  useEffect(() => {
    if (!allowed) return;
    return setSerialScanHandler((code) => {
      const target = document.activeElement;
      if (target instanceof HTMLElement && target.dataset.scanTarget === "true") {
        target.dispatchEvent(new CustomEvent(SCAN_TARGET_EVENT, { detail: code }));
        return;
      }
      openScanner(code);
    });
  }, [allowed, openScanner]);

  const value = useMemo(
    () => ({
      allowed,
      openScanner,
      serial,
      connectSerial: connectSerialScanner,
      disconnectSerial: disconnectSerialScanner,
      setSerialBaud: setSerialBaudRate,
      triggerSerial: triggerSerialScanner,
      probeSerial: probeSerialScanner,
    }),
    [allowed, openScanner, serial]
  );

  return (
    <ScanContext.Provider value={value}>
      {children}
      {open && allowed ? (
        <ScanDialog
          request={request}
          onClose={() => {
            setOpen(false);
            setRequest(null);
          }}
        />
      ) : null}
    </ScanContext.Provider>
  );
}

export function ScanButton() {
  const scanner = useScanner();
  if (!scanner?.allowed) return null;
  const connected = scanner.serial.status === "connected";
  return (
    <button
      type="button"
      onClick={() => scanner.openScanner()}
      className="touch-target relative inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-muted"
      aria-label="Escanear código de producto"
      title={connected ? "Lector conectado · Escanear código" : "Escanear código (lector o cámara)"}
    >
      <ScanBarcode className="size-5" />
      {scanner.serial.status !== "unsupported" ? (
        <span
          className={cn(
            "absolute top-1.5 right-1.5 size-2 rounded-full",
            connected ? "bg-emerald-500" : "bg-muted-foreground/40"
          )}
        />
      ) : null}
    </button>
  );
}
