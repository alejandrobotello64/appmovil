"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ScanBarcode } from "lucide-react";
import { ScanDialog, type ScanRequest } from "@/components/scan/scan-dialog";
import { useSessionAccess } from "@/lib/auth/use-permissions";
import { CATALOG_MODULES } from "@/lib/auth/permissions";
import { useBarcodeScanner } from "@/lib/scan/use-barcode-scanner";

type ScanContextValue = {
  allowed: boolean;
  openScanner: (code?: string) => void;
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

  const openScanner = useCallback((code?: string) => {
    setRequest((current) =>
      code ? { code, nonce: (current?.nonce ?? 0) + 1 } : null
    );
    setOpen(true);
  }, []);

  useBarcodeScanner(openScanner, { enabled: allowed });

  const value = useMemo(() => ({ allowed, openScanner }), [allowed, openScanner]);

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
  return (
    <button
      type="button"
      onClick={() => scanner.openScanner()}
      className="touch-target inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-muted"
      aria-label="Escanear código de producto"
      title="Escanear código (lector o cámara)"
    >
      <ScanBarcode className="size-5" />
    </button>
  );
}
