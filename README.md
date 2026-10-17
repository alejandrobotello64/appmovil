# Medical Advanced Supplies (MAS)

App de almacén, **compras** e inventario: login, inventario, solicitudes de compra de almacén a compras, pedidos, proveedores, órdenes, movimientos, mantenimientos, calendario operativo y **calidad** (encuestas de satisfacción enviables por WhatsApp al cliente, con enlace público `/encuesta/{token}`). El código vive en GitHub (`alejandrobotello64/appmovil`) y los datos en Postgres con la API de Supabase.

## Arranque local

```bash
npm install
cp .env.example .env.local
npm run db:local          # PostgreSQL + esquema y seed del repo
npx postgrest ~/.local/mas/postgrest.conf &
npm run dev:api &         # gateway en http://127.0.0.1:54321
npm run dev               # http://127.0.0.1:43145
```

Usuarios iniciales (seed): `alexbazz64@gmail.com` / `admin123` y `masservice.lcs@gmail.com` / `mas101012`.

El catálogo y el resto de datos de negocio viven en `supabase/seed_catalog.sql` y `supabase/seed_cloud_snapshot.sql`. `npm run db:local` los carga después de las migraciones.

Para volver a copiar el proyecto de Supabase en la nube sobre Postgres local (conserva los logins de `app_users`) y reescribir `supabase/seed_cloud_snapshot.sql`:

```bash
# En .env.local:
# CLOUD_SUPABASE_URL=https://iqfareiwiadqsauejaaf.supabase.co
# CLOUD_SUPABASE_ANON_KEY=<anon public>
npm run db:sync-cloud
npm run db:export-catalog
```

Las imágenes siguen en Storage de la nube. `db:export-catalog` congela `inventory_items` en `supabase/seed_catalog.sql`.

## Conectar el proyecto de Supabase en la nube

El `project_id` del repo es `iqfareiwiadqsauejaaf`.

