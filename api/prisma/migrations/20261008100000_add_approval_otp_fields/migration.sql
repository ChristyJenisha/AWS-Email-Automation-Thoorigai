ALTER TABLE "step_instances"
ADD COLUMN "approval_otp_hash" TEXT,
ADD COLUMN "approval_otp_expires_at" TIMESTAMP(3),
ADD COLUMN "approval_otp_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "approval_otp_requested_at" TIMESTAMP(3);
