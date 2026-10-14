-- T-11: necesidades del cliente en la solicitud de ingreso.
-- Aplicar a mano: npx prisma db execute --file prisma/migrations/20261014_solicitud_necesidades/migration.sql --schema prisma/schema.prisma
BEGIN;

-- CreateEnum
CREATE TYPE "RegistrationSolution" AS ENUM ('COFFEE_BREAK', 'WORKING_LUNCH', 'SNACKS', 'DESSERTS', 'BEVERAGES');

-- CreateEnum
CREATE TYPE "OrderFrequency" AS ENUM ('DAILY', 'SEVERAL_TIMES_A_WEEK', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'OCCASIONAL');

-- CreateEnum
CREATE TYPE "PeoplePerOrderRange" AS ENUM ('FROM_1_TO_10', 'FROM_11_TO_25', 'FROM_26_TO_50', 'FROM_51_TO_100', 'MORE_THAN_100');

-- AlterTable
ALTER TABLE "company_registration_requests" ADD COLUMN     "additional_comments" TEXT,
ADD COLUMN     "general_need" TEXT,
ADD COLUMN     "interested_solutions" "RegistrationSolution"[] DEFAULT ARRAY[]::"RegistrationSolution"[],
ADD COLUMN     "order_frequency" "OrderFrequency",
ADD COLUMN     "people_per_order" "PeoplePerOrderRange";


COMMIT;
