import type { SVGProps } from "react";

/** Ícono estilo Lucide: máquina de anestesia (gabinete, vaporizadores, monitor y circuito). */
export function AnesthesiaMachineIcon({
  className,
  width = 24,
  height = 24,
  strokeWidth = 2,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      {...props}
    >
      {/* Gabinete */}
      <rect x="3" y="11" width="11" height="8" rx="1.5" />
      {/* Ruedas */}
      <path d="M5.5 19v2" />
      <path d="M11.5 19v2" />
      {/* Monitor */}
      <rect x="15" y="3" width="6" height="5" rx="1" />
      <path d="M17 5.5h2" />
      <path d="M16 8v3" />
      {/* Vaporizadores */}
      <rect x="4.5" y="4" width="3" height="7" rx="1" />
      <rect x="8.5" y="5.5" width="3" height="5.5" rx="1" />
      {/* Circuito / fuelle */}
      <circle cx="18.5" cy="15" r="2.75" />
      <path d="M14 14.5h1.75" />
      {/* Tubo */}
      <path d="M18.5 17.75c0 1.4-.9 2.5-2.25 3" />
    </svg>
  );
}
