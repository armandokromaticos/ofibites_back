-- Cupón aplicado al carrito (POST/DELETE /cart/coupon). Nulo = sin cupón.
-- Si el cupón se borra, el carrito se queda sin cupón (ON DELETE SET NULL).
-- El checkout lo revalida, lo consume (coupon_usages) y lo limpia al vaciar el carrito.
-- Aditiva y re-ejecutable (IF NOT EXISTS; la FK dentro de un bloque DO). Aplicar a mano en Supabase (el repo no tiene historial de migraciones):
--   npx prisma db execute --file prisma/migrations/20261104_carrito_cupon/migration.sql --schema prisma/schema.prisma
-- Después, comprobar en information_schema.columns que existe carts.coupon_id.
BEGIN;

-- AlterTable
ALTER TABLE "carts" ADD COLUMN IF NOT EXISTS "coupon_id" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "carts_coupon_id_idx" ON "carts"("coupon_id");

-- AddForeignKey (Postgres no admite ADD CONSTRAINT IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'carts_coupon_id_fkey' AND conrelid = '"carts"'::regclass) THEN
    ALTER TABLE "carts" ADD CONSTRAINT "carts_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

COMMIT;
