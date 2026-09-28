"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

export type LightboxImage = {
  src: string;
  alt?: string;
  caption?: string;
};

type ImageLightboxProps = {
  images: LightboxImage[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
  /** Acciones extra para la imagen actual (ej. hacer principal, quitar). */
  renderActions?: (index: number) => ReactNode;
};

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const STEP = 1.5;

type Point = { x: number; y: number };

export function ImageLightbox({
  images,
  index,
  onClose,
  onIndexChange,
  renderActions,
}: ImageLightboxProps) {
  const image = images[index];
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{
    startOffset: Point;
    startPoint: Point;
    startScale: number;
    startDistance: number;
    moved: boolean;
    onBackdrop: boolean;
  } | null>(null);
  const scaleRef = useRef(1);
  const offsetRef = useRef<Point>({ x: 0, y: 0 });

  const applyView = useCallback((nextScale: number, nextOffset: Point) => {
    scaleRef.current = nextScale;
    offsetRef.current = nextOffset;
    setScale(nextScale);
    setOffset(nextOffset);
  }, []);

  const clampOffset = useCallback((next: Point, nextScale: number): Point => {
    const stage = stageRef.current;
    const img = imgRef.current;
    if (!stage || !img || nextScale <= 1) return { x: 0, y: 0 };
    const maxX = Math.max(0, (img.offsetWidth * nextScale - stage.clientWidth) / 2);
    const maxY = Math.max(0, (img.offsetHeight * nextScale - stage.clientHeight) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  }, []);

  /** Aplica zoom manteniendo fijo el punto indicado (relativo al centro del visor). */
  const zoomTo = useCallback(
    (nextScale: number, focus: Point = { x: 0, y: 0 }) => {
      const current = scaleRef.current;
      const target = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
      const prev = offsetRef.current;
      const ratio = target / current;
      const next = {
        x: focus.x - (focus.x - prev.x) * ratio,
        y: focus.y - (focus.y - prev.y) * ratio,
      };
      applyView(target, clampOffset(next, target));
    },
    [applyView, clampOffset]
  );

  const resetZoom = useCallback(() => {
    applyView(1, { x: 0, y: 0 });
  }, [applyView]);

  const go = useCallback(
    (delta: number) => {
      if (images.length < 2) return;
      resetZoom();
      onIndexChange((index + delta + images.length) % images.length);
    },
    [images.length, index, onIndexChange, resetZoom]
  );

  function focusFromClient(clientX: number, clientY: number): Point {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: clientX - (rect.left + rect.width / 2),
      y: clientY - (rect.top + rect.height / 2),
    };
  }

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft") go(-1);
      else if (event.key === "ArrowRight") go(1);
      else if (event.key === "+" || event.key === "=") zoomTo(scaleRef.current * STEP);
      else if (event.key === "-") zoomTo(scaleRef.current / STEP);
      else if (event.key === "0") resetZoom();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [go, onClose, resetZoom, zoomTo]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const rect = stage!.getBoundingClientRect();
      const focus = {
        x: event.clientX - (rect.left + rect.width / 2),
        y: event.clientY - (rect.top + rect.height / 2),
      };
      const factor = Math.exp(-event.deltaY * 0.0025);
      zoomTo(scaleRef.current * factor, focus);
    }
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [zoomTo]);

  function pinchDistance() {
    const [a, b] = [...pointers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const onBackdrop = event.target === event.currentTarget;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    gesture.current = {
      startOffset: offsetRef.current,
      startPoint: { x: event.clientX, y: event.clientY },
      startScale: scaleRef.current,
      startDistance: pinchDistance(),
      moved: pointers.current.size > 1,
      onBackdrop,
    };
    setDragging(true);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const g = gesture.current;

    if (pointers.current.size >= 2 && g.startDistance > 0) {
      const [a, b] = [...pointers.current.values()];
      const focus = focusFromClient((a.x + b.x) / 2, (a.y + b.y) / 2);
      zoomTo(g.startScale * (pinchDistance() / g.startDistance), focus);
      g.moved = true;
      return;
    }

    const dx = event.clientX - g.startPoint.x;
    const dy = event.clientY - g.startPoint.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) g.moved = true;
    if (scaleRef.current > 1) {
      applyView(
        scaleRef.current,
        clampOffset({ x: g.startOffset.x + dx, y: g.startOffset.y + dy }, scaleRef.current)
      );
    }
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    pointers.current.delete(event.pointerId);
    if (pointers.current.size > 0) {
      const [rest] = [...pointers.current.values()];
      gesture.current = {
        startOffset: offsetRef.current,
        startPoint: rest,
        startScale: scaleRef.current,
        startDistance: 0,
        moved: true,
        onBackdrop: false,
      };
      return;
    }
    gesture.current = null;
    setDragging(false);
    if (!g || g.moved) return;

    const swipe = event.clientX - g.startPoint.x;
    if (scaleRef.current === 1 && Math.abs(swipe) > 60) go(swipe > 0 ? -1 : 1);
    else if (g.onBackdrop && scaleRef.current === 1) onClose();
  }

  if (!image || typeof document === "undefined") return null;

  const zoomPercent = Math.round(scale * 100);

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex flex-col bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-label="Visor de imágenes"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-white">
        <p className="min-w-0 truncate text-sm text-white/85">
          {image.caption || image.alt || "Imagen"}
          {images.length > 1 ? ` · ${index + 1} de ${images.length}` : ""}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="rounded-full p-2 hover:bg-white/15 disabled:opacity-40"
            onClick={() => zoomTo(scale / STEP)}
            disabled={scale <= MIN_SCALE}
            aria-label="Alejar"
            title="Alejar (−)"
          >
            <ZoomOut className="size-5" />
          </button>
          <span className="w-12 text-center text-xs tabular-nums text-white/80">
            {zoomPercent}%
          </span>
          <button
            type="button"
            className="rounded-full p-2 hover:bg-white/15 disabled:opacity-40"
            onClick={() => zoomTo(scale * STEP)}
            disabled={scale >= MAX_SCALE}
            aria-label="Acercar"
            title="Acercar (+)"
          >
            <ZoomIn className="size-5" />
          </button>
          <button
            type="button"
            className="rounded-full p-2 hover:bg-white/15 disabled:opacity-40"
            onClick={resetZoom}
            disabled={scale === 1}
            aria-label="Restablecer zoom"
            title="Restablecer (0)"
          >
            <RotateCcw className="size-5" />
          </button>
          <a
            href={image.src}
            target="_blank"
            rel="noreferrer"
            className="rounded-full p-2 hover:bg-white/15"
            aria-label="Abrir original en otra pestaña"
            title="Abrir original"
          >
            <ExternalLink className="size-5" />
          </a>
          <button
            type="button"
            className="ml-1 rounded-full bg-white/15 p-2 hover:bg-white/25"
            onClick={onClose}
            aria-label="Cerrar"
            title="Cerrar (Esc)"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      <div
        ref={stageRef}
        className="relative flex min-h-0 flex-1 touch-none select-none items-center justify-center overflow-hidden"
        style={{ cursor: scale > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={(event) => {
          const focus = focusFromClient(event.clientX, event.clientY);
          if (scale > 1) resetZoom();
          else zoomTo(2.5, focus);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          key={image.src}
          src={image.src}
          alt={image.alt || image.caption || "Imagen"}
          draggable={false}
          className="max-h-full max-w-full object-contain"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transition: dragging ? "none" : "transform 120ms ease-out",
          }}
        />

        {images.length > 1 ? (
          <>
            <button
              type="button"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-2 text-white hover:bg-white/25 sm:left-4"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => go(-1)}
              aria-label="Imagen anterior"
            >
              <ChevronLeft className="size-6" />
            </button>
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-2 text-white hover:bg-white/25 sm:right-4"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => go(1)}
              aria-label="Imagen siguiente"
            >
              <ChevronRight className="size-6" />
            </button>
          </>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 px-3 pb-3 pt-2">
        {renderActions ? (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {renderActions(index)}
          </div>
        ) : null}
        {images.length > 1 ? (
          <div className="flex justify-center gap-2 overflow-x-auto pb-1">
            {images.map((item, i) => (
              <button
                key={item.src}
                type="button"
                onClick={() => {
                  resetZoom();
                  onIndexChange(i);
                }}
                className={`size-14 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                  i === index ? "border-sky-400" : "border-transparent opacity-60 hover:opacity-100"
                }`}
                aria-label={`Ver imagen ${i + 1}`}
                aria-current={i === index}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}
        <p className="text-center text-[11px] text-white/50">
          Rueda o pellizca para acercar · doble clic para ampliar · arrastra para mover
        </p>
      </div>
    </div>,
    document.body
  );
}
