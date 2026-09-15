"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { searchCatalog, type GlobalSearchHit } from "@/lib/inventory/search";

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GlobalSearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void searchCatalog(query)
        .then((rows) => {
          setHits(rows);
          setError("");
        })
        .catch((err) =>
          setError(err instanceof Error ? err.message : "No se pudo buscar")
        );
    }, 250);
    return () => window.clearTimeout(handle);
  }, [query]);

  return (
    <div className="relative hidden min-w-0 flex-1 md:block md:max-w-md">
      <label className="relative block">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          placeholder="Código MAS, serie, lote, marca..."
          className="h-9 w-full rounded-lg border border-input bg-background pr-3 pl-8 text-sm outline-none focus:border-[#3B46A5]"
        />
      </label>
      {open && (query.trim().length >= 2 || error) ? (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-card p-2 shadow-xl">
          {error ? (
            <p className="px-2 py-1.5 text-xs text-destructive">{error}</p>
          ) : hits.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              Sin coincidencias
            </p>
          ) : (
            <ul className="max-h-72 overflow-auto">
              {hits.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    onMouseDown={() => {
                      router.push(hit.href);
                      setQuery("");
                      setOpen(false);
                    }}
                    className="flex w-full flex-col rounded-lg px-2 py-1.5 text-left hover:bg-muted"
                  >
                    <span className="text-sm font-medium">{hit.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {hit.kind} · {hit.subtitle || "Sin detalle"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
