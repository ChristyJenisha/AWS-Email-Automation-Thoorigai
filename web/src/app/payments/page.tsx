"use client";

import React, { useState, useEffect, useRef, FormEvent, useMemo } from "react";
import Link from "next/link";
import {
  CreditCard,
  Receipt,
  FileText,
  Upload,
  RefreshCw,
  ExternalLink,
  PlusCircle,
  CheckSquare,
  Trash2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Lock,
  Layers,
} from "lucide-react";
import { useDataContext } from "../../lib/DataContext";
import { BatchRecord, PaymentLineDraft, PaymentRecord, BillFilter } from "../../types";
import { formatExactCurrency, matchesBillFilter } from "../../lib/utils";
import { authFetch, getApiBase, fetchPaymentsForBatch } from "../../lib/api";
import { PaymentEntryModal } from "../../components/modals/PaymentEntryModal";
import { BillsTable } from "../../components/tables/BillsTable";

export default function PaymentsPage() {
  const {
    batches,
    bills,
    authToken,
    currentUser,
    refreshData,
    isLoading: isGlobalLoading,
  } = useDataContext();

  const isAdmin = currentUser?.role?.toLowerCase() === "admin";

  // Navigation & View Tabs
  const [activeTab, setActiveTab] = useState<"ready" | "history" | "bills">("ready");
  const [billFilter, setBillFilter] = useState<BillFilter>("All bills");
  const [billSearch, setBillSearch] = useState("");

  // Payment State
  const [paymentRecords, setPaymentRecords] = useState<Record<string, PaymentRecord[]>>({});
  const [proofLinks, setProofLinks] = useState<Record<string, string>>({});
  const [isUploadingProofFor, setIsUploadingProofFor] = useState<string | null>(null);
  const localProofUrls = useRef(new Set<string>());

  // Notice State
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // Payment Entry Modal State
  const [paymentEntryOpen, setPaymentEntryOpen] = useState(false);
  const [paymentBatch, setPaymentBatch] = useState<BatchRecord | null>(null);
  const [onAccountPaymentId, setOnAccountPaymentId] = useState<string | null>(null);
  const [isOnAccountEntry, setIsOnAccountEntry] = useState(false);
  const [onAccountAmount, setOnAccountAmount] = useState("");
  const [paymentLines, setPaymentLines] = useState<PaymentLineDraft[]>([]);
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentReference, setPaymentReference] = useState("");
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  // Batch Delete Confirmation
  const [deleteBatchId, setDeleteBatchId] = useState<string | null>(null);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      for (const url of localProofUrls.current) {
        URL.revokeObjectURL(url);
      }
      localProofUrls.current.clear();
    };
  }, []);

  // Fetch payment records for all batches
  const refreshPaymentRecords = async (batchList = batches, token = authToken) => {
    if (!token || batchList.length === 0) return;
    try {
      const entries = await Promise.all(
        batchList.map(async (b) => [b.id, await fetchPaymentsForBatch(b.id, token)] as const)
      );
      setPaymentRecords(Object.fromEntries(entries));
    } catch {
      // ignore transient payment fetch errors
    }
  };

  useEffect(() => {
    let isCancelled = false;
    if (authToken && batches.length > 0) {
      const load = async () => {
        try {
          const entries = await Promise.all(
            batches.map(async (b) => [b.id, await fetchPaymentsForBatch(b.id, authToken)] as const)
          );
          if (!isCancelled) {
            setPaymentRecords(Object.fromEntries(entries));
          }
        } catch {
          // ignore transient errors
        }
      };
      void load();
    }
    return () => {
      isCancelled = true;
    };
  }, [authToken, batches]);

  // Filtered Batches
  const readyBatches = useMemo(
    () => batches.filter((b) => b.status === "READY_FOR_PAYMENT"),
    [batches]
  );

  const batchesWithPayments = useMemo(
    () => batches.filter((b) => (paymentRecords[b.id]?.length ?? 0) > 0),
    [batches, paymentRecords]
  );

  // Total Calculations
  const readyTotalAmount = useMemo(
    () =>
      readyBatches.reduce(
        (sum, batch) =>
          sum +
          (batch.bills ?? []).reduce(
            (bSum, bill) => bSum + Number(bill.balanceDue ?? bill.amount ?? 0),
            0
          ),
        0
      ),
    [readyBatches]
  );

  const settledTotalAmount = useMemo(() => {
    let total = 0;
    for (const payments of Object.values(paymentRecords)) {
      for (const p of payments) {
        total += Number(p.amount || 0);
      }
    }
    return total;
  }, [paymentRecords]);

  const totalReceivables = useMemo(
    () => bills.reduce((sum, b) => sum + Number(b.balanceDue || 0), 0),
    [bills]
  );

  // Filtered Bills for the Bills Table
  const visibleBills = useMemo(() => {
    return bills.filter((b) => {
      const matchesFilter = matchesBillFilter(b, billFilter);
      const matchesSearch =
        !billSearch.trim() ||
        b.invoice.toLowerCase().includes(billSearch.toLowerCase()) ||
        b.customer.toLowerCase().includes(billSearch.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [bills, billFilter, billSearch]);

  // Modal Open Handlers
  function openPaymentEntry(batch: BatchRecord) {
    if (!isAdmin) {
      setNotice({ type: "error", message: "Administrator access is required to record payments." });
      return;
    }
    const bBills = batch.bills?.filter((bill): bill is typeof bill & { id: string } => Boolean(bill.id)) ?? [];
    if (bBills.length === 0) {
      setNotice({ type: "error", message: "This batch has no bills available for allocation." });
      return;
    }
    setPaymentBatch(batch);
    setOnAccountPaymentId(null);
    setIsOnAccountEntry(false);
    setOnAccountAmount("");
    setPaymentLines(
      bBills
        .filter((bill) => Number(bill.balanceDue ?? bill.amount ?? 0) > 0)
        .map((bill) => ({
          billId: bill.id,
          billNumber: bill.billNumber ?? bill.id,
          balanceDue: Number(bill.balanceDue ?? bill.amount ?? 0),
          amount: "",
          deductionAmount: "",
          deductionType: "",
        }))
    );
    setPaymentReference("");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentEntryOpen(true);
  }

  function openOnAccountEntry(batch: BatchRecord) {
    if (!isAdmin) {
      setNotice({ type: "error", message: "Administrator access is required to record payments on account." });
      return;
    }
    setPaymentBatch(batch);
    setOnAccountPaymentId(null);
    setIsOnAccountEntry(true);
    setOnAccountAmount("");
    setPaymentLines([]);
    setPaymentReference("");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentEntryOpen(true);
  }

  function openOnAccountAllocation(batch: BatchRecord, payment: PaymentRecord) {
    if (!isAdmin) {
      setNotice({ type: "error", message: "Administrator access is required to allocate funds." });
      return;
    }
    const bBills = batch.bills?.filter((bill): bill is typeof bill & { id: string } => Boolean(bill.id)) ?? [];
    setPaymentBatch(batch);
    setOnAccountPaymentId(payment.id);
    setIsOnAccountEntry(false);
    setOnAccountAmount("");
    setPaymentLines(
      bBills
        .filter((bill) => Number(bill.balanceDue ?? bill.amount ?? 0) > 0)
        .map((bill) => ({
          billId: bill.id,
          billNumber: bill.billNumber ?? bill.id,
          balanceDue: Number(bill.balanceDue ?? bill.amount ?? 0),
          amount: "",
          deductionAmount: "",
          deductionType: "",
        }))
    );
    setPaymentReference(payment.reference ?? "");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentEntryOpen(true);
  }

  // Submit Payment / Allocation
  async function handleCreatePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authToken || !currentUser || !paymentBatch) return;

    if (!isAdmin) {
      setNotice({ type: "error", message: "Administrator access is required to record payments." });
      return;
    }

    const allocations = paymentLines
      .map((line) => ({
        billId: line.billId,
        amount: Number(line.amount || 0),
        deductionAmount: Number(line.deductionAmount || 0),
        deductionType: line.deductionType,
        balanceDue: line.balanceDue,
      }))
      .filter((line) => line.amount > 0 || line.deductionAmount > 0);

    if (isOnAccountEntry && (!Number.isFinite(Number(onAccountAmount)) || Number(onAccountAmount) <= 0)) {
      setNotice({ type: "error", message: "Enter a positive amount to record on account." });
      return;
    }
    if (!isOnAccountEntry && allocations.length === 0) {
      setNotice({ type: "error", message: "Enter an amount or deduction for at least one bill." });
      return;
    }
    if (allocations.some((line) => line.deductionAmount > 0 && !line.deductionType)) {
      setNotice({ type: "error", message: "Choose a deduction type for each deduction." });
      return;
    }
    if (
      allocations.some(
        (line) => Math.round((line.amount + line.deductionAmount) * 100) > Math.round(line.balanceDue * 100)
      )
    ) {
      setNotice({ type: "error", message: "Cash plus deduction cannot exceed a bill's remaining balance." });
      return;
    }

    const allocatedTotalCents = allocations.reduce(
      (sum, line) => sum + Math.round(line.amount * 100) + Math.round(line.deductionAmount * 100),
      0
    );
    const paymentTotalCents = isOnAccountEntry ? Math.round(Number(onAccountAmount) * 100) : allocatedTotalCents;
    setIsSavingPayment(true);
    const apiBase = getApiBase();

    try {
      const allocationPayload = allocations.map((line) => ({
        billId: line.billId,
        amount: line.amount,
        ...(line.deductionAmount > 0 ? { deductionAmount: line.deductionAmount, deductionType: line.deductionType } : {}),
      }));

      const response = await authFetch(
        onAccountPaymentId ? `${apiBase}/payments/${onAccountPaymentId}/allocations` : `${apiBase}/payments`,
        authToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            onAccountPaymentId
              ? { allocations: allocationPayload }
              : {
                  batchId: paymentBatch.id,
                  amount: paymentTotalCents / 100,
                  paidAt: paymentDate,
                  reference: paymentReference.trim() || undefined,
                  ...(isOnAccountEntry ? {} : { allocations: allocationPayload }),
                }
          ),
        }
      );

      if (!response.ok) {
        const errorPayload = (await response.json()) as { message?: string | string[] };
        const message = Array.isArray(errorPayload.message) ? errorPayload.message.join(" ") : errorPayload.message;
        throw new Error(message || "Payment could not be recorded.");
      }

      await refreshData();
      await refreshPaymentRecords();

      setPaymentEntryOpen(false);
      setPaymentBatch(null);
      setOnAccountPaymentId(null);
      setIsOnAccountEntry(false);
      setOnAccountAmount("");
      setNotice({
        type: "success",
        message: isOnAccountEntry
          ? "Payment recorded on account."
          : onAccountPaymentId
          ? "On-account funds allocated to bills."
          : "Payment and bill allocations recorded successfully.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Payment could not be recorded.",
      });
    } finally {
      setIsSavingPayment(false);
    }
  }

  // Attach Payment Proof File
  async function handleAttachPaymentProof(paymentId: string, file: File) {
    if (!authToken || !currentUser) return;

    if (!isAdmin) {
      setNotice({ type: "error", message: "Administrator access is required to upload payment proofs." });
      return;
    }

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      setNotice({ type: "error", message: "Choose a PDF, JPG, or PNG file." });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setNotice({ type: "error", message: "Payment proof must be 10 MB or smaller." });
      return;
    }

    const apiBase = getApiBase();
    setIsUploadingProofFor(paymentId);
    try {
      const response = await fetch(`${apiBase}/payments/${encodeURIComponent(paymentId)}/proof-file`, {
        method: "PUT",
        headers: { "Content-Type": file.type, Authorization: `Bearer ${authToken}` },
        body: file,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string | string[] };
        const message = Array.isArray(payload.message) ? payload.message.join(" ") : payload.message;
        throw new Error(message || "Could not upload the payment proof.");
      }

      await refreshPaymentRecords();
      setProofLinks((current) => {
        const next = { ...current };
        if (next[paymentId]?.startsWith("blob:")) URL.revokeObjectURL(next[paymentId]);
        delete next[paymentId];
        return next;
      });
      setNotice({ type: "success", message: "Payment proof uploaded and attached." });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Payment proof upload failed.",
      });
    } finally {
      setIsUploadingProofFor(null);
    }
  }

  // Create Proof View / Download Link
  async function handleCreatePaymentProofViewLink(paymentId: string) {
    if (!authToken) return;
    const apiBase = getApiBase();
    try {
      const response = await authFetch(
        `${apiBase}/payments/${encodeURIComponent(paymentId)}/proof-download-url`,
        authToken,
        { cache: "no-store" }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string | string[] };
        const message = Array.isArray(payload.message) ? payload.message.join(" ") : payload.message;
        throw new Error(message || "Could not create a secure proof link.");
      }

      const result = (await response.json()) as { url?: string; local?: boolean };
      let url = result.url;
      if (result.local) {
        const fileResponse = await authFetch(
          `${apiBase}/payments/${encodeURIComponent(paymentId)}/proof-file`,
          authToken,
          { cache: "no-store" }
        );
        if (!fileResponse.ok) throw new Error("Could not load the local payment proof.");
        url = URL.createObjectURL(await fileResponse.blob());
        localProofUrls.current.add(url);
      }

      if (!url) throw new Error("The payment proof link was not returned.");

      setProofLinks((current) => {
        if (current[paymentId]?.startsWith("blob:")) {
          URL.revokeObjectURL(current[paymentId]);
          localProofUrls.current.delete(current[paymentId]);
        }
        return { ...current, [paymentId]: url! };
      });

      setNotice({
        type: "info",
        message: result.local
          ? "Local payment proof is ready to open."
          : "Secure payment proof link is ready. Open it within five minutes.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Could not open the payment proof.",
      });
    }
  }

  // Delete Batch Handler
  async function handleDeleteBatch(batchId: string) {
    if (!authToken || !currentUser) return;
    if (!isAdmin) {
      setNotice({ type: "error", message: "Administrator access is required to delete batches." });
      return;
    }
    setIsDeletingBatch(true);
    const apiBase = getApiBase();
    try {
      const response = await authFetch(`${apiBase}/batches/${encodeURIComponent(batchId)}`, authToken, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as { message?: string | string[] };
        const message = Array.isArray(errorData.message) ? errorData.message.join(" ") : errorData.message;
        throw new Error(message || "Failed to delete batch");
      }
      await refreshData();
      await refreshPaymentRecords();
      setDeleteBatchId(null);
      setNotice({ type: "success", message: `Batch ${batchId.slice(0, 8)} deleted successfully.` });
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Failed to delete batch." });
    } finally {
      setIsDeletingBatch(false);
    }
  }

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="section-heading" style={{ marginBottom: 20 }}>
        <div>
          <p className="eyebrow">ACCOUNTS RECEIVABLE & SETTLEMENTS</p>
          <h2>
            Bills & Payments{" "}
            <span className="section-total">
              {readyBatches.length} ready · {bills.length} bills total
            </span>
          </h2>
        </div>
        {!isAdmin && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 6,
              background: "var(--bg-subtle, #f1f5f9)",
              color: "var(--text-muted, #64748b)",
            }}
          >
            <Lock size={13} />
            <span>Read-only ({currentUser?.role ?? "Approver"} mode)</span>
          </div>
        )}
      </div>

      {/* Notice Banner */}
      {notice && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            borderRadius: "var(--radius-md, 8px)",
            marginBottom: 20,
            fontSize: 13,
            background:
              notice.type === "success"
                ? "var(--urgency-emerald-bg, #ecfdf5)"
                : notice.type === "error"
                ? "var(--urgency-rose-bg, #fef2f2)"
                : "#eff6ff",
            color:
              notice.type === "success"
                ? "var(--urgency-emerald, #047857)"
                : notice.type === "error"
                ? "var(--urgency-rose, #be123c)"
                : "#1d4ed8",
            border: `1px solid ${
              notice.type === "success"
                ? "#a7f3d0"
                : notice.type === "error"
                ? "#fecaca"
                : "#bfdbfe"
            }`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {notice.type === "success" && <CheckCircle2 size={16} />}
            {notice.type === "error" && <AlertCircle size={16} />}
            {notice.type === "info" && <Receipt size={16} />}
            <span>{notice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            style={{
              background: "none",
              border: "none",
              fontSize: 16,
              cursor: "pointer",
              color: "inherit",
              lineHeight: 1,
            }}
            aria-label="Dismiss notice"
          >
            ×
          </button>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-light)",
            borderRadius: "var(--radius-md)",
            padding: "16px 20px",
          }}
        >
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Ready for Payment
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4 }}>
            <strong style={{ fontSize: 24, color: "var(--urgency-emerald, #047857)" }}>
              {formatExactCurrency(readyTotalAmount)}
            </strong>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              ({readyBatches.length} batch{readyBatches.length === 1 ? "" : "es"})
            </span>
          </div>
        </div>

        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-light)",
            borderRadius: "var(--radius-md)",
            padding: "16px 20px",
          }}
        >
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Settled History Recorded
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4 }}>
            <strong style={{ fontSize: 24, color: "var(--text-primary)" }}>
              {formatExactCurrency(settledTotalAmount)}
            </strong>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              ({batchesWithPayments.length} batch{batchesWithPayments.length === 1 ? "" : "es"})
            </span>
          </div>
        </div>

        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-light)",
            borderRadius: "var(--radius-md)",
            padding: "16px 20px",
          }}
        >
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Total Open Receivables
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4 }}>
            <strong style={{ fontSize: 24, color: "var(--text-primary)" }}>
              {formatExactCurrency(totalReceivables)}
            </strong>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              ({bills.length} bill{bills.length === 1 ? "" : "s"})
            </span>
          </div>
        </div>
      </div>

      {/* Main Tabs Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderBottom: "1px solid var(--border-light)",
          marginBottom: 20,
          paddingBottom: 4,
        }}
        role="tablist"
        aria-label="Settlement navigation tabs"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "ready"}
          className={`filter-tab ${activeTab === "ready" ? "selected" : ""}`}
          onClick={() => setActiveTab("ready")}
          style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          <CreditCard size={15} />
          <span>Ready for Payment</span>
          <span className="badge-count" style={{ marginLeft: 4 }}>
            {readyBatches.length}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "history"}
          className={`filter-tab ${activeTab === "history" ? "selected" : ""}`}
          onClick={() => setActiveTab("history")}
          style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          <Receipt size={15} />
          <span>Settlement History & Proofs</span>
          <span className="badge-count" style={{ marginLeft: 4 }}>
            {batchesWithPayments.length}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "bills"}
          className={`filter-tab ${activeTab === "bills" ? "selected" : ""}`}
          onClick={() => setActiveTab("bills")}
          style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          <FileText size={15} />
          <span>All Accounts Receivable Bills</span>
          <span className="badge-count" style={{ marginLeft: 4 }}>
            {bills.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Ready for Payment Batches */}
      {activeTab === "ready" && (
        <section aria-label="Batches awaiting payment">
          {readyBatches.length === 0 ? (
            <div
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-light)",
                borderRadius: "var(--radius-lg)",
                padding: "48px 24px",
                textAlign: "center",
              }}
            >
              <CheckCircle2 size={40} style={{ color: "var(--urgency-emerald, #047857)", marginBottom: 12 }} />
              <h3 style={{ margin: "0 0 6px", color: "var(--text-primary)" }}>
                No Batches Awaiting Payment
              </h3>
              <p style={{ margin: "0 0 16px", color: "var(--text-secondary)", fontSize: 13, maxWidth: 440, marginLeft: "auto", marginRight: "auto" }}>
                When all approval stages complete for a batch, it automatically appears here ready for bank disbursement and accounting allocation.
              </p>
              <Link
                href="/batches"
                className="ui-button ui-button--secondary ui-button--md"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Layers size={14} />
                <span>View Batches in Approval Pipeline</span>
              </Link>
            </div>
          ) : (
            <div className="payment-review-list">
              {readyBatches.map((batch) => {
                const batchTotal = (batch.bills ?? []).reduce(
                  (sum, b) => sum + Number(b.amount ?? 0),
                  0
                );
                const batchBalance = (batch.bills ?? []).reduce(
                  (sum, b) => sum + Number(b.balanceDue ?? b.amount ?? 0),
                  0
                );
                const payments = paymentRecords[batch.id] ?? [];
                const unallocatedPayments = payments.filter((p) => Number(p.unallocatedAmount) > 0);

                return (
                  <div className="payment-review-batch" key={batch.id}>
                    <div className="payment-batch-header">
                      <div>
                        <strong>Batch {batch.id.slice(0, 8)}</strong>
                        <span className="batch-verified-note" style={{ marginLeft: 12 }}>
                          ✓ All approval stages verified ({batch.bills?.length ?? 0} bills · Total {formatExactCurrency(batchTotal)})
                        </span>
                      </div>
                      <span className="status-pill status-ready-for-payment">
                        Ready for Payment
                      </span>
                    </div>

                    {/* Bills in this Batch */}
                    <div className="payment-review-list" style={{ marginTop: 6 }}>
                      {(batch.bills ?? []).map((bill) => (
                        <div className="payment-review-row" key={bill.id ?? bill.billNumber}>
                          <div className="bill-info">
                            <strong>{bill.billNumber}</strong>
                            <span className="bill-balance" style={{ marginLeft: 8 }}>
                              {formatExactCurrency(Number(bill.balanceDue ?? bill.amount ?? 0))} remaining
                            </span>
                          </div>
                          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            Invoice: {formatExactCurrency(Number(bill.amount ?? 0))}
                          </span>
                          <span className={`status-pill status-${bill.status?.toLowerCase() ?? "pending"}`}>
                            <i />
                            {bill.status ?? "PENDING"}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Unallocated on-account funds available */}
                    {unallocatedPayments.map((payment) => (
                      <div className="on-account-row" key={payment.id}>
                        <div>
                          <strong>On-account balance available:</strong>
                          <span>
                            {formatExactCurrency(Number(payment.unallocatedAmount))} ready to allocate
                          </span>
                        </div>
                        <button
                          className="secondary-button"
                          type="button"
                          disabled={!isAdmin}
                          onClick={() => openOnAccountAllocation(batch, payment)}
                          title={isAdmin ? "Allocate on-account funds to bills" : "Admin access required"}
                        >
                          <CheckSquare size={13} />
                          <span>Allocate to bills</span>
                        </button>
                      </div>
                    ))}

                    {/* Action Buttons */}
                    <div className="payment-review-actions" style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={!isAdmin}
                        onClick={() => openOnAccountEntry(batch)}
                        title={isAdmin ? "Record payment on account for later allocation" : "Admin access required"}
                      >
                        <PlusCircle size={14} />
                        <span>Record on account</span>
                      </button>

                      <button
                        className="primary-button"
                        type="button"
                        disabled={!isAdmin}
                        onClick={() => openPaymentEntry(batch)}
                        title={isAdmin ? "Record bank payment and allocate to bills" : "Admin access required"}
                      >
                        <CreditCard size={14} />
                        <span>Record payment & allocate</span>
                      </button>

                      {isAdmin && (
                        <button
                          className="secondary-button danger-btn"
                          type="button"
                          onClick={() => setDeleteBatchId(batch.id)}
                          title="Delete this batch and its bills"
                          style={{ marginLeft: "auto", borderColor: "#fca5a5", color: "#b91c1c" }}
                        >
                          <Trash2 size={13} />
                          <span>Delete Batch</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Tab 2: Settlement History & S3 Proofs */}
      {activeTab === "history" && (
        <section aria-label="Settlement payment records and proofs">
          {batchesWithPayments.length === 0 ? (
            <div
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-light)",
                borderRadius: "var(--radius-lg)",
                padding: "48px 24px",
                textAlign: "center",
              }}
            >
              <Receipt size={40} style={{ color: "var(--text-muted)", marginBottom: 12 }} />
              <h3 style={{ margin: "0 0 6px", color: "var(--text-primary)" }}>
                No Payment Records Found
              </h3>
              <p style={{ margin: "0 0 16px", color: "var(--text-secondary)", fontSize: 13, maxWidth: 440, marginLeft: "auto", marginRight: "auto" }}>
                Once payments are recorded against ready batches, disbursement details, bank UTR references, and uploaded proof documents will appear here.
              </p>
            </div>
          ) : (
            <div className="payment-review-list">
              {batchesWithPayments.map((batch) => {
                const payments = paymentRecords[batch.id] ?? [];
                return (
                  <div className="payment-review-batch" key={batch.id}>
                    <div className="payment-batch-header">
                      <div>
                        <strong>Batch {batch.id.slice(0, 8)}</strong>
                        <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>
                          ({payments.length} payment record{payments.length === 1 ? "" : "s"})
                        </span>
                      </div>
                      <span className="status-tag">{batch.status ?? ""}</span>
                    </div>

                    {payments.map((payment) => (
                      <div className="payment-history-row" key={payment.id}>
                        <div className="payment-history-details">
                          <strong>{formatExactCurrency(Number(payment.amount))}</strong>
                          <span>
                            {payment.reference ? `Ref / UTR: ${payment.reference}` : "No payment reference"}
                            {payment.paidAt
                              ? ` · ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
                                  new Date(payment.paidAt)
                                )}`
                              : ""}
                          </span>
                          {Number(payment.unallocatedAmount) > 0 && (
                            <span className="unallocated-text" style={{ color: "var(--urgency-amber, #b45309)", fontSize: 11.5 }}>
                              {formatExactCurrency(Number(payment.unallocatedAmount))} remains unallocated
                            </span>
                          )}
                        </div>

                        <div className="payment-proof-actions" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {payment.proofKey && (
                            <>
                              <button
                                className="secondary-button"
                                type="button"
                                onClick={() => void handleCreatePaymentProofViewLink(payment.id)}
                              >
                                <RefreshCw size={13} />
                                <span>{proofLinks[payment.id] ? "Refresh link" : "Get view link"}</span>
                              </button>
                              {proofLinks[payment.id] && (
                                <a
                                  className="secondary-button view-proof-link"
                                  href={proofLinks[payment.id]}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <ExternalLink size={13} />
                                  <span>Open proof</span>
                                </a>
                              )}
                            </>
                          )}

                          <label
                            className="secondary-button payment-proof-upload"
                            style={{
                              cursor: isAdmin ? "pointer" : "not-allowed",
                              opacity: isAdmin ? 1 : 0.6,
                            }}
                          >
                            <Upload size={13} />
                            <span>
                              {isUploadingProofFor === payment.id
                                ? "Uploading..."
                                : payment.proofKey
                                ? "Replace proof"
                                : "Attach proof (S3)"}
                            </span>
                            <input
                              className="sr-only"
                              type="file"
                              accept="application/pdf,image/jpeg,image/png"
                              disabled={!isAdmin || isUploadingProofFor !== null}
                              onChange={(event) => {
                                const file = event.currentTarget.files?.[0];
                                event.currentTarget.value = "";
                                if (file) void handleAttachPaymentProof(payment.id, file);
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Tab 3: Full Accounts Receivable Bills Ledger */}
      {activeTab === "bills" && (
        <BillsTable
          bills={bills}
          visibleBills={visibleBills}
          filter={billFilter}
          setFilter={setBillFilter}
          search={billSearch}
          setSearch={setBillSearch}
        />
      )}

      {/* Payment Entry & Allocation Modal */}
      <PaymentEntryModal
        isOpen={paymentEntryOpen}
        onClose={() => setPaymentEntryOpen(false)}
        paymentBatch={paymentBatch}
        onAccountPaymentId={onAccountPaymentId}
        isOnAccountEntry={isOnAccountEntry}
        onAccountAmount={onAccountAmount}
        setOnAccountAmount={setOnAccountAmount}
        paymentLines={paymentLines}
        setPaymentLines={setPaymentLines}
        paymentDate={paymentDate}
        setPaymentDate={setPaymentDate}
        paymentReference={paymentReference}
        setPaymentReference={setPaymentReference}
        paymentRecords={paymentRecords}
        isSavingPayment={isSavingPayment}
        onCreatePayment={handleCreatePayment}
      />

      {/* Delete Batch Confirmation Dialog */}
      {deleteBatchId && (
        <div
          className="dialog-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !isDeletingBatch) setDeleteBatchId(null);
          }}
        >
          <div
            className="bill-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-batch-title"
            style={{ maxWidth: 440 }}
          >
            <div className="dialog-heading">
              <div>
                <p className="eyebrow" style={{ color: "var(--urgency-rose, #be123c)" }}>
                  CONFIRM BATCH DELETION
                </p>
                <h2 id="delete-batch-title">Delete Batch {deleteBatchId.slice(0, 8)}?</h2>
              </div>
            </div>

            <p className="dialog-description">
              Are you sure you want to delete this batch and its associated bills? This action is permanent and recorded in the audit trail.
            </p>

            <div className="dialog-actions" style={{ marginTop: 24 }}>
              <button
                type="button"
                className="secondary-button"
                disabled={isDeletingBatch}
                onClick={() => setDeleteBatchId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button danger-btn"
                disabled={isDeletingBatch}
                onClick={() => void handleDeleteBatch(deleteBatchId)}
                style={{ background: "#dc2626", borderColor: "#dc2626", color: "#ffffff" }}
              >
                {isDeletingBatch ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
