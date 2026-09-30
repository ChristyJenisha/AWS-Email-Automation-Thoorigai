-- CreateEnum
CREATE TYPE "batch_status" AS ENUM ('IN_PROGRESS', 'READY_FOR_PAYMENT', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "bill_status" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'DISPUTED');

-- CreateEnum
CREATE TYPE "step_status" AS ENUM ('PENDING', 'ALERTED', 'COMPLETED', 'RETURNED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "deduction_type" AS ENUM ('TDS', 'RETENTION', 'PENALTY', 'OTHER');

-- CreateEnum
CREATE TYPE "notification_status" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_templates" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_stages" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "stage_order" INTEGER NOT NULL,
    "contact_id" TEXT NOT NULL,
    "reminder_interval_hours" INTEGER NOT NULL DEFAULT 24,
    "max_reminders" INTEGER NOT NULL DEFAULT 3,
    "backup_contact_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "status" "batch_status" NOT NULL DEFAULT 'IN_PROGRESS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bills" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "bill_number" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "balance_due" DECIMAL(14,2) NOT NULL,
    "status" "bill_status" NOT NULL DEFAULT 'PENDING',
    "due_date" DATE,
    "file_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_instances" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "stage_id" TEXT NOT NULL,
    "status" "step_status" NOT NULL DEFAULT 'PENDING',
    "alerted_at" TIMESTAMP(3),
    "next_reminder_at" TIMESTAMP(3),
    "reminder_count" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),
    "last_comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "step_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "proof_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "deduction_type" "deduction_type",
    "deduction_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "detail" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "step_instance_id" TEXT,
    "recipient" TEXT NOT NULL,
    "status" "notification_status" NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contacts_org_id_idx" ON "contacts"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_org_id_email_key" ON "contacts"("org_id", "email");

-- CreateIndex
CREATE INDEX "workflow_templates_org_id_idx" ON "workflow_templates"("org_id");

-- CreateIndex
CREATE INDEX "workflow_stages_contact_id_idx" ON "workflow_stages"("contact_id");

-- CreateIndex
CREATE INDEX "workflow_stages_backup_contact_id_idx" ON "workflow_stages"("backup_contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_stages_template_id_stage_order_key" ON "workflow_stages"("template_id", "stage_order");

-- CreateIndex
CREATE INDEX "batches_org_id_idx" ON "batches"("org_id");

-- CreateIndex
CREATE INDEX "batches_template_id_idx" ON "batches"("template_id");

-- CreateIndex
CREATE INDEX "batches_status_idx" ON "batches"("status");

-- CreateIndex
CREATE INDEX "bills_batch_id_idx" ON "bills"("batch_id");

-- CreateIndex
CREATE INDEX "bills_status_idx" ON "bills"("status");

-- CreateIndex
CREATE UNIQUE INDEX "bills_batch_id_bill_number_key" ON "bills"("batch_id", "bill_number");

-- CreateIndex
CREATE INDEX "step_instances_batch_id_idx" ON "step_instances"("batch_id");

-- CreateIndex
CREATE INDEX "step_instances_status_next_reminder_at_idx" ON "step_instances"("status", "next_reminder_at");

-- CreateIndex
CREATE UNIQUE INDEX "step_instances_batch_id_stage_id_key" ON "step_instances"("batch_id", "stage_id");

-- CreateIndex
CREATE INDEX "payments_batch_id_idx" ON "payments"("batch_id");

-- CreateIndex
CREATE INDEX "payments_paid_at_idx" ON "payments"("paid_at");

-- CreateIndex
CREATE INDEX "payment_allocations_bill_id_idx" ON "payment_allocations"("bill_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocations_payment_id_bill_id_key" ON "payment_allocations"("payment_id", "bill_id");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_created_at_idx" ON "audit_log"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_batch_id_created_at_idx" ON "notifications"("batch_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_step_instance_id_idx" ON "notifications"("step_instance_id");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_templates" ADD CONSTRAINT "workflow_templates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_stages" ADD CONSTRAINT "workflow_stages_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "workflow_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_stages" ADD CONSTRAINT "workflow_stages_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_stages" ADD CONSTRAINT "workflow_stages_backup_contact_id_fkey" FOREIGN KEY ("backup_contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "workflow_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_instances" ADD CONSTRAINT "step_instances_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_instances" ADD CONSTRAINT "step_instances_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "workflow_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_step_instance_id_fkey" FOREIGN KEY ("step_instance_id") REFERENCES "step_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;
