# Medical Advanced Supplies (MAS)

App de almacén e inventario: login, inventario, proveedores, órdenes, movimientos y mantenimientos. El código vive en GitHub (`alejandrobotello64/appmovil`) y los datos en Postgres con la API de Supabase.

## Arranque local

```bash
npm install
cp .env.example .env.local
npm run db:local          # PostgreSQL + esquema y seed del repo
npx postgrest ~/.local/mas/postgrest.conf &
npm run dev:api &         # gateway en http://127.0.0.1:54321
npm run dev               # http://127.0.0.1:43145
```

Usuario inicial (seed): `alexbazz64@gmail.com` / `admin123`.

## Conectar el proyecto de Supabase en la nube

El `project_id` del repo es `iqfareiwiadqsauejaaf`.

1. Abre [API settings](https://supabase.com/dashboard/project/iqfareiwiadqsauejaaf/settings/api).
2. Copia `Project URL` y `anon public` a `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://iqfareiwiadqsauejaaf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

3. Reinicia `npm run dev`. No hace falta PostgREST local.

Si el esquema de la nube está vacío: `npx supabase link --project-ref iqfareiwiadqsauejaaf` y `npm run db:push` / `npm run db:seed` (requiere un access token válido en [Account tokens](https://supabase.com/dashboard/account/tokens)).

## Inventario MAS

La existencia **no se edita a mano**. Productos, almacenes y ubicaciones viven en Postgres; entradas (`EM-`), salidas (`SAL-`) y traspasos (`TR-`) pasan por `apply_stock_movement` / `transfer_stock` y dejan kardex inmutable.

La recepción de pedidos puede ser **parcial**. Entradas y salidas piden almacén, ubicación, lote/caducidad/serie cuando el producto lo exige. Los roles (`administrador`, `almacén`, `compras`, `ventas`, `servicio`, `dirección`) filtran el menú y bloquean escritura.

Migración: `supabase/migrations/20260916000000_inventory_core_structure.sql` (aditiva; no borra `inventory_items` ni datos).


| Script | Qué hace |
| --- | --- |
| `npm run dev` | Next.js en el puerto 43145 |
| `npm run db:local` | Crea la base `mas`, aplica `supabase/migrations` y `seed.sql` |
| `npm run dev:api` | Gateway compatible con el cliente Supabase (`/rest/v1`) |
| `npm run db:push` | Empuja migraciones al proyecto linkeado |
| `npm run db:seed` | Seed en el proyecto linkeado |