1. Abre [API settings](https://supabase.com/dashboard/project/iqfareiwiadqsauejaaf/settings/api).
2. Copia `Project URL` y `anon public` a `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://iqfareiwiadqsauejaaf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

3. Reinicia `npm run dev`. Con URL de la nube, el navegador habla directo con Supabase (no con localhost). No hace falta PostgREST local.

Si el esquema de la nube está vacío: `npx supabase link --project-ref iqfareiwiadqsauejaaf` y `npm run db:push` / `npm run db:seed` (requiere un access token válido en [Account tokens](https://supabase.com/dashboard/account/tokens)).

## Inventario MAS

La existencia **no se edita a mano**. El catálogo se trabaja en una sola pestaña **Inventario** (insumos, medicamentos, refacciones, accesorios, reactivos y equipos), con filtro por categoría, **marcas rápidas** y una **columna de color** para separar productos (Dräger turquesa, Philips azul, Masimo morado, ASP verde…). El color se quita con **Sin color** en el formulario, o con la × de la pastilla en la lista; un producto sin color no hereda el de la marca. Los códigos nuevos de Cedros con foto pública llevan una **fotografía real del producto** (fabricante o distribuidor) en `public/catalog/photos/`; si no hay imagen en internet se muestra la ficha y se puede subir una foto desde el producto. Productos, almacenes y ubicaciones viven en Postgres; entradas (`EM-`), salidas (`SAL-`) y traspasos (`TR-`) pasan por `apply_stock_movement` / `transfer_stock` y dejan kardex inmutable.

## Kits de servicio

El catálogo de **kits** guarda listas típicas de insumos (SKU + cantidad) para no armar cada orden desde cero. Se edita en **Almacén → Kits** o **Biomédica → Kits**. En la pestaña Servicios de una orden se puede **Aplicar kit** (suma cantidades si el artículo ya está) o **Guardar como kit** las partidas actuales del catálogo.

Los ejemplos locales viven en `supabase/seed_kits.sql` (preventivo STERRAD, circuito Dräger e instalación de sondas). Migración: `supabase/migrations/20261011080000_supply_kits.sql`.

El catálogo se puede **exportar e importar en Excel** (.xlsx o .csv) junto a Nuevo producto. Acepta la plantilla MAS o un inventario con columnas habituales (`Código`, `Descripción`, `Cantidad`, `Precio`). Los SKU nuevos se dan de alta; los que ya existen se actualizan. La columna de existencia solo carga stock inicial en altas nuevas.

La recepción de pedidos puede ser **parcial**. Entradas y salidas piden almacén, ubicación, lote/caducidad/serie cuando el producto lo exige. Los roles (`administrador`, `almacén`, `compras`, `ventas`, `servicio`, `dirección`) filtran el menú y bloquean escritura.

Migración: `supabase/migrations/20260916000000_inventory_core_structure.sql` (aditiva; no borra `inventory_items` ni datos).

## Compras

El módulo **Compras** vive aparte de Almacén (`/dashboard/compras`): dashboard, solicitudes de almacén, pedidos y proveedores.

Cuando almacén no puede surtir un producto (solicitud de OS o reabasto), genera una orden `SC-YYYY-####` hacia Compras. Compras toma la solicitud, arma el pedido y el estatus recorre *solicitada → en compra → pedida → recepción parcial → recibida*. La recepción del pedido actualiza el surtimiento.

Si las tablas `purchase_requests` aún no están en la nube, o si existen pero les faltan columnas (`source_type`, `quantity_requested`, etc.), aplica en el [SQL Editor](https://supabase.com/dashboard/project/iqfareiwiadqsauejaaf/sql/new):

1. `supabase/migrations/20261001220000_purchase_requests.sql`
2. `supabase/migrations/20261001204500_lock_own_technician_advisor.sql`
3. `supabase/migrations/20261002090000_purchase_requests_cloud_columns.sql`

Hasta que el esquema esté completo, Compras sigue funcionando (localStorage o el esquema stub de la nube).

Para etiquetas de color, kits, marca/referencia en cotizaciones y el bucket de fotos, pega `scripts/apply-cloud-online-schema.sql` en el mismo SQL Editor. El catálogo Cedros (478 códigos nuevos, sin tocar los que ya existían) ya está en la nube; `npm run db:push-cloud-cedros` solo sirve para altas REST nuevas. Las cantidades y lotes del Excel se cargan con `npm run db:cedros-stock` (entrada de almacén; no pisa existencias que ya tenían stock).

## En línea (Vercel + Supabase)

App de producción: [https://medicaladvancedsupplies.vercel.app](https://medicaladvancedsupplies.vercel.app)

Proyecto Vercel: `medicaladvancedsupplies` (GitHub `alejandrobotello64/appmovil`, rama `main`). Variables:

- `NEXT_PUBLIC_SUPABASE_URL=https://iqfareiwiadqsauejaaf.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon public del proyecto)

Un `git push` a `main` en GitHub dispara el deploy. Framework: Next.js, Node 24.x.

La clave `anon` **no puede** crear columnas ni buckets. Si faltan `color_tag`, kits, `quote_lines.brand` / `part_number` o el bucket `inventory-media`, pega `scripts/apply-cloud-online-schema.sql` en el [SQL Editor](https://supabase.com/dashboard/project/iqfareiwiadqsauejaaf/sql/new) y dale Run. No borra existencias ni códigos.


| Script | Qué hace |
| --- | --- |
| `npm run dev` | Next.js en el puerto 43145 |
| `npm run db:local` | Crea la base `mas`, aplica migraciones, usuarios, catálogo y el snapshot de la nube |
| `npm run db:sync-cloud` | Copia el snapshot vivo de Supabase (nube) sobre Postgres local |
| `npm run db:push-cloud-cedros` | Alta REST de códigos Cedros nuevos en la nube (no modifica códigos existentes) |
| `npm run db:export-catalog` | Vuelca `inventory_items` local a `supabase/seed_catalog.sql` |
| `npm run dev:api` | Gateway compatible con el cliente Supabase (`/rest/v1`) |
| `npm run db:push` | Empuja migraciones al proyecto linkeado |
| `npm run db:seed` | Seed en el proyecto linkeado |
