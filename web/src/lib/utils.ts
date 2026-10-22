import { Bill, BillFilter, BillStatus, BatchRecord, BatchBillDraft } from "../types";

export const emptyBatchBill = (): BatchBillDraft => ({
  billNumber: "",
  amount: "",
  dueDate: "",
});

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

export const formatExactCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

export const getAgingStatus = (
  dueDate?: string | null,
  balanceDue = 0,
  fallback?: BillStatus
): BillStatus | null => {
  if (balanceDue <= 0) return null;
  if (!dueDate) return fallback === "Overdue" || fallback === "Due soon" ? fallback : "Open";

  const dateOnly = dueDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return fallback === "Overdue" || fallback === "Due soon" ? fallback : "Open";
  }
  const now = new Date();
  const todayOnly = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const daysUntilDue = Math.round(
    (Date.parse(`${dateOnly}T00:00:00Z`) - Date.parse(`${todayOnly}T00:00:00Z`)) / 86400000
  );
  if (daysUntilDue < 0) return "Overdue";
  if (daysUntilDue <= 7) return "Due soon";
  return "Open";
};

export const toBillStatus = (
  status?: string,
  dueDate?: string | null,
  balanceDue = 0
): BillStatus => {
  if (status === "PAID" || balanceDue <= 0) return "Paid";
  if (status === "DISPUTED") return "Disputed";
  if (status === "PARTIALLY_PAID") return "Partially paid";
  return getAgingStatus(dueDate, balanceDue) ?? "Paid";
};

export const toDisplayBills = (batchData: BatchRecord[] | undefined): Bill[] => {
  if (!Array.isArray(batchData) || batchData.length === 0) {
    return [];
  }

  return batchData.flatMap((batch) => {
    const alertedStep = batch.stepInstances?.find((s) => s.status === "ALERTED");
    const currentApprover = alertedStep?.stage?.contact?.name;
    const isReadyForPayment = batch.status === "READY_FOR_PAYMENT";
    const stageInfo = isReadyForPayment
      ? "Ready for Payment"
      : alertedStep
      ? `Stage ${alertedStep.stage?.order ?? 1}: ${currentApprover ?? "Approver"}`
      : batch.status === "COMPLETED"
      ? "Completed"
      : "In Progress";

    return (batch.bills ?? []).map((bill, index) => {
      const amount = Number(bill.amount ?? bill.balanceDue ?? 0);
      const balanceDue = Number(bill.balanceDue ?? bill.amount ?? 0);
      const invoice = bill.billNumber ?? `INV-${String(index + 1).padStart(4, "0")}`;
      const dueDate = bill.dueDate ? new Date(bill.dueDate) : null;
      const dueText = dueDate
        ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(dueDate)
        : "TBD";

      return {
        id: bill.id ?? `${batch.id}-${invoice}`,
        batchId: batch.id,
        stageInfo,
        currentApprover,
        batchStatus: batch.status,
        customer:
          batch.stepInstances?.[0]?.stage?.contact?.name ??
          (batch.id ? "Demo Organization" : "Customer"),
        invoice,
        amount: Number.isFinite(amount) ? amount : 0,
        balanceDue: Number.isFinite(balanceDue) ? balanceDue : 0,
        due: dueText,
        dueDate: bill.dueDate ?? null,
        status: toBillStatus(bill.status, bill.dueDate ?? null, balanceDue),
        isDemo: false,
      };
    });
  });
};

export const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

export const avatarSeed = (value: number | string) =>
  Number(
    String(value)
      .split("")
      .reduce((sum, char) => sum + char.charCodeAt(0), 0)
  ) % 4;

export const matchesBillFilter = (bill: Bill, option: BillFilter): boolean => {
  if (option === "All bills") return true;
  if (option === "Overdue" || option === "Due soon") {
    return getAgingStatus(bill.dueDate, bill.balanceDue, bill.status) === option;
  }
  return bill.status === option;
};

export const isValidConfirmNote = (note: string | null | undefined): boolean => {
  if (typeof note !== "string") return false;
  return note.trim().length >= 10;
};

export const compareActiveBatchesUrgency = (a: BatchRecord, b: BatchRecord): number => {
  const stepA = a.stepInstances?.find((s) => s.status === "ALERTED" || s.status === "ESCALATED");
  const stepB = b.stepInstances?.find((s) => s.status === "ALERTED" || s.status === "ESCALATED");

  // 1. Escalated takes top priority
  const isEscalatedA = stepA?.status === "ESCALATED" ? 1 : 0;
  const isEscalatedB = stepB?.status === "ESCALATED" ? 1 : 0;
  if (isEscalatedB !== isEscalatedA) return isEscalatedB - isEscalatedA;

  // 2. Time in stage descending (oldest alertedAt first)
  const timeA = stepA?.alertedAt ? new Date(stepA.alertedAt).getTime() : 0;
  const timeB = stepB?.alertedAt ? new Date(stepB.alertedAt).getTime() : 0;
  if (timeA && timeB && timeA !== timeB) return timeA - timeB;

  // 3. Reminder count descending (tiebreaker)
  const remindersA = stepA?.reminderCount ?? 0;
  const remindersB = stepB?.reminderCount ?? 0;
  return remindersB - remindersA;
};

export const isApproverRoute = (pathname: string | null | undefined): boolean => {
  if (!pathname) return false;
  return pathname.startsWith("/approve");
};

export interface BatchFilterOptions {
  status?: string | null;
  approver?: string | null;
  search?: string | null;
}

export const filterBatches = (batches: BatchRecord[], options: BatchFilterOptions): BatchRecord[] => {
  const { status, approver, search } = options;
  const normalizedStatus = status && status !== "ALL" ? status.toUpperCase() : null;
  const normalizedSearch = search?.trim().toLowerCase() || null;

  return batches.filter((b) => {
    if (normalizedStatus && b.status !== normalizedStatus) {
      return false;
    }
    if (approver) {
      const activeStep = b.stepInstances?.find((s) => s.status === "ALERTED" || s.status === "ESCALATED");
      const contactId = activeStep?.stage?.contact?.id;
      if (contactId !== approver) {
        return false;
      }
    }
    if (normalizedSearch) {
      const matchesId = b.id.toLowerCase().includes(normalizedSearch);
      const matchesBills = (b.bills ?? []).some((bill) => bill.billNumber?.toLowerCase().includes(normalizedSearch));
      if (!matchesId && !matchesBills) {
        return false;
      }
    }
    return true;
  });
};

export const sortBatches = (
  batches: BatchRecord[],
  field: "date" | "amount" | "bills" | "status" | "id",
  order: "asc" | "desc" = "desc"
): BatchRecord[] => {
  const list = [...batches];
  list.sort((a, b) => {
    let comparison = 0;
    if (field === "date") {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      comparison = timeA - timeB;
    } else if (field === "amount") {
      const amountA = (a.bills ?? []).reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
      const amountB = (b.bills ?? []).reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
      comparison = amountA - amountB;
    } else if (field === "bills") {
      comparison = (a.bills ?? []).length - (b.bills ?? []).length;
    } else if (field === "status") {
      comparison = (a.status || "").localeCompare(b.status || "");
    } else if (field === "id") {
      comparison = a.id.localeCompare(b.id);
    }
    return order === "asc" ? comparison : -comparison;
  });
  return list;
};

