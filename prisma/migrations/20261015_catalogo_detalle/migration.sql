-- T-19c: ficha del producto. Galería (product_images), ingredientes (ingredients + product_ingredients),
-- información nutricional opcional en products y personas por tamaño (product_sizes.servings).
-- Generado con prisma migrate diff y adaptado para poder re-ejecutarlo (IF NOT EXISTS; las FK se crean
-- solo si no existen). Aplicar a mano DESPUÉS de 20261015_catalogo_flags (el repo no tiene historial de migraciones):
--   npx prisma db execute --file prisma/migrations/20261015_catalogo_flags/migration.sql --schema prisma/schema.prisma
--   npx prisma db execute --file prisma/migrations/20261015_catalogo_detalle/migration.sql --schema prisma/schema.prisma
BEGIN;

-- AlterTable: nutrición opcional (gramos salvo energía, calorías, colesterol y sodio)
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "energy_kj" INTEGER,
ADD COLUMN IF NOT EXISTS "calories" INTEGER,
ADD COLUMN IF NOT EXISTS "fat" DECIMAL(6,1),
ADD COLUMN IF NOT EXISTS "saturated_fat" DECIMAL(6,1),
ADD COLUMN IF NOT EXISTS "carbohydrates" DECIMAL(6,1),
ADD COLUMN IF NOT EXISTS "sugar" DECIMAL(6,1),
ADD COLUMN IF NOT EXISTS "fiber" DECIMAL(6,1),
ADD COLUMN IF NOT EXISTS "cholesterol_mg" INTEGER,
ADD COLUMN IF NOT EXISTS "sodium_mg" INTEGER;

-- AlterTable: personas por tamaño
ALTER TABLE "product_sizes" ADD COLUMN IF NOT EXISTS "servings" INTEGER;

-- CreateTable
CREATE TABLE IF NOT EXISTS "product_images" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "product_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ingredients" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "name_es" TEXT NOT NULL,
    "name_en" TEXT,
    "image" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "product_ingredients" (
    "product_id" TEXT NOT NULL,
    "ingredient_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_ingredients_pkey" PRIMARY KEY ("product_id","ingredient_id")
);

-- Defaults en BD para cargar a mano con INSERT hasta T-21 (reflejados en el schema con dbgenerated / @default(now())).
-- Repetidos aquí por si las tablas ya existían de una ejecución anterior de este archivo.
ALTER TABLE "product_images" ALTER COLUMN "id" SET DEFAULT (gen_random_uuid())::text;
ALTER TABLE "ingredients" ALTER COLUMN "id" SET DEFAULT (gen_random_uuid())::text;
ALTER TABLE "ingredients" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "product_images_product_id_idx" ON "product_images"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ingredients_name_es_key" ON "ingredients"("name_es");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "product_ingredients_ingredient_id_idx" ON "product_ingredients"("ingredient_id");

-- AddForeignKey (Postgres no admite ADD CONSTRAINT IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_images_product_id_fkey' AND conrelid = '"product_images"'::regclass) THEN
    ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_ingredients_product_id_fkey' AND conrelid = '"product_ingredients"'::regclass) THEN
    ALTER TABLE "product_ingredients" ADD CONSTRAINT "product_ingredients_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_ingredients_ingredient_id_fkey' AND conrelid = '"product_ingredients"'::regclass) THEN
    ALTER TABLE "product_ingredients" ADD CONSTRAINT "product_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;

-- Carga a mano hasta T-21 (ejemplo):
--   INSERT INTO "ingredients" ("name_es", "name_en", "image") VALUES ('Cebolla', 'Onion', NULL) ON CONFLICT ("name_es") DO NOTHING;
--   INSERT INTO "product_ingredients" ("product_id", "ingredient_id", "sort_order")
--     SELECT '<product_id>', "id", 0 FROM "ingredients" WHERE "name_es" = 'Cebolla' ON CONFLICT DO NOTHING;
--   INSERT INTO "product_images" ("product_id", "url", "sort_order") VALUES ('<product_id>', 'https://…/galeria-1.png', 1);
--   UPDATE "products" SET "calories" = 750, "fat" = 31.5 WHERE "id" = '<product_id>';
--   UPDATE "product_sizes" SET "servings" = 8 WHERE "id" = '<size_id>';
