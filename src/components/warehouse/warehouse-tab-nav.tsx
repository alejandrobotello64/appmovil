"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { WAREHOUSE_TABS, isWarehouseTabId } from "@/lib/warehouse/tabs";
import { cn } from "@/lib/utils";

export function WarehouseTabNav() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = isWarehouseTabId(tabParam) ? tabParam : "dashboard";

  return (
    <nav
      aria-label="Secciones del almacén"
      className="-mx-4 sticky top-[57px] z-20 border-b border-border bg-background/95 px-4 py-2 backdrop-blur lg:hidden"
    >
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {WAREHOUSE_TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={cn(
                "shrink-0 snap-start rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                  : "border border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
