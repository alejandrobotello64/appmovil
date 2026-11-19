"use client";

import { useEffect, useRef } from "react";
import { SwitchCamera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCamera } from "@/lib/media/use-camera";

type CameraCodeReaderProps = {
  onDetected: (code: string) => void;
};

/**
 * Reconstruye el texto GS1 desde BYTE_SEGMENTS cuando FNC1 (232) no llegó
 * como separador de grupo (ASCII 29) en getText().
 */
function textFromZxingResult(result: {
  getText: () => string;
  getResultMetadata?: () => Map<unknown, unknown> | null | undefined;
}): string {
  const text = (result.getText() ?? "").trim();
  const meta = result.getResultMetadata?.();
  if (!meta) return text;

  // ResultMetadataType.BYTE_SEGMENTS === 2 in @zxing/library enums
  const segments =
    (meta.get(2) as Uint8Array[] | undefined) ||
    (meta.get("BYTE_SEGMENTS") as Uint8Array[] | undefined);
  if (!Array.isArray(segments) || segments.length === 0) return text;

  let rebuilt = "";
  for (const seg of segments) {
    for (const byte of seg) {
      if (byte === 232 || byte === 29) rebuilt += "\u001d";
      else if (byte >= 32 && byte !== 127) rebuilt += String.fromCharCode(byte);
    }
  }
  rebuilt = rebuilt.trim();
  if (!rebuilt) return text;
  const gsCount = (s: string) => (s.match(/\u001d/g) || []).length;
  // Preferir el que conserve más separadores GS1 (lote/fechas).
  if (gsCount(rebuilt) > gsCount(text)) return rebuilt;
  if (gsCount(rebuilt) === gsCount(text) && rebuilt.length >= text.length) {
    return rebuilt;
  }
  return text;
}

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
      const [
        { BrowserMultiFormatReader },
        { BarcodeFormat, DecodeHintType, ResultMetadataType },
      ] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
      const hints = new Map();
      hints.set(DecodeHintType.TRY_HARDER, true);
      // Conserva FNC1/GS en DataMatrix GS1 / Code128 para no perder lote y fechas.
      hints.set(DecodeHintType.ASSUME_GS1, true);
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.DATA_MATRIX,
        BarcodeFormat.QR_CODE,
        BarcodeFormat.CODE_128,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_39,
      ]);
      const reader = new BrowserMultiFormatReader(hints);

      const extractText = (result: {
        getText: () => string;
        getResultMetadata?: () => Map<unknown, unknown> | null | undefined;
      }) => {
        const meta = result.getResultMetadata?.();
        // Prefer BYTE_SEGMENTS enum when available.
        if (meta && ResultMetadataType?.BYTE_SEGMENTS != null) {
          const segments = meta.get(ResultMetadataType.BYTE_SEGMENTS) as
            | Uint8Array[]
            | undefined;
          if (segments?.length) {
            let rebuilt = "";
            for (const seg of segments) {
              for (const byte of seg) {
                if (byte === 232 || byte === 29) rebuilt += "\u001d";
                else if (byte >= 32 && byte !== 127) {
                  rebuilt += String.fromCharCode(byte);
                }
              }
            }
            rebuilt = rebuilt.trim();
            if (rebuilt) {
              const gsCount = (s: string) => (s.match(/\u001d/g) || []).length;
              const plain = (result.getText() ?? "").trim();
              if (gsCount(rebuilt) >= gsCount(plain)) return rebuilt;
            }
          }
        }
        return textFromZxingResult(result);
      };

      const tick = () => {
        if (cancelled) return;
        const video = videoRef.current;
        if (video && video.videoWidth) {
          // Resolución más alta ayuda a DataMatrix pequeños de etiqueta médica.
          const scale = Math.min(1.5, 1600 / video.videoWidth);
          canvas.width = Math.round(video.videoWidth * scale);
          canvas.height = Math.round(video.videoHeight * scale);
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);

          const attempts: Array<() => ReturnType<typeof reader.decodeFromCanvas>> = [
            () => reader.decodeFromCanvas(canvas),
          ];
          // Recorte al recuadro central (donde el usuario alinea el código).
          if (ctx && canvas.width > 80 && canvas.height > 80) {
            const crop = document.createElement("canvas");
            const cx = Math.round(canvas.width * 0.15);
            const cy = Math.round(canvas.height * 0.2);
            const cw = Math.round(canvas.width * 0.7);
            const ch = Math.round(canvas.height * 0.6);
            crop.width = cw;
            crop.height = ch;
            crop.getContext("2d")?.drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);
            attempts.push(() => reader.decodeFromCanvas(crop));
          }

          for (const attempt of attempts) {
            try {
              const result = attempt();
              const text = extractText(result);
              if (text) {
                onDetectedRef.current(text);
                return;
              }
            } catch {
              /* sin código en este intento */
            }
          }
        }
        timer = window.setTimeout(tick, 200);
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
          Acerca el DataMatrix o código al recuadro; se leen lote, fabricación y caducidad
          automáticamente.
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
