"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CameraDevice = { deviceId: string; label: string };

const DEVICE_STORAGE_KEY = "mas-camera-device";

function cameraErrorMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "No hay permiso para usar la cámara. Permítelo desde el candado de la barra de direcciones.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No se encontró una cámara disponible.";
  }
  if (name === "NotReadableError") {
    return "La cámara está en uso por otra aplicación. Ciérrala e intenta de nuevo.";
  }
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "La cámara solo funciona en HTTPS o en localhost.";
  }
  return error instanceof Error ? error.message : "No se pudo abrir la cámara.";
}

function rememberedDevice() {
  try {
    return window.localStorage.getItem(DEVICE_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * Abre la cámara en un <video>. Empieza con la cámara trasera (o la última usada)
 * y permite alternar entre las disponibles (frontal / trasera de la tablet).
 */
export function useCamera(active: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [requestedId, setRequestedId] = useState("");
  const [opened, setOpened] = useState<{ key: string; deviceId: string } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const key = `${active}:${requestedId}`;
  const supported =
    typeof navigator === "undefined" || Boolean(navigator.mediaDevices?.getUserMedia);

  useEffect(() => {
    if (!active || !navigator.mediaDevices?.getUserMedia) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    const wanted = requestedId || rememberedDevice();
    const video: MediaTrackConstraints = {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      ...(wanted ? { deviceId: { exact: wanted } } : { facingMode: { ideal: "environment" } }),
    };

    navigator.mediaDevices
      .getUserMedia({ video, audio: false })
      .catch((reason) => {
        if (wanted && reason instanceof DOMException && reason.name === "OverconstrainedError") {
          return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        throw reason;
      })
      .then(async (media) => {
        if (cancelled) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = media;
        const element = videoRef.current;
        if (element) {
          element.srcObject = media;
          await element.play().catch(() => undefined);
        }
        const list = (await navigator.mediaDevices.enumerateDevices())
          .filter((device) => device.kind === "videoinput")
          .map((device, index) => ({
            deviceId: device.deviceId,
            label: device.label || `Cámara ${index + 1}`,
          }));
        if (cancelled) return;
        setDevices(list);
        setOpened({ key, deviceId: media.getVideoTracks()[0]?.getSettings().deviceId ?? "" });
      })
      .catch((reason) => {
        if (!cancelled) setFailure({ key, message: cameraErrorMessage(reason) });
      });

    const element = videoRef.current;
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
      if (element) element.srcObject = null;
    };
  }, [active, requestedId, key]);

  const ready = opened?.key === key;
  const deviceId = ready ? opened.deviceId : "";
  const error = !supported
    ? cameraErrorMessage(null)
    : failure?.key === key
      ? failure.message
      : "";

  const switchCamera = useCallback(() => {
    if (devices.length < 2) return;
    const index = devices.findIndex((device) => device.deviceId === deviceId);
    const next = devices[(index + 1) % devices.length];
    try {
      window.localStorage.setItem(DEVICE_STORAGE_KEY, next.deviceId);
    } catch {
      /* almacenamiento no disponible */
    }
    setRequestedId(next.deviceId);
  }, [devices, deviceId]);

  /** Toma el cuadro actual del video como JPG. */
  const capture = useCallback(async (quality = 0.88): Promise<File | null> => {
    const element = videoRef.current;
    if (!element || !element.videoWidth) return null;
    const canvas = document.createElement("canvas");
    canvas.width = element.videoWidth;
    canvas.height = element.videoHeight;
    canvas.getContext("2d")?.drawImage(element, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (!blob) return null;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    return new File([blob], `foto-${stamp}.jpg`, { type: "image/jpeg" });
  }, []);

  return { videoRef, devices, deviceId, ready, error, switchCamera, capture };
}
