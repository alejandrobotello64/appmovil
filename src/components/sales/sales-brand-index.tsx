"use client";

import { FileText, Package, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { normalizeBrand } from "@/lib/inventory/brands";
import {
  AUTHORIZED_SALES_BRANDS,
  documentMatchesEntry,
  equipmentSearchText,
  groupCatalogByBrand,
  matchesBroadSearch,
  SALES_EQUIPMENT_CATALOG,
  type SalesEquipmentEntry,
} from "@/lib/sales-catalog/brand-equipment";
import { catalogDocTypeLabel, type CatalogDocument } from "@/lib/sales-catalog/types";
import { cn } from "@/lib/utils";

export type SalesUploadPreset = {
  title: string;
  brand: string;
  productLine: string;
  model: string;
  docType?: "brochure" | "folleto" | "presentacion";
};

type SalesBrandIndexProps = {
  documents: CatalogDocument[];
  search: string;
  brandFilter: string;
  onBrandFilter: (brand: string) => void;
  canUpload: boolean;
  onUpload: (preset: SalesUploadPreset) => void;
  onOpenDoc: (doc: CatalogDocument) => void;
};

export function filterSalesEquipment(search: string, brandFilter: string) {
  const brand = brandFilter === "all" ? "" : normalizeBrand(brandFilter);
  return SALES_EQUIPMENT_CATALOG.filter((entry) => {
    if (brand && normalizeBrand(entry.brand) !== brand) return false;
    return matchesBroadSearch(equipmentSearchText(entry), search);
  });
}

export function orphanSalesDocuments(
  documents: CatalogDocument[],
  entries: SalesEquipmentEntry[] = SALES_EQUIPMENT_CATALOG
) {
  return documents.filter(
    (doc) => !entries.some((entry) => documentMatchesEntry(doc, entry))
  );
}

export function SalesBrandIndex({
  documents,
  search,
  brandFilter,
  onBrandFilter,
  canUpload,
  onUpload,
  onOpenDoc,
}: SalesBrandIndexProps) {
  const entries = filterSalesEquipment(search, brandFilter);
  const groups = groupCatalogByBrand(entries);
  const linkedCount = documents.filter((doc) =>
    SALES_EQUIPMENT_CATALOG.some((entry) => documentMatchesEntry(doc, entry))
  ).length;

  return (
    <div className="space-y-4 border-b border-border p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Índice comercial por marca</h3>
          <p className="text-xs text-muted-foreground">
            {AUTHORIZED_SALES_BRANDS.length} marcas · {SALES_EQUIPMENT_CATALOG.length} equipos ·{" "}
            {linkedCount} brochure{linkedCount === 1 ? "" : "s"} vinculado
            {linkedCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <BrandChip
          active={brandFilter === "all"}
          onClick={() => onBrandFilter("all")}
          label="Todas"
          count={SALES_EQUIPMENT_CATALOG.length}
        />
        {AUTHORIZED_SALES_BRANDS.map((brand) => {
          const count = SALES_EQUIPMENT_CATALOG.filter(
            (entry) => normalizeBrand(entry.brand) === brand
          ).length;
          return (
            <BrandChip
              key={brand}
              active={brandFilter === brand}
              onClick={() => onBrandFilter(brandFilter === brand ? "all" : brand)}
              label={brand}
              count={count}
            />
          );
        })}
      </div>

      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Ningún equipo del índice coincide con la búsqueda.
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.brand} className="space-y-3">
              <div className="flex items-baseline gap-2">
                <h4 className="text-sm font-semibold text-foreground">{group.brand}</h4>
                <span className="text-xs text-muted-foreground">
                  {group.count} equipo{group.count === 1 ? "" : "s"}
                </span>
              </div>
              {group.lines.map((line) => (
                <div key={`${group.brand}-${line.productLine}`} className="space-y-2">
                  <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    {line.productLine}
                  </p>
                  <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {line.items.map((entry) => {
                      const docs = documents.filter((doc) => documentMatchesEntry(doc, entry));
                      return (
                        <li
                          key={entry.id}
                          className="flex flex-col rounded-xl border border-border bg-card p-3"
                        >
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                              <Package className="size-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">
                                {entry.name}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {entry.model}
                                {entry.model ? " · " : ""}
                                {entry.productLine}
                              </p>
                            </div>
                          </div>
                          {entry.tags.length ? (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {entry.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          <div className="mt-3 flex flex-1 flex-col gap-1.5">
                            {docs.length ? (
                              docs.map((doc) => (
                                <button
                                  key={doc.id}
                                  type="button"
                                  onClick={() => onOpenDoc(doc)}
                                  className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-left text-xs hover:bg-muted"
                                >
                                  <FileText className="size-3.5 shrink-0 text-[#00BFFF]" />
                                  <span className="min-w-0 flex-1 truncate font-medium">
                                    {doc.title}
                                  </span>
                                  <span className="shrink-0 text-muted-foreground">
                                    {catalogDocTypeLabel(doc.docType)}
                                  </span>
                                </button>
                              ))
                            ) : (
                              <p className="rounded-lg border border-dashed border-border px-2 py-1.5 text-xs text-muted-foreground">
                                Sin brochure
                              </p>
                            )}
                          </div>
                          {canUpload ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="mt-2 h-8"
                              onClick={() =>
                                onUpload({
                                  title: `Brochure ${entry.brand} ${entry.model || entry.name}`,
                                  brand: entry.brand,
                                  productLine: entry.productLine,
                                  model: entry.model,
                                  docType: "brochure",
                                })
                              }
                            >
                              <Upload className="mr-1.5 size-3.5" />
                              Subir brochure
                            </Button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function BrandChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-transparent bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {label} <span className="tabular-nums opacity-75">{count}</span>
    </button>
  );
}
