-- CreateEnum
CREATE TYPE "CategorizationSource" AS ENUM ('MANUAL', 'RULES', 'AI');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "categorizationSource" "CategorizationSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "confidence" DOUBLE PRECISION;
