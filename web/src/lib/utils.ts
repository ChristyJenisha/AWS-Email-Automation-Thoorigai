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

