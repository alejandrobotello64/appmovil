"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const LOGIN_SLIDES = [
  {
    src: "/assets/login/slide-1.jpg",
    alt: "Incubadoras neonatales Dräger",
  },
  {
    src: "/assets/login/slide-2.jpg",
    alt: "Estación de anestesia con insumos médicos",
  },
  {
    src: "/assets/login/slide-3.jpg",
    alt: "Monitor y estación Dräger en quirófano",
  },
  {
    src: "/assets/login/slide-4.jpg",
    alt: "Equipo Atlan A350 XL",
  },
  {
    src: "/assets/login/slide-5.jpg",
    alt: "Unidad neonatal Babyleo",
  },
] as const;

const INTERVAL_MS = 6500;

export function LoginCarousel() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActive((current) => (current + 1) % LOGIN_SLIDES.length);
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
      {LOGIN_SLIDES.map((slide, index) => {
        const isActive = index === active;
        return (
          <div
            key={slide.src}
            className={cn(
              "absolute inset-0 transition-opacity duration-[1400ms] ease-in-out",
              isActive ? "opacity-100" : "opacity-0"
            )}
          >
            <Image
              src={slide.src}
              alt={slide.alt}
              fill
              priority={index === 0}
              sizes="(max-width: 420px) 100vw, 420px"
              className={cn(
                "object-cover transition-transform duration-[6500ms] ease-out",
                isActive ? "scale-105" : "scale-100"
              )}
            />
          </div>
        );
      })}

      {/* Oscurece la foto para priorizar logo y campos */}
      <div className="absolute inset-0 bg-black/55" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,12,28,0.35)_0%,rgba(8,12,28,0.62)_45%,rgba(8,12,28,0.78)_100%)]" />

      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
        {LOGIN_SLIDES.map((slide, index) => (
          <span
            key={slide.src}
            className={cn(
              "h-1.5 rounded-full transition-all duration-500",
              index === active ? "w-5 bg-white" : "w-1.5 bg-white/45"
            )}
          />
        ))}
      </div>
    </div>
  );
}
