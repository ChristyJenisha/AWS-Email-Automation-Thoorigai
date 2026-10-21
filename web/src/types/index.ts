export type BillStatus = "Overdue" | "Due soon" | "Open" | "Partially paid" | "Disputed" | "Paid";

export type BillFilter = "All bills" | "Overdue" | "Due soon" | "Partially paid" | "Disputed" | "Paid";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
};

export type ContactRecord = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
};

export type WorkflowStage = {
  id?: string;
  order: number;
  reminderIntervalHours?: number;
  maxReminders?: number;
  contact?: { id?: string; name?: string; email?: string; role?: string };
  backupContact?: { id?: string; name?: string; email?: string; role?: string };
};

export type WorkflowRecord = {
  id: string;
  name: string;
  organizationId?: string;
  stages: WorkflowStage[];
  _count?: { batches: number };
};

export type BillRecord = {
  id?: string;
  billNumber?: string;
  amount?: number | string;
  balanceDue?: number | string;
  dueDate?: string | null;
  status?: string;
};

export type StepInstanceRecord = {
  id: string;
  status?: string;
  lastComment?: string | null;
  alertedAt?: string | null;
  nextReminderAt?: string | null;
  reminderCount?: number;
  stage?: {
    id?: string;
    order?: number;
    contact?: { id?: string; name?: string; email?: string; role?: string };
    backupContact?: { id?: string; name?: string; email?: string; role?: string };
  };
};

export type BatchRecord = {
  id: string;
  status?: string;
  bills?: BillRecord[];
  stepInstances?: StepInstanceRecord[];
};

export type BatchNotification = {
  id: string;
  recipient: string;
  status: string;
  sentAt?: string | null;
  error?: string | null;
  createdAt: string;
};

export type BatchAuditLog = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actor: string;
  detail?: Record<string, unknown> | string | number | boolean | null;
  createdAt: string;
};

export type BatchHistoryRecord = BatchRecord & {
  template?: { id: string; name: string };
  organization?: { id: string; name: string };
  createdAt?: string;
  notifications?: BatchNotification[];
  auditLogs?: BatchAuditLog[];
};

export type Bill = {
  id: number | string;
  batchId?: string;
  stageInfo?: string;
  currentApprover?: string;
  batchStatus?: string;
  customer: string;
  invoice: string;
  amount: number;
  balanceDue: number;
  due: string;
  dueDate?: string | null;
  status: BillStatus;
  isDemo: boolean;
};

export type BatchBillDraft = {
  billNumber: string;
  amount: string;
  dueDate: string;
};

export type PaymentLineDraft = {
  billId: string;
  billNumber: string;
  balanceDue: number;
  amount: string;
  deductionAmount: string;
  deductionType: string;
};

export type PaymentRecord = {
  id: string;
  amount: number | string;
  unallocatedAmount: number | string;
  reference?: string | null;
  paidAt?: string;
  proofKey?: string | null;
};

