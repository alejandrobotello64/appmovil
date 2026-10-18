"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const ZOOM_STORAGE_KEY = "mas-zoom";
export const ZOOM_STEPS = [0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2] as const;
export const MIN_ZOOM = ZOOM_STEPS[0];
export const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1];

type ZoomContextValue = {
  zoom: number;
  percent: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
};

const ZoomContext = createContext<ZoomContextValue | null>(null);

export function clampZoom(value: number) {
  if (!Number.isFinite(value)) return 1;
  const rounded = Math.round(value * 100) / 100;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, rounded));
}

function nearestStep(value: number, direction: -1 | 1) {
  const zoom = clampZoom(value);
  if (direction > 0) {
    return ZOOM_STEPS.find((step) => step > zoom + 0.001) ?? MAX_ZOOM;
  }
  const lower = [...ZOOM_STEPS].reverse().find((step) => step < zoom - 0.001);
  return lower ?? MIN_ZOOM;
}

export function applyZoom(zoom: number) {
  const next = clampZoom(zoom);
  const root = document.documentElement;
  root.style.setProperty("--mas-zoom", String(next));
  root.dataset.zoom = String(next);
}

export function ZoomProvider({ children }: { children: ReactNode }) {
  const [zoom, setZoomState] = useState(1);

  useEffect(() => {
    const stored = Number.parseFloat(
      localStorage.getItem(ZOOM_STORAGE_KEY) ?? ""
    );
    const initial = clampZoom(Number.isFinite(stored) ? stored : 1);
    setZoomState(initial);
    applyZoom(initial);
  }, []);

  const setZoom = useCallback((next: number) => {
    const zoomValue = clampZoom(next);
    setZoomState(zoomValue);
    localStorage.setItem(ZOOM_STORAGE_KEY, String(zoomValue));
    applyZoom(zoomValue);
  }, []);

  const zoomIn = useCallback(() => {
    setZoom(nearestStep(zoom, 1));
  }, [setZoom, zoom]);

  const zoomOut = useCallback(() => {
    setZoom(nearestStep(zoom, -1));
  }, [setZoom, zoom]);

  const resetZoom = useCallback(() => {
    setZoom(1);
  }, [setZoom]);

  const value = useMemo<ZoomContextValue>(
    () => ({
      zoom,
      percent: Math.round(zoom * 100),
      canZoomIn: zoom < MAX_ZOOM - 0.001,
      canZoomOut: zoom > MIN_ZOOM + 0.001,
      setZoom,
      zoomIn,
      zoomOut,
      resetZoom,
    }),
    [resetZoom, setZoom, zoom, zoomIn, zoomOut]
  );

  return <ZoomContext.Provider value={value}>{children}</ZoomContext.Provider>;
}

export function useZoom() {
  const context = useContext(ZoomContext);
  if (!context) {
    throw new Error("useZoom must be used within ZoomProvider");
  }
  return context;
}

export const zoomInitScript = `(function(){try{var z=parseFloat(localStorage.getItem('${ZOOM_STORAGE_KEY}'));if(!isFinite(z)||z<${MIN_ZOOM}||z>${MAX_ZOOM})z=1;var r=document.documentElement;r.style.setProperty('--mas-zoom',String(z));r.dataset.zoom=String(z)}catch(e){}})();`;
