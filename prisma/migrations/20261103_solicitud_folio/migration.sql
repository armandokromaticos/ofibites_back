-- Folio legible de las solicitudes de ingreso (SOL-AAAA-NNNN). Columna correlativa
-- `request_number` con secuencia propia; el año del folio lo calcula el back desde
-- `created_at` en hora de Caracas, así que solo se persiste el número.
-- Las solicitudes existentes se numeran por `created_at` ascendente (desempate por id).
-- Re-ejecutable: no renumera filas que ya tengan número.
-- Aplicar a mano (el repo no tiene historial de migraciones):
--   npx prisma db execute --file prisma/migrations/20261103_solicitud_folio/migration.sql --schema prisma/schema.prisma
-- Después, comprobar en information_schema.columns que existe `request_number`.
BEGIN;

-- 1. Columna, de momento nullable y sin default.
ALTER TABLE "company_registration_requests" ADD COLUMN IF NOT EXISTS "request_number" INTEGER;

-- 2. Secuencia propia, ligada a la columna (mismo nombre que generaría Prisma para autoincrement()).
CREATE SEQUENCE IF NOT EXISTS "company_registration_requests_request_number_seq"
  AS INTEGER
  OWNED BY "company_registration_requests"."request_number";

-- 3. Backfill explícito y ordenado por created_at ascendente.
WITH "base" AS (
  SELECT COALESCE(MAX("request_number"), 0) AS "max_actual"
  FROM "company_registration_requests"
),
"ordenadas" AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "created_at" ASC, "id" ASC) AS "n"
  FROM "company_registration_requests"
  WHERE "request_number" IS NULL
)
UPDATE "company_registration_requests" AS r
SET "request_number" = "base"."max_actual" + "ordenadas"."n"
FROM "ordenadas", "base"
WHERE r."id" = "ordenadas"."id";

-- 4. La secuencia continúa tras el mayor número asignado (1 si la tabla está vacía).
SELECT setval(
  '"company_registration_requests_request_number_seq"',
  COALESCE((SELECT MAX("request_number") FROM "company_registration_requests"), 0) + 1,
  false
);

-- 5. Default, NOT NULL y UNIQUE.
ALTER TABLE "company_registration_requests"
  ALTER COLUMN "request_number" SET DEFAULT nextval('"company_registration_requests_request_number_seq"');
ALTER TABLE "company_registration_requests" ALTER COLUMN "request_number" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "company_registration_requests_request_number_key"
  ON "company_registration_requests"("request_number");

COMMIT;
