-- T-06: facturas y pagos del cliente. Factura automática al confirmar el pedido
-- (invoices), pagos manuales con comprobante (invoice_payments), contador del
-- número proforma F-AAAA-NNNN (invoice_number_counters), cupo de crédito de la
-- empresa (companies.credit_limit) y notificaciones de factura/pago.
-- Generado con prisma migrate diff y adaptado para poder re-ejecutarlo (IF NOT
-- EXISTS; enums, FK e índice parcial solo si no existen). El repo no tiene
-- historial de migraciones: aplicar a mano.
--   npx prisma db execute --file prisma/migrations/20261104_facturas_pagos/migration.sql --schema prisma/schema.prisma
-- Después: crear en Supabase Storage los buckets PRIVADOS `invoices` y
-- `payment-proofs` y, si se quiere, correr el backfill
-- (`yarn ts-node scripts/backfill-invoices.ts --dry-run` primero).

-- Valores nuevos del enum de notificaciones. Van fuera de la transacción: un
-- valor añadido con ADD VALUE no se puede usar en la misma transacción.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'INVOICE_GENERATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PAYMENT_STATUS_CHANGED';

BEGIN;

-- CreateEnum (Postgres no admite CREATE TYPE IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvoiceStatus' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'PAID', 'VOID');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvoicePaymentRecordStatus' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE "InvoicePaymentRecordStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentMethod' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE "PaymentMethod" AS ENUM ('MOBILE_PAYMENT', 'TRANSFER_VES', 'TRANSFER_USD', 'ZELLE');
  END IF;
END
$$;

-- AlterTable
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "credit_limit" DECIMAL(10,2);
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "invoice_id" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "invoices" (
    "id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" DATE NOT NULL,
    "credit_days" INTEGER NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL,
    "tax" DECIMAL(10,2) NOT NULL,
    "shipping" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "amount_paid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "paid_at" TIMESTAMP(3),
    "voided_at" TIMESTAMP(3),
    "billing_name" TEXT NOT NULL,
    "billing_tax_id" TEXT NOT NULL,
    "billing_address" TEXT,
    "fiscal_pdf_path" TEXT,
    "fiscal_number" TEXT,
    "fiscal_pdf_uploaded_at" TIMESTAMP(3),
    "fiscal_pdf_uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "invoice_payments" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "status" "InvoicePaymentRecordStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "method" "PaymentMethod" NOT NULL,
    "bank" TEXT,
    "reference" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "payment_date" DATE NOT NULL,
    "proof_path" TEXT NOT NULL,
    "proof_file_name" TEXT NOT NULL,
    "proof_mime_type" TEXT NOT NULL,
    "proof_size_bytes" INTEGER NOT NULL,
    "submitted_by_id" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "withdrawn_at" TIMESTAMP(3),

    CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "invoice_number_counters" (
    "year" INTEGER NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_number_counters_pkey" PRIMARY KEY ("year")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_invoice_number_key" ON "invoices"("invoice_number");
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_order_id_key" ON "invoices"("order_id");
CREATE INDEX IF NOT EXISTS "invoices_company_id_status_due_date_idx" ON "invoices"("company_id", "status", "due_date");
CREATE INDEX IF NOT EXISTS "invoices_fiscal_pdf_uploaded_by_id_idx" ON "invoices"("fiscal_pdf_uploaded_by_id");
CREATE INDEX IF NOT EXISTS "invoice_payments_invoice_id_submitted_at_idx" ON "invoice_payments"("invoice_id", "submitted_at");
CREATE INDEX IF NOT EXISTS "invoice_payments_status_submitted_at_idx" ON "invoice_payments"("status", "submitted_at");
CREATE INDEX IF NOT EXISTS "invoice_payments_submitted_by_id_idx" ON "invoice_payments"("submitted_by_id");
CREATE INDEX IF NOT EXISTS "invoice_payments_reviewed_by_id_idx" ON "invoice_payments"("reviewed_by_id");
CREATE INDEX IF NOT EXISTS "notifications_invoice_id_idx" ON "notifications"("invoice_id");

-- Como mucho un comprobante en revisión por factura (Prisma no expresa índices
-- parciales; el código traduce su P2002 a 409 PAYMENT_ALREADY_PENDING).
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_payments_one_pending" ON "invoice_payments"("invoice_id") WHERE "status" = 'PENDING_REVIEW';

-- AddForeignKey (Postgres no admite ADD CONSTRAINT IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_invoice_id_fkey' AND conrelid = '"notifications"'::regclass) THEN
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_order_id_fkey' AND conrelid = '"invoices"'::regclass) THEN
    ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_company_id_fkey' AND conrelid = '"invoices"'::regclass) THEN
    ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_fiscal_pdf_uploaded_by_id_fkey' AND conrelid = '"invoices"'::regclass) THEN
    ALTER TABLE "invoices" ADD CONSTRAINT "invoices_fiscal_pdf_uploaded_by_id_fkey" FOREIGN KEY ("fiscal_pdf_uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_payments_invoice_id_fkey' AND conrelid = '"invoice_payments"'::regclass) THEN
    ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_payments_submitted_by_id_fkey' AND conrelid = '"invoice_payments"'::regclass) THEN
    ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_payments_reviewed_by_id_fkey' AND conrelid = '"invoice_payments"'::regclass) THEN
    ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

-- RLS sin políticas: cierra las tablas nuevas a la API pública de Supabase
-- (PostgREST con anon/authenticated), como las demás tablas del esquema.
-- No afecta al back: Prisma conecta con el rol `postgres` (DATABASE_URL y
-- DIRECT_URL), que es el dueño de las tablas y tiene BYPASSRLS (comprobado el
-- 2026-11-04: current_user = postgres, rolbypassrls = true, dueño de
-- `orders` = postgres, que ya tiene RLS activo). No se usa FORCE ROW LEVEL
-- SECURITY. Re-ejecutable: ENABLE sobre una tabla que ya lo tiene no falla.
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_number_counters" ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Comprobación tras aplicar (ver conocimiento/back/tech-rules/tooling.md):
--   SELECT table_name, column_name FROM information_schema.columns
--   WHERE (table_name = 'companies' AND column_name = 'credit_limit')
--      OR (table_name = 'notifications' AND column_name = 'invoice_id')
--      OR table_name IN ('invoices', 'invoice_payments', 'invoice_number_counters');
