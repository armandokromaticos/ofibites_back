-- T-35: el carrito pasa a ser por usuario dentro de la empresa (revierte el
-- carrito compartido por empresa de T-22b/T-23). carts gana user_id (NOT NULL,
-- FK a users con ON DELETE CASCADE) y la unicidad pasa de company_id a
-- (company_id, user_id).
--
-- Carritos existentes (antes uno por empresa): NO se borran a ciegas. Cada
-- línea guarda quién la añadió (cart_items.added_by_id), así que se reparten:
--   1. El carrito existente pasa a ser del autor de su línea más reciente
--      (conserva su id y su cupón: quien tocó el carrito por última vez es
--      quien con más probabilidad aplicó el cupón).
--   2. Las líneas de otros autores se mueven a un carrito nuevo de cada autor
--      en la misma empresa (sin cupón).
--   3. Las líneas sin autor (added_by_id nulo: usuario borrado) se quedan en el
--      carrito del dueño del paso 1.
--   4. Los carritos que se quedan sin dueño (vacíos o solo con líneas sin
--      autor) se borran con sus líneas: son transitorios y el usuario lo
--      recrea solo al abrir /cart.
--
-- Generado con prisma migrate diff y adaptado para poder re-ejecutarlo (IF NOT
-- EXISTS; la FK dentro de un bloque DO). El repo no tiene historial de
-- migraciones: aplicar a mano en Supabase (sin él, toda lectura del carrito
-- da P2022):
--   npx prisma db execute --file prisma/migrations/20261110_carrito_por_usuario/migration.sql --schema prisma/schema.prisma
-- Después, comprobar en information_schema.columns que existe carts.user_id
-- con is_nullable = 'NO'.
-- RLS: la tabla carts ya existía; no se crean tablas nuevas, no cambia.
BEGIN;

-- AlterTable (nullable mientras se rellena)
ALTER TABLE "carts" ADD COLUMN IF NOT EXISTS "user_id" TEXT;

-- DropIndex: la unicidad por empresa impediría crear los carritos de cada autor.
DROP INDEX IF EXISTS "carts_company_id_key";

-- 1. Dueño = autor de la línea más reciente.
UPDATE "carts" c
SET "user_id" = sub."added_by_id"
FROM (
  SELECT DISTINCT ON (ci."cart_id") ci."cart_id", ci."added_by_id"
  FROM "cart_items" ci
  WHERE ci."added_by_id" IS NOT NULL
  ORDER BY ci."cart_id", ci."created_at" DESC, ci."id" DESC
) sub
WHERE c."id" = sub."cart_id" AND c."user_id" IS NULL;

-- 2. Las líneas de otros autores, a un carrito propio de cada uno.
DO $$
DECLARE
  grupo RECORD;
  destino TEXT;
BEGIN
  FOR grupo IN
    SELECT DISTINCT ci."cart_id", c."company_id", ci."added_by_id"
    FROM "cart_items" ci
    JOIN "carts" c ON c."id" = ci."cart_id"
    WHERE ci."added_by_id" IS NOT NULL
      AND c."user_id" IS NOT NULL
      AND ci."added_by_id" <> c."user_id"
  LOOP
    SELECT "id" INTO destino
    FROM "carts"
    WHERE "company_id" = grupo."company_id" AND "user_id" = grupo."added_by_id"
    LIMIT 1;

    IF destino IS NULL THEN
      destino := gen_random_uuid()::text;
      INSERT INTO "carts" ("id", "company_id", "user_id", "created_at", "updated_at")
      VALUES (destino, grupo."company_id", grupo."added_by_id", NOW(), NOW());
    END IF;

    UPDATE "cart_items"
    SET "cart_id" = destino, "updated_at" = NOW()
    WHERE "cart_id" = grupo."cart_id" AND "added_by_id" = grupo."added_by_id";
  END LOOP;
END
$$;

-- 4. Carritos sin dueño: se borran (cart_items cae en cascada).
DELETE FROM "carts" WHERE "user_id" IS NULL;

ALTER TABLE "carts" ALTER COLUMN "user_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "carts_user_id_idx" ON "carts"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "carts_company_id_user_id_key" ON "carts"("company_id", "user_id");

-- AddForeignKey (Postgres no admite ADD CONSTRAINT IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'carts_user_id_fkey' AND conrelid = '"carts"'::regclass) THEN
    ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

COMMIT;
