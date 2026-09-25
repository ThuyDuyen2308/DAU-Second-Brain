-- DropForeignKey
ALTER TABLE "imported_documents" DROP CONSTRAINT "imported_documents_uploadedById_fkey";

-- AddForeignKey
ALTER TABLE "imported_documents" ADD CONSTRAINT "imported_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
