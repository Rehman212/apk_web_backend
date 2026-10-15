-- AlterTable
ALTER TABLE "Apk" ADD COLUMN "homeSection" TEXT NOT NULL DEFAULT 'latest-updates';

-- CreateIndex
CREATE INDEX "Apk_homeSection_idx" ON "Apk"("homeSection");
