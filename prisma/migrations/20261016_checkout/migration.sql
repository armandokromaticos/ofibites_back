-- T-26a: checkout fase 1. Columnas nuevas en "orders" (IVA, envío, receptor, piso/oficina,
-- referencia y número legible OF-AAAA-NNNN) + contador del número por año de Caracas.
-- Generado con prisma migrate diff y adaptado para poder re-ejecutarlo (IF NOT EXISTS, backfill
-- idempotente y el índice único creado después del backfill). El repo no tiene historial de
-- migraciones: aplicar a mano.
--   npx prisma db execute --file prisma/migrations/20261016_checkout/migration.sql --schema prisma/schema.prisma
BEGIN;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tax" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "order_number" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "receiver_name" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "receiver_phone" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "address_detail" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "address_reference" TEXT;

-- Defaults repetidos por si las columnas ya existían de una ejecución anterior.
ALTER TABLE "orders" ALTER COLUMN "tax" SET DEFAULT 0;
ALTER TABLE "orders" ALTER COLUMN "shipping" SET DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "order_number_counters" (
    "year" INTEGER NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "order_number_counters_pkey" PRIMARY KEY ("year")
);
ALTER TABLE "order_number_counters" ALTER COLUMN "last_value" SET DEFAULT 0;

-- Bloquea "orders" mientras se numera: un pedido creado en paralelo por el back viejo no puede
-- colarse sin número entre el backfill y el índice único.
LOCK TABLE "orders" IN SHARE ROW EXCLUSIVE MODE;

-- Backfill: los pedidos sin número reciben OF-AAAA-NNNN por orden de created_at (desempate por id),
-- con AAAA = año de created_at en hora de Caracas (UTC-4 fijo; created_at está en UTC). La
-- numeración de cada año continúa tras el mayor número ya asignado (por el contador o por pedidos
-- ya numerados), así que re-ejecutarlo no duplica ni renumera nada.
WITH existing AS (
  SELECT year, MAX(last_value) AS last_value
  FROM (
    SELECT "year", "last_value" FROM "order_number_counters"
    UNION ALL
    SELECT split_part("order_number", '-', 2)::int, split_part("order_number", '-', 3)::int
    FROM "orders"
    WHERE "order_number" ~ '^OF-[0-9]{4}-[0-9]+$'
  ) AS s
  GROUP BY year
),
pending AS (
  SELECT
    o."id",
    EXTRACT(YEAR FROM (o."created_at" - INTERVAL '4 hours'))::int AS year,
    ROW_NUMBER() OVER (
      PARTITION BY EXTRACT(YEAR FROM (o."created_at" - INTERVAL '4 hours'))
      ORDER BY o."created_at", o."id"
    ) AS rn
  FROM "orders" o
  WHERE o."order_number" IS NULL
)
UPDATE "orders" o
SET "order_number" = 'OF-' || p.year::text || '-' || lpad((COALESCE(e.last_value, 0) + p.rn)::text, 4, '0')
FROM pending p
LEFT JOIN existing e ON e.year = p.year
WHERE o."id" = p."id";

-- El contador queda en el mayor número de cada año (nunca baja).
INSERT INTO "order_number_counters" ("year", "last_value")
SELECT split_part("order_number", '-', 2)::int, MAX(split_part("order_number", '-', 3)::int)
FROM "orders"
WHERE "order_number" ~ '^OF-[0-9]{4}-[0-9]+$'
GROUP BY 1
ON CONFLICT ("year") DO UPDATE
SET "last_value" = GREATEST("order_number_counters"."last_value", EXCLUDED."last_value");

-- CreateIndex (después del backfill)
CREATE UNIQUE INDEX IF NOT EXISTS "orders_order_number_key" ON "orders"("order_number");

COMMIT;

-- Comprobación tras aplicarlo (debe devolver 0 y la última fila por año):
-- SELECT COUNT(*) FROM "orders" WHERE "order_number" IS NULL;
-- SELECT * FROM "order_number_counters" ORDER BY "year";
