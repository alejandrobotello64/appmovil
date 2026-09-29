"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import {
  isRequestOverdue,
  requestOutstanding,
  TOOL_REQUEST_STATUSES,
  type ToolRequest,
  type ToolRequestStatus,
} from "@/lib/tools/types";
import { cn } from "@/lib/utils";
import { fieldClass, formatDate, StatusBadge } from "./tools-shared";

export type RequestFilter = "activas" | "pendientes" | "prestadas" | "vencidas" | "todas" | ToolRequestStatus;

const QUICK_FILTERS: { id: RequestFilter; label: string }[] = [
  { id: "activas", label: "Activas" },
  { id: "pendientes", label: "Por entregar" },
  { id: "prestadas", label: "Prestadas" },
  { id: "vencidas", label: "Vencidas" },
  { id: "todas", label: "Todas" },
];

function matchesFilter(request: ToolRequest, filter: RequestFilter, today: Date) {
  switch (filter) {
    case "activas":
      return ["solicitada", "entregada", "devolucion_parcial"].includes(request.status);
    case "pendientes":
      return request.status === "solicitada";
    case "prestadas":
      return (request.status === "entregada" || request.status === "devolucion_parcial") && requestOutstanding(request) > 0;
    case "vencidas":
      return isRequestOverdue(request, today);
    case "todas":
      return true;
    default:
      return request.status === filter;
  }
}

export function ToolRequestsList({
  requests,
  today,
  filter,
  onFilterChange,
  showDateRange,
  emptyText,
  onOpen,
}: {
  requests: ToolRequest[];
  today: Date;
  filter: RequestFilter;
  onFilterChange: (filter: RequestFilter) => void;
  showDateRange?: boolean;
  emptyText: string;
  onOpen: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests.filter((request) => {
      if (!matchesFilter(request, filter, today)) return false;
      const day = request.requestedAt.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (!q) return true;
      return [
        request.folio,
        request.purpose,
        request.requester.name,
        request.deliverer.name,
        request.serviceOrderFolio,
        request.clientName,
        ...request.lines.flatMap((line) => [line.toolName, line.toolCode]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [requests, filter, today, query, from, to]);

  const counts = useMemo(() => {
    const map = new Map<RequestFilter, number>();
    for (const item of QUICK_FILTERS) {
      map.set(item.id, requests.filter((request) => matchesFilter(request, item.id, today)).length);
    }
    return map;
  }, [requests, today]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">Buscar vales</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className={cn(fieldClass, "pl-9")}
            placeholder="Buscar por folio, persona, herramienta u orden de servicio"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Estatus"
          className={cn(fieldClass, "w-auto")}
          value={filter}
          onChange={(e) => onFilterChange(e.target.value as RequestFilter)}
        >
          {QUICK_FILTERS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
          {TOOL_REQUEST_STATUSES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        {showDateRange ? (
          <>
            <label className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              Del
              <input type="date" className={cn(fieldClass, "w-auto")} value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              al
              <input type="date" className={cn(fieldClass, "w-auto")} value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </>
        ) : null}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {QUICK_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onFilterChange(item.id)}
            aria-pressed={filter === item.id}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
              filter === item.id
                ? item.id === "vencidas"
                  ? "border-destructive bg-destructive text-white"
                  : "border-[#3B46A5] bg-[#3B46A5] text-white"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {item.label} <span className="opacity-70">{counts.get(item.id) ?? 0}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {requests.length === 0 ? emptyText : "Ningún vale coincide con los filtros."}
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {filtered.map((request) => {
            const pieces = request.lines.reduce((acc, line) => acc + line.quantityRequested, 0);
            const outstanding = requestOutstanding(request);
            const names = request.lines.map((line) => line.toolName);
            return (
              <li key={request.id}>
                <button
                  type="button"
                  onClick={() => onOpen(request.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                >
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{request.folio}</span>
                      <StatusBadge status={request.status} overdue={isRequestOverdue(request, today)} />
                      {request.serviceOrderFolio ? (
                        <span className="text-xs text-muted-foreground">OS {request.serviceOrderFolio}</span>
                      ) : null}
                    </span>
                    <span className="block truncate text-sm">
                      {names.slice(0, 3).join(", ")}
                      {names.length > 3 ? ` y ${names.length - 3} más` : ""}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {request.requester.name} · {formatDate(request.requestedAt)} · {pieces} pieza(s)
                      {request.deliverer.name ? ` · entregó ${request.deliverer.name}` : ""}
                    </span>
                  </span>
                  <span className="hidden shrink-0 text-right text-xs sm:block">
                    {outstanding > 0 ? (
                      <span className="block font-semibold text-amber-700 dark:text-amber-300">
                        {outstanding} por devolver
                      </span>
                    ) : null}
                    <span className="block text-muted-foreground">Dev. {formatDate(request.expectedReturnAt)}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
