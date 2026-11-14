"use client";

import { useEffect, useRef } from "react";
import { SwitchCamera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCamera } from "@/lib/media/use-camera";

type CameraCodeReaderProps = {
  onDetected: (code: string) => void;
};

/** Lee códigos de barras / QR / DataMatrix con la cámara (alternativa al lector). */
export function CameraCodeReader({ onDetected }: CameraCodeReaderProps) {
  const { videoRef, devices, ready, error, switchCamera } = useCamera(true);
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    let timer = 0;
    const canvas = document.createElement("canvas");

    void (async () => {
      const [{ BrowserMultiFormatReader }, { DecodeHintType }] = await Promise.all([
        import("@zxing/browser"),
        import("@zxing/library"),
      ]);
      const hints = new Map();
      hints.set(DecodeHintType.TRY_HARDER, true);
      const reader = new BrowserMultiFormatReader(hints);

      const tick = () => {
        if (cancelled) return;
        const video = videoRef.current;
        if (video && video.videoWidth) {
          const scale = Math.min(1, 1280 / video.videoWidth);
          canvas.width = Math.round(video.videoWidth * scale);
          canvas.height = Math.round(video.videoHeight * scale);
          canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
          try {
            const result = reader.decodeFromCanvas(canvas);
            const text = result?.getText();
            if (text) {
              onDetectedRef.current(text);
              return;
            }
          } catch {
            /* sin código en este cuadro */
          }
        }
        timer = window.setTimeout(tick, 250);
      };
      tick();
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [ready, videoRef]);

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} playsInline muted className="aspect-video w-full object-cover" />
        <div className="pointer-events-none absolute inset-x-[15%] inset-y-[20%] rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        {!ready && !error ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
            Abriendo cámara…
          </div>
        ) : null}
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white">
            {error}
          </div>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Acerca el código al recuadro; se lee automáticamente.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={switchCamera}
          disabled={devices.length < 2}
        >
          <SwitchCamera className="mr-1.5 size-4" />
          Cambiar cámara
        </Button>
      </div>
    </div>
  );
}
