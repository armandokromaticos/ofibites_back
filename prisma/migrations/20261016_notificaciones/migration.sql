-- T-22a: notificaciones del usuario (campana de la top bar). Una fila por usuario; hoy solo
-- se generan al cambiar el estado de un pedido (type = ORDER_STATUS).
-- Generado con prisma migrate diff y adaptado para poder re-ejecutarlo (IF NOT EXISTS; el enum y
-- las FK se crean solo si no existen). El repo no tiene historial de migraciones: aplicar a mano.
--   npx prisma db execute --file prisma/migrations/20261016_notificaciones/migration.sql --schema prisma/schema.prisma
BEGIN;

-- CreateEnum (Postgres no admite CREATE TYPE IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationType' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE "NotificationType" AS ENUM ('ORDER_STATUS');
  END IF;
END
$$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "notifications" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT,
    "type" "NotificationType" NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "order_id" TEXT,
    "order_status" "OrderStatus",
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- Defaults en BD repetidos por si la tabla ya existía de una ejecución anterior de este archivo.
ALTER TABLE "notifications" ALTER COLUMN "id" SET DEFAULT (gen_random_uuid())::text;
ALTER TABLE "notifications" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");
CREATE INDEX IF NOT EXISTS "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "notifications_order_id_idx" ON "notifications"("order_id");
CREATE INDEX IF NOT EXISTS "notifications_company_id_idx" ON "notifications"("company_id");

-- AddForeignKey (Postgres no admite ADD CONSTRAINT IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_user_id_fkey' AND conrelid = '"notifications"'::regclass) THEN
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_company_id_fkey' AND conrelid = '"notifications"'::regclass) THEN
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_order_id_fkey' AND conrelid = '"notifications"'::regclass) THEN
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

COMMIT;

-- Ejemplo para probar la campana a mano (sustituir el user_id):
-- INSERT INTO "notifications" ("user_id", "type", "message")
-- VALUES ('<user-id>', 'ORDER_STATUS', 'Tu pedido #A1B2C3D4 va en camino.');
