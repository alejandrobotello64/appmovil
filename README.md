# Medical Advanced Supplies (MAS)

App de almacén e inventario: login, inventario, proveedores, órdenes, movimientos, mantenimientos, calendario operativo y **calidad** (encuestas de satisfacción enviables por WhatsApp al cliente, con enlace público `/encuesta/{token}`). El código vive en GitHub (`alejandrobotello64/appmovil`) y los datos en Postgres con la API de Supabase.

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

El catálogo real (más de 1500 SKU) está en `supabase/seed_catalog.sql` y se carga con `npm run db:local`. Para volver a volcar la base local al repo: `npm run db:export-catalog`.

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

La existencia **no se edita a mano**. Productos, almacenes y ubicaciones viven en Postgres; entradas (`EM-`), salidas (`SAL-`) y traspasos (`TR-`) pasan por `apply_stock_movement` / `transfer_stock` y dejan kardex inmutable.

El catálogo se puede **exportar e importar en Excel** (.xlsx o .csv) junto a Nuevo producto. Acepta la plantilla MAS o un inventario con columnas habituales (`Código`, `Descripción`, `Cantidad`, `Precio`). Los SKU nuevos se dan de alta; los que ya existen se actualizan. La columna de existencia solo carga stock inicial en altas nuevas.

La recepción de pedidos puede ser **parcial**. Entradas y salidas piden almacén, ubicación, lote/caducidad/serie cuando el producto lo exige. Los roles (`administrador`, `almacén`, `compras`, `ventas`, `servicio`, `dirección`) filtran el menú y bloquean escritura.

Migración: `supabase/migrations/20260916000000_inventory_core_structure.sql` (aditiva; no borra `inventory_items` ni datos).


| Script | Qué hace |
| --- | --- |
| `npm run dev` | Next.js en el puerto 43145 |
| `npm run db:local` | Crea la base `mas`, aplica migraciones, usuarios y el catálogo |
| `npm run db:export-catalog` | Vuelca `inventory_items` local a `supabase/seed_catalog.sql` |
| `npm run dev:api` | Gateway compatible con el cliente Supabase (`/rest/v1`) |
| `npm run db:push` | Empuja migraciones al proyecto linkeado |
| `npm run db:seed` | Seed en el proyecto linkeado |
