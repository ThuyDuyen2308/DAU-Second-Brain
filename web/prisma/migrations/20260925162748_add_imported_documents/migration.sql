-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'PUBLISHED', 'DUPLICATE');

-- CreateTable
CREATE TABLE "imported_documents" (
    "id" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileFormat" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "extractedJson" JSONB,
    "editedMetadata" JSONB,
    "documentId" TEXT,
    "workerPid" INTEGER,
    "processingStartedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "imported_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "imported_documents_checksum_key" ON "imported_documents"("checksum");

-- CreateIndex
CREATE INDEX "imported_documents_uploadedById_idx" ON "imported_documents"("uploadedById");

-- CreateIndex
CREATE INDEX "imported_documents_status_idx" ON "imported_documents"("status");

-- CreateIndex
CREATE INDEX "imported_documents_checksum_idx" ON "imported_documents"("checksum");

-- AddForeignKey
ALTER TABLE "imported_documents" ADD CONSTRAINT "imported_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
