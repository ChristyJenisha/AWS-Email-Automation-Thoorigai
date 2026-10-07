ALTER TABLE "payments"
ADD COLUMN "unallocated_amount" DECIMAL(14,2) NOT NULL DEFAULT 0;