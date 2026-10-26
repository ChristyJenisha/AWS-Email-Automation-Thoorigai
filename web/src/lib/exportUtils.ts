import { BatchRecord } from "../types";
import { formatBatchId } from "./utils";

/**
 * Exports an array of Batch records to a CSV file and triggers a browser download.
 */
export function exportBatchesToCSV(batches: BatchRecord[], filenamePrefix = "collectflow_batches") {
  if (!batches || batches.length === 0) {
    alert("No batches available to export.");
    return;
  }

  const headers = [
    "Batch ID",
    "Batch Identifier",
    "Status",
    "Total Bills",
    "Total Amount (INR)",
    "Workflow Template",
    "Current Stage",
    "Current Approver",
    "Created At",
  ];

  const escapeCSV = (value: unknown): string => {
    if (value === null || value === undefined) return '""';
    const str = String(value).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = batches.map((batch) => {
    const activeStep = batch.stepInstances?.find(
      (s) => s.status === "ALERTED" || s.status === "ESCALATED"
    );
    const approverName = activeStep?.stage?.contact?.name ?? "N/A";
    const stageOrder = activeStep?.stage?.order ? `Stage ${activeStep.stage.order}` : "Completed / Waiting";
    const billsCount = batch.bills?.length ?? 0;
    const totalAmount = (batch.bills ?? []).reduce(
      (sum, bill) => sum + Number(bill.amount || 0),
      0
    );
    const formattedBatchName = `Batch ${formatBatchId(batch.id)}`;
    const formattedCreatedAt = batch.createdAt
      ? new Date(batch.createdAt).toLocaleString()
      : "N/A";

    return [
      escapeCSV(batch.id),
      escapeCSV(formattedBatchName),
      escapeCSV(batch.status ?? "N/A"),
      billsCount,
      totalAmount,
      escapeCSV(batch.template?.name || "Standard Workflow"),
      escapeCSV(stageOrder),
      escapeCSV(approverName),
      escapeCSV(formattedCreatedAt),
    ].join(",");
  });

  const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  
  const timestamp = new Date().toISOString().slice(0, 10);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filenamePrefix}_${timestamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

