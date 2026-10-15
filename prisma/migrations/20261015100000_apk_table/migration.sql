-- CreateTable
CREATE TABLE "Apk" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "developer" TEXT NOT NULL DEFAULT 'Unknown',
    "packageName" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'app',
    "category" TEXT NOT NULL DEFAULT 'tools',
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "size" TEXT NOT NULL DEFAULT '—',
    "apkUrl" TEXT,
    "iconUrl" TEXT,
    "short" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "requires" TEXT NOT NULL DEFAULT 'Android 8.0+',
    "accent" TEXT NOT NULL DEFAULT '#2f7bff',
    "letter" TEXT NOT NULL DEFAULT 'A',
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Apk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Apk_slug_key" ON "Apk"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Apk_packageName_key" ON "Apk"("packageName");

-- CreateIndex
CREATE INDEX "Apk_kind_idx" ON "Apk"("kind");

-- CreateIndex
CREATE INDEX "Apk_category_idx" ON "Apk"("category");
