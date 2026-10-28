import { NextResponse } from "next/server";
import { catalogPhotoSvg } from "@/lib/inventory/catalog-photo";
import { supabase } from "@/lib/supabase/client";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!UUID.test(id)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { data, error } = await supabase
    .from("inventory_items")
    .select("sku, name, brand, model, part_number, category")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return new NextResponse("Not found", { status: 404 });
  }

  const svg = catalogPhotoSvg({
    sku: data.sku,
    name: data.name,
    brand: data.brand,
    model: data.model,
    partNumber: data.part_number,
    category: data.category,
  });

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
