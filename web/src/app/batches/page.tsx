"use client";

import React, { Suspense, useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Layers,
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  Trash2,
  History,
  AlertTriangle,
  Clock,
  ArrowRight,
  X,
  FileSpreadsheet,
} from "lucide-react";
import { useDataContext } from "../../lib/DataContext";
import { formatCurrency, isValidConfirmNote, filterBatches, sortBatches } from "../../lib/utils";
import { Badge, Button, ModalDialog, SlideOverSheet } from "../../components/ui";
import { authFetch, getApiBase } from "../../lib/api";
import { BatchRecord, ContactRecord, BatchHistoryRecord } from "../../types";

type BatchStatusFilter = "ALL" | "IN_PROGRESS" | "READY_FOR_PAYMENT" | "COMPLETED";
type SortField = "date" | "amount" | "bills" | "status" | "id";
type SortOrder = "asc" | "desc";

function BatchesContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const {
    batches,
    contacts,
    workflows,
    currentUser,
    authToken,
    refreshData,
    isLoading,
    isRefreshing,
  } = useDataContext();

  // Read URL params
  const statusParam = (searchParams.get("status")?.toUpperCase() || "ALL") as BatchStatusFilter;
  const currentStatus: BatchStatusFilter = ["ALL", "IN_PROGRESS", "READY_FOR_PAYMENT", "COMPLETED"].includes(
    statusParam
  )
    ? statusParam
    : "ALL";
  const currentApprover = searchParams.get("approver") || "";
  const currentSearch = searchParams.get("q") || "";
  const currentSortField = (searchParams.get("sort") || "date") as SortField;
  const currentSortOrder = (searchParams.get("order") || "desc") as SortOrder;
  const currentPage = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

  // Local search draft state for responsive typing
  const [searchInput, setSearchInput] = useState(currentSearch);
  const [prevSearch, setPrevSearch] = useState(currentSearch);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(10);

  // Synchronize search input if URL changes externally (React recommended pattern)
  if (prevSearch !== currentSearch) {
    setPrevSearch(currentSearch);
    setSearchInput(currentSearch);
  }

  // Update URL helper
  const updateQuery = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === "" || (key === "status" && value === "ALL") || (key === "page" && value === "1")) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  // Drawer & Modal States
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [batchHistory, setBatchHistory] = useState<BatchHistoryRecord | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Confirm on Behalf Modal
  const [confirmModalTarget, setConfirmModalTarget] = useState<{
    batch: BatchRecord;
    step: NonNullable<BatchRecord["stepInstances"]>[number];
  } | null>(null);
  const [confirmNote, setConfirmNote] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isSubmittingConfirm, setIsSubmittingConfirm] = useState(false);

  // Reassign Modal
  const [reassignModalTarget, setReassignModalTarget] = useState<{
    batch: BatchRecord;
    step: NonNullable<BatchRecord["stepInstances"]>[number];
  } | null>(null);
  const [reassignContactId, setReassignContactId] = useState("");
  const [reassignReason, setReassignReason] = useState("");
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [isSubmittingReassign, setIsSubmittingReassign] = useState(false);

  // Delete Batch Modal
  const [deleteModalTarget, setDeleteModalTarget] = useState<BatchRecord | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Create Batch Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createTemplateId, setCreateTemplateId] = useState("");
  const [createBills, setCreateBills] = useState<Array<{ billNumber: string; amount: number; dueDate: string }>>([
    { billNumber: "", amount: 0, dueDate: new Date().toISOString().slice(0, 10) },
  ]);
  const [createBatchError, setCreateBatchError] = useState<string | null>(null);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Copy batch ID helper
  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Open Audit Sheet
  const handleOpenAuditSheet = async (batchId: string) => {
    setSelectedBatchId(batchId);
    setIsLoadingHistory(true);
    setBatchHistory(null);
    try {
      const apiBase = getApiBase();
      const res = await authFetch(`${apiBase}/batches/${encodeURIComponent(batchId)}/history`, authToken);
      if (res.ok) {
        const data = (await res.json()) as BatchHistoryRecord;
        setBatchHistory(data);
      }
    } catch {
      // Ignored: sheet displays error state
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Confirm on Behalf Action
  const handleConfirmOnBehalf = async () => {
    if (!confirmModalTarget) return;
    if (currentUser?.role?.toLowerCase() !== "admin") {
      setConfirmError("Access denied: Only administrators can confirm on behalf of approvers.");
      return;
    }
    if (!isValidConfirmNote(confirmNote)) {
      setConfirmError("A detailed note of at least 10 non-whitespace characters is required.");
      return;
    }

    setIsSubmittingConfirm(true);
    setConfirmError(null);
    try {
      const apiBase = getApiBase();
      const res = await authFetch(
        `${apiBase}/batches/${encodeURIComponent(confirmModalTarget.batch.id)}/steps/${encodeURIComponent(
          confirmModalTarget.step.id
        )}/confirm-on-behalf`,
        authToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: confirmNote.trim() }),
        }
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || "Failed to confirm on behalf of approver.");
      }
      setConfirmModalTarget(null);
      setConfirmNote("");
      await refreshData();
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "Error confirming on behalf");
    } finally {
      setIsSubmittingConfirm(false);
    }
  };

  // Reassign Step Action
  const handleReassign = async () => {
    if (!reassignModalTarget) return;
    if (currentUser?.role?.toLowerCase() !== "admin") {
      setReassignError("Access denied: Only administrators can reassign workflow steps.");
      return;
    }
    if (!reassignContactId) {
      setReassignError("Please select an active contact.");
      return;
    }

    setIsSubmittingReassign(true);
    setReassignError(null);
    try {
      const apiBase = getApiBase();
      const res = await authFetch(
        `${apiBase}/batches/${encodeURIComponent(reassignModalTarget.batch.id)}/steps/${encodeURIComponent(
          reassignModalTarget.step.id
        )}/reassign`,
        authToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            newContactId: reassignContactId,
            reason: reassignReason.trim() || undefined,
          }),
        }
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || "Failed to reassign step.");
      }
      setReassignModalTarget(null);
      setReassignContactId("");
      setReassignReason("");
      await refreshData();
    } catch (err) {
      setReassignError(err instanceof Error ? err.message : "Error reassigning step");
    } finally {
      setIsSubmittingReassign(false);
    }
  };

  // Delete Batch Action
  const handleDeleteBatch = async () => {
    if (!deleteModalTarget) return;
    if (currentUser?.role?.toLowerCase() !== "admin") {
      setDeleteError("Access denied: Only administrators can delete batches.");
      return;
    }

    setIsSubmittingDelete(true);
    setDeleteError(null);
    try {
      const apiBase = getApiBase();
      const res = await authFetch(`${apiBase}/batches/${encodeURIComponent(deleteModalTarget.id)}`, authToken, {
        method: "DELETE",
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || "Failed to delete batch.");
      }
      setDeleteModalTarget(null);
      await refreshData();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Error deleting batch");
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // Create Batch Action
  const handleCreateBatch = async () => {
    const templateId = createTemplateId || workflows[0]?.id;
    if (!templateId) {
      setCreateBatchError("Please select a workflow template.");
      return;
    }
    const validBills = createBills.filter((b) => b.billNumber.trim() && b.amount > 0);
    if (validBills.length === 0) {
      setCreateBatchError("Please provide at least one valid invoice with bill number and amount.");
      return;
    }

    setIsSubmittingCreate(true);
    setCreateBatchError(null);
    try {
      const apiBase = getApiBase();
      const res = await authFetch(`${apiBase}/batches`, authToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: currentUser?.organizationId || "demo-org",
          templateId,
          bills: validBills.map((b) => ({
            billNumber: b.billNumber.trim(),
            amount: Number(b.amount),
            dueDate: b.dueDate,
          })),
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.message || "Failed to create batch.");
      }
      setIsCreateModalOpen(false);
      setCreateBills([{ billNumber: "", amount: 0, dueDate: new Date().toISOString().slice(0, 10) }]);
      await refreshData();
    } catch (err) {
      setCreateBatchError(err instanceof Error ? err.message : "Error creating batch");
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Filter & Search Logic
  const filteredBatches = useMemo(() => {
    return filterBatches(batches, {
      status: currentStatus,
      approver: currentApprover,
      search: currentSearch,
    });
  }, [batches, currentStatus, currentApprover, currentSearch]);

  // Sorting Logic
  const sortedBatches = useMemo(() => {
    return sortBatches(filteredBatches, currentSortField, currentSortOrder);
  }, [filteredBatches, currentSortField, currentSortOrder]);

  // Pagination Logic
  const totalItems = sortedBatches.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedBatches = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedBatches.slice(start, start + pageSize);
  }, [sortedBatches, currentPage, pageSize]);

  // Status Counts
  const counts = useMemo(() => {
    return {
      ALL: batches.length,
      IN_PROGRESS: batches.filter((b) => b.status === "IN_PROGRESS").length,
      READY_FOR_PAYMENT: batches.filter((b) => b.status === "READY_FOR_PAYMENT").length,
      COMPLETED: batches.filter((b) => b.status === "COMPLETED").length,
    };
  }, [batches]);

  const hasActiveFilters = currentStatus !== "ALL" || Boolean(currentApprover) || Boolean(currentSearch);

  const handleToggleSort = (field: SortField) => {
    if (currentSortField === field) {
      updateQuery({ order: currentSortOrder === "asc" ? "desc" : "asc", page: "1" });
    } else {
      updateQuery({ sort: field, order: "desc", page: "1" });
    }
  };

  return (
    <div className="page-container">
      {/* Top Header */}
      <div className="section-heading" style={{ marginBottom: 20 }}>
        <div>
          <p className="eyebrow">AUDIT & WORKFLOW ARCHIVE</p>
          <h2>
            Batches Ledger <span className="section-total">{totalItems} displayed</span>
          </h2>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void refreshData()}
            isLoading={isRefreshing}
            leftIcon={<RefreshCw size={14} className={isRefreshing ? "rotating" : ""} />}
          >
            <span>Refresh</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            leftIcon={<Plus size={14} />}
          >
            <span>Create Batch</span>
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-light)",
          borderRadius: "var(--radius-lg)",
          padding: "16px 20px",
          marginBottom: 20,
          display: "grid",
          gap: 16,
        }}
      >
        {/* Status Tabs */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {(
            [
              { id: "ALL", label: "All Batches" },
              { id: "IN_PROGRESS", label: "In Progress" },
              { id: "READY_FOR_PAYMENT", label: "Ready for Payment" },
              { id: "COMPLETED", label: "Completed" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => updateQuery({ status: tab.id, page: "1" })}
              className={`filter-tab ${currentStatus === tab.id ? "selected" : ""}`}
              style={{
                borderRadius: "var(--radius-full)",
                padding: "6px 14px",
                fontSize: 13,
                fontWeight: currentStatus === tab.id ? 600 : 500,
                border: "1px solid",
                borderColor: currentStatus === tab.id ? "var(--brand-primary)" : "var(--border-light)",
                background: currentStatus === tab.id ? "var(--brand-primary)" : "var(--bg-subtle)",
                color: currentStatus === tab.id ? "#ffffff" : "var(--text-secondary)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                transition: "all 120ms ease",
              }}
            >
              <span>{tab.label}</span>
              <span
                style={{
                  fontSize: 11,
                  padding: "1px 6px",
                  borderRadius: "var(--radius-full)",
                  background: currentStatus === tab.id ? "rgba(255,255,255,0.25)" : "var(--border-light)",
                  color: currentStatus === tab.id ? "#ffffff" : "var(--text-muted)",
                }}
              >
                {counts[tab.id]}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Approver Select */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          {/* Search Box */}
          <div style={{ flex: "1 1 280px", position: "relative" }}>
            <Search
              size={15}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
              }}
            />
            <input
              type="text"
              placeholder="Search by Batch ID or Invoice #..."
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                updateQuery({ q: e.target.value.trim() || null, page: "1" });
              }}
              style={{
                width: "100%",
                padding: "8px 12px 8px 34px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-strong)",
                background: "var(--bg-surface)",
                fontSize: 13,
                fontFamily: "inherit",
              }}
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  updateQuery({ q: null, page: "1" });
                }}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Approver Filter */}
          <div style={{ minWidth: 200 }}>
            <select
              value={currentApprover}
              onChange={(e) => updateQuery({ approver: e.target.value || null, page: "1" })}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-strong)",
                background: "var(--bg-surface)",
                fontSize: 13,
                fontFamily: "inherit",
                color: "var(--text-primary)",
              }}
            >
              <option value="">All Approvers</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.role})
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                updateQuery({ status: null, approver: null, q: null, page: "1" });
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--brand-primary)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                padding: "6px 8px",
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Batches Table */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-light)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--border-light)" }}>
                <th
                  onClick={() => handleToggleSort("id")}
                  style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-secondary)", cursor: "pointer" }}
                >
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span>Batch ID</span>
                    <ArrowUpDown size={12} opacity={currentSortField === "id" ? 1 : 0.4} />
                  </div>
                </th>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-secondary)" }}>
                  Current Stage & Approver
                </th>
                <th
                  onClick={() => handleToggleSort("status")}
                  style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-secondary)", cursor: "pointer" }}
                >
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span>Status</span>
                    <ArrowUpDown size={12} opacity={currentSortField === "status" ? 1 : 0.4} />
                  </div>
                </th>
                <th
                  onClick={() => handleToggleSort("bills")}
                  style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-secondary)", cursor: "pointer" }}
                >
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span>Invoices</span>
                    <ArrowUpDown size={12} opacity={currentSortField === "bills" ? 1 : 0.4} />
                  </div>
                </th>
                <th
                  onClick={() => handleToggleSort("amount")}
                  style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-secondary)", cursor: "pointer", textAlign: "right" }}
                >
                  <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 6, width: "100%" }}>
                    <span>Amount / Balance Due</span>
                    <ArrowUpDown size={12} opacity={currentSortField === "amount" ? 1 : 0.4} />
                  </div>
                </th>
                <th
                  onClick={() => handleToggleSort("date")}
                  style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-secondary)", cursor: "pointer" }}
                >
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span>Created Date</span>
                    <ArrowUpDown size={12} opacity={currentSortField === "date" ? 1 : 0.4} />
                  </div>
                </th>
                <th style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-secondary)", textAlign: "right" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedBatches.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "48px 16px", textAlign: "center", color: "var(--text-muted)" }}>
                    <Layers size={32} style={{ margin: "0 auto 10px", display: "block", opacity: 0.4 }} />
                    <strong style={{ display: "block", color: "var(--text-primary)", marginBottom: 4 }}>
                      No batches found
                    </strong>
                    <p style={{ margin: 0, fontSize: 13 }}>
                      {hasActiveFilters
                        ? "Try adjusting your search query or status filter."
                        : "Click 'Create Batch' above to launch your first approval batch."}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedBatches.map((batch) => {
                  const totalAmount = (batch.bills ?? []).reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
                  const totalRemaining = (batch.bills ?? []).reduce((sum, item) => sum + Number(item.balanceDue ?? 0), 0);
                  const activeStep = (batch.stepInstances ?? []).find(
                    (s) => s.status === "ALERTED" || s.status === "ESCALATED"
                  );
                  const completedSteps = (batch.stepInstances ?? []).filter((s) => s.status === "COMPLETED").length;
                  const totalSteps = (batch.stepInstances ?? []).length || 1;

                  const badgeVariant =
                    batch.status === "COMPLETED"
                      ? "success"
                      : batch.status === "READY_FOR_PAYMENT"
                      ? "info"
                      : "warning";

                  return (
                    <tr
                      key={batch.id}
                      style={{
                        borderBottom: "1px solid var(--border-light)",
                        transition: "background 100ms ease",
                      }}
                    >
                      {/* Batch ID */}
                      <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Link
                            href={`/batches/${batch.id}`}
                            style={{
                              fontFamily: "monospace",
                              fontWeight: 700,
                              color: "var(--brand-primary)",
                              textDecoration: "none",
                              fontSize: 13,
                            }}
                          >
                            #{batch.id.slice(0, 8)}
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleCopyId(batch.id)}
                            title="Copy full batch ID"
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 2,
                              color: copiedId === batch.id ? "var(--brand-primary)" : "var(--text-muted)",
                            }}
                          >
                            {copiedId === batch.id ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        </div>
                      </td>

                      {/* Current Stage & Approver */}
                      <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                        {activeStep ? (
                          <div>
                            <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 13 }}>
                              {activeStep.stage?.contact?.name ?? "Assigned Approver"}
                            </div>
                            <small style={{ color: "var(--text-muted)", fontSize: 11 }}>
                              Stage {activeStep.stage?.order ?? 1} of {totalSteps} · {activeStep.stage?.contact?.email}
                            </small>
                          </div>
                        ) : (
                          <div>
                            <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                              {completedSteps === totalSteps ? "All Stages Approved" : "Workflow Ready"}
                            </span>
                            <small style={{ display: "block", color: "var(--text-muted)", fontSize: 11 }}>
                              {completedSteps}/{totalSteps} stages completed
                            </small>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                        <Badge variant={badgeVariant}>
                          {batch.status?.replace(/_/g, " ") ?? "IN PROGRESS"}
                        </Badge>
                      </td>

                      {/* Invoices */}
                      <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                        <strong style={{ color: "var(--text-primary)" }}>
                          {(batch.bills ?? []).length} bill(s)
                        </strong>
                        <small
                          style={{
                            display: "block",
                            color: "var(--text-muted)",
                            fontSize: 11,
                            maxWidth: 160,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={(batch.bills ?? []).map((b) => b.billNumber).join(", ")}
                        >
                          {(batch.bills ?? []).map((b) => b.billNumber).join(", ")}
                        </small>
                      </td>

                      {/* Financials */}
                      <td style={{ padding: "14px 16px", verticalAlign: "middle", textAlign: "right" }}>
                        <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 13 }}>
                          {formatCurrency(totalAmount)}
                        </div>
                        <small style={{ color: totalRemaining > 0 ? "var(--urgency-amber)" : "var(--brand-primary)", fontSize: 11 }}>
                          {formatCurrency(totalRemaining)} due
                        </small>
                      </td>

                      {/* Created Date */}
                      <td style={{ padding: "14px 16px", verticalAlign: "middle", color: "var(--text-secondary)", fontSize: 12 }}>
                        {batch.createdAt
                          ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(batch.createdAt))
                          : "—"}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "14px 16px", verticalAlign: "middle", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          <button
                            type="button"
                            onClick={() => void handleOpenAuditSheet(batch.id)}
                            className="ui-button ui-button--secondary ui-button--sm"
                            title="Open Audit Trail & Details Slide-Over"
                            style={{ padding: "4px 8px", fontSize: 12 }}
                          >
                            <History size={13} />
                            <span>Audit</span>
                          </button>

                          {batch.status === "IN_PROGRESS" && activeStep && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmModalTarget({ batch, step: activeStep });
                                  setConfirmNote("");
                                  setConfirmError(null);
                                }}
                                className="ui-button ui-button--secondary ui-button--sm"
                                title="Confirm approval on behalf of approver"
                                style={{ padding: "4px 8px", fontSize: 12 }}
                              >
                                <ShieldCheck size={13} style={{ color: "var(--brand-primary)" }} />
                                <span>Confirm</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setReassignModalTarget({ batch, step: activeStep });
                                  setReassignContactId("");
                                  setReassignReason("");
                                  setReassignError(null);
                                }}
                                className="ui-button ui-button--secondary ui-button--sm"
                                title="Reassign stage to another active contact"
                                style={{ padding: "4px 8px", fontSize: 12 }}
                              >
                                <UserCheck size={13} style={{ color: "var(--status-info-text)" }} />
                                <span>Reassign</span>
                              </button>
                            </>
                          )}

                          {currentUser?.role?.toLowerCase() === "admin" && (
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteModalTarget(batch);
                                setDeleteError(null);
                              }}
                              className="ui-button ui-button--secondary ui-button--sm"
                              title="Delete batch and its invoices"
                              style={{ padding: "4px 6px", color: "var(--urgency-rose)" }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalItems > 0 && (
          <div
            style={{
              padding: "12px 20px",
              background: "var(--bg-subtle)",
              borderTop: "1px solid var(--border-light)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 12,
              color: "var(--text-secondary)",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              Showing {Math.min(totalItems, (currentPage - 1) * pageSize + 1)} to{" "}
              {Math.min(totalItems, currentPage * pageSize)} of {totalItems} batches
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span>Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    updateQuery({ page: "1" });
                  }}
                  style={{
                    padding: "3px 6px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-light)",
                    fontSize: 12,
                    background: "var(--bg-surface)",
                  }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => updateQuery({ page: String(currentPage - 1) })}
                  className="ui-button ui-button--secondary ui-button--sm"
                  style={{ padding: "4px 8px" }}
                >
                  <ChevronLeft size={14} />
                  <span>Prev</span>
                </button>
                <span style={{ padding: "4px 8px", fontWeight: 600 }}>
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => updateQuery({ page: String(currentPage + 1) })}
                  className="ui-button ui-button--secondary ui-button--sm"
                  style={{ padding: "4px 8px" }}
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Slide-Over Audit Sheet */}
      <SlideOverSheet
        isOpen={Boolean(selectedBatchId)}
        onClose={() => {
          setSelectedBatchId(null);
          setBatchHistory(null);
        }}
        title={`Audit Trail: Batch #${selectedBatchId?.slice(0, 8)}`}
        description="Complete chronological record of dispatches, approver sign-offs, and reminders."
        width="540px"
      >
        {isLoadingHistory ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)" }}>
            <Clock size={24} className="rotating" style={{ margin: "0 auto 10px", display: "block" }} />
            <span>Loading audit history records...</span>
          </div>
        ) : batchHistory ? (
          <div style={{ display: "grid", gap: 20 }}>
            {/* Overview Card */}
            <div
              style={{
                padding: 14,
                background: "var(--bg-subtle)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-light)",
                fontSize: 12,
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Status:</span>
                <strong>{batchHistory.status}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Template:</span>
                <strong>{batchHistory.template?.name || "Standard Workflow"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Total Invoices:</span>
                <strong>{batchHistory.bills?.length ?? 0} bills</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Total Amount:</span>
                <strong>
                  {formatCurrency((batchHistory.bills ?? []).reduce((sum, b) => sum + Number(b.amount ?? 0), 0))}
                </strong>
              </div>
            </div>

            {/* Stages Progression */}
            <div>
              <strong style={{ fontSize: 13, display: "block", marginBottom: 10 }}>Workflow Progression</strong>
              <div style={{ display: "grid", gap: 8 }}>
                {batchHistory.stepInstances?.map((stg) => (
                  <div
                    key={stg.id}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-light)",
                      background: "var(--bg-surface)",
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <strong>
                        Stage {stg.stage?.order}: {stg.stage?.contact?.name}
                      </strong>
                      <Badge variant={stg.status === "COMPLETED" ? "success" : stg.status === "ALERTED" ? "warning" : "neutral"}>
                        {stg.status}
                      </Badge>
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
                      {stg.stage?.contact?.email} · Reminders sent: {stg.reminderCount ?? 0}
                    </div>
                    {stg.lastComment && (
                      <div
                        style={{
                          marginTop: 6,
                          padding: "6px 8px",
                          background: "var(--bg-subtle)",
                          borderRadius: "var(--radius-sm)",
                          fontSize: 11,
                          color: "var(--text-secondary)",
                          fontStyle: "italic",
                        }}
                      >
                        Note: {stg.lastComment}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Audit Logs */}
            <div>
              <strong style={{ fontSize: 13, display: "block", marginBottom: 10 }}>Audit Activity Logs</strong>
              {(batchHistory.auditLogs ?? []).length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No audit events logged yet.</p>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {batchHistory.auditLogs?.map((log) => (
                    <div
                      key={log.id}
                      style={{
                        padding: "8px 12px",
                        borderLeft: "3px solid var(--brand-primary)",
                        background: "var(--bg-subtle)",
                        borderRadius: "0 var(--radius-sm) var(--radius-sm) 0",
                        fontSize: 11,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                        <strong style={{ textTransform: "capitalize", color: "var(--text-primary)" }}>
                          {log.action.replace(/_/g, " ")}
                        </strong>
                        <span style={{ color: "var(--text-muted)" }}>
                          {new Intl.DateTimeFormat("en-IN", {
                            dateStyle: "short",
                            timeStyle: "short",
                          }).format(new Date(log.createdAt))}
                        </span>
                      </div>
                      <div style={{ color: "var(--text-secondary)" }}>
                        Actor: {log.actor || "System / Offline"}
                      </div>
                      {log.detail && (
                        <div style={{ color: "var(--text-muted)", marginTop: 2, fontFamily: "monospace", fontSize: 10 }}>
                          {JSON.stringify(log.detail)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Deep Link to Standalone Batch Page */}
            <div style={{ marginTop: 10, paddingTop: 14, borderTop: "1px solid var(--border-light)" }}>
              <Link
                href={`/batches/${batchHistory.id}`}
                className="ui-button ui-button--secondary ui-button--md"
                style={{ width: "100%", justifyContent: "center" }}
              >
                <span>Open Full Standalone Page</span>
                <ExternalLink size={14} />
              </Link>
            </div>
          </div>
        ) : (
          <p style={{ color: "var(--urgency-rose)", textAlign: "center" }}>Unable to load batch audit trail.</p>
        )}
      </SlideOverSheet>

      {/* Confirm on Behalf Modal */}
      {confirmModalTarget && (
        <ModalDialog
          isOpen={Boolean(confirmModalTarget)}
          onClose={() => setConfirmModalTarget(null)}
          title="Confirm on Behalf of Approver"
          description="Advance this batch to the next approval stage with an authorized audit note."
        >
          <div style={{ display: "grid", gap: 14 }}>
            <div
              style={{
                padding: "10px 14px",
                background: "var(--bg-subtle)",
                borderRadius: "var(--radius-md)",
                fontSize: 12,
              }}
            >
              <div>
                <strong>Batch:</strong> #{confirmModalTarget.batch.id.slice(0, 8)}
              </div>
              <div>
                <strong>Current Approver:</strong>{" "}
                {confirmModalTarget.step.stage?.contact?.name ?? "Assigned Approver"} (
                {confirmModalTarget.step.stage?.contact?.email})
              </div>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 6,
                  color: "var(--text-primary)",
                }}
              >
                Offline Authorization Note <span style={{ color: "var(--urgency-rose)" }}>*</span>
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Verbal sign-off received via phone call with Director Rajesh at 11:30 AM..."
                value={confirmNote}
                onChange={(e) => setConfirmNote(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-strong)",
                  fontSize: 13,
                  fontFamily: "inherit",
                }}
              />
              <small
                style={{
                  color: confirmNote.trim().length >= 10 ? "var(--brand-primary)" : "var(--text-muted)",
                  fontSize: 11,
                }}
              >
                {confirmNote.trim().length}/10 characters minimum
              </small>
            </div>

            {confirmError && (
              <div
                style={{
                  padding: "8px 12px",
                  background: "var(--urgency-rose-bg)",
                  color: "var(--urgency-rose)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 12,
                }}
              >
                {confirmError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
              <Button variant="secondary" onClick={() => setConfirmModalTarget(null)} disabled={isSubmittingConfirm}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleConfirmOnBehalf()}
                disabled={!isValidConfirmNote(confirmNote) || isSubmittingConfirm}
                isLoading={isSubmittingConfirm}
              >
                Confirm Authorization
              </Button>
            </div>
          </div>
        </ModalDialog>
      )}

      {/* Reassign Step Modal */}
      {reassignModalTarget && (
        <ModalDialog
          isOpen={Boolean(reassignModalTarget)}
          onClose={() => setReassignModalTarget(null)}
          title="Reassign Approval Step"
          description="Transfer responsibility for this stage to another active organizational contact."
        >
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                New Approver <span style={{ color: "var(--urgency-rose)" }}>*</span>
              </label>
              <select
                value={reassignContactId}
                onChange={(e) => setReassignContactId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-strong)",
                  fontSize: 13,
                }}
              >
                <option value="">Select an active contact...</option>
                {contacts
                  .filter((c) => c.isActive && c.id !== reassignModalTarget.step.stage?.contact?.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.email}) - {c.role}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                Reason for Reassignment (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Primary approver on medical leave"
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-strong)",
                  fontSize: 13,
                }}
              />
            </div>

            {reassignError && (
              <div
                style={{
                  padding: "8px 12px",
                  background: "var(--urgency-rose-bg)",
                  color: "var(--urgency-rose)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 12,
                }}
              >
                {reassignError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
              <Button variant="secondary" onClick={() => setReassignModalTarget(null)} disabled={isSubmittingReassign}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleReassign()}
                disabled={!reassignContactId || isSubmittingReassign}
                isLoading={isSubmittingReassign}
              >
                Reassign Step
              </Button>
            </div>
          </div>
        </ModalDialog>
      )}

      {/* Delete Batch Modal */}
      {deleteModalTarget && (
        <ModalDialog
          isOpen={Boolean(deleteModalTarget)}
          onClose={() => setDeleteModalTarget(null)}
          title="Delete Batch"
          description="Are you sure you want to permanently delete this approval batch and its associated invoices?"
        >
          <div style={{ display: "grid", gap: 14 }}>
            <div
              style={{
                padding: "12px",
                background: "var(--urgency-rose-bg)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--urgency-rose-border)",
                fontSize: 13,
                color: "var(--urgency-rose)",
              }}
            >
              <p style={{ margin: 0, fontWeight: 600 }}>This action cannot be undone.</p>
              <p style={{ margin: "4px 0 0", fontSize: 12 }}>
                Batch #{deleteModalTarget.id.slice(0, 8)} with {(deleteModalTarget.bills ?? []).length} invoices will be removed.
              </p>
            </div>

            {deleteError && (
              <div
                style={{
                  padding: "8px 12px",
                  background: "var(--urgency-rose-bg)",
                  color: "var(--urgency-rose)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 12,
                }}
              >
                {deleteError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
              <Button variant="secondary" onClick={() => setDeleteModalTarget(null)} disabled={isSubmittingDelete}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleDeleteBatch()}
                isLoading={isSubmittingDelete}
              >
                Delete Permanently
              </Button>
            </div>
          </div>
        </ModalDialog>
      )}

      {/* Create Batch Modal */}
      {isCreateModalOpen && (
        <ModalDialog
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Create New Approval Batch"
          description="Bundle vendor or customer bills into an automated multi-stage sign-off batch."
        >
          <div style={{ display: "grid", gap: 16 }}>
            {/* Workflow Template */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                Approval Workflow Template <span style={{ color: "var(--urgency-rose)" }}>*</span>
              </label>
              <select
                value={createTemplateId || workflows[0]?.id || ""}
                onChange={(e) => setCreateTemplateId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-strong)",
                  fontSize: 13,
                }}
              >
                {workflows.map((wf) => (
                  <option key={wf.id} value={wf.id}>
                    {wf.name} ({wf.stages?.length ?? 1} stage{(wf.stages?.length ?? 1) > 1 ? "s" : ""})
                  </option>
                ))}
              </select>
            </div>

            {/* Invoices List */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600, margin: 0 }}>
                  Invoices / Bills in Batch <span style={{ color: "var(--urgency-rose)" }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setCreateBills((prev) => [
                      ...prev,
                      { billNumber: "", amount: 0, dueDate: new Date().toISOString().slice(0, 10) },
                    ])
                  }
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--brand-primary)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Plus size={12} />
                  <span>Add Invoice</span>
                </button>
              </div>

              <div style={{ display: "grid", gap: 8, maxHeight: 220, overflowY: "auto" }}>
                {createBills.map((bill, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 120px 130px 30px",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <input
                      type="text"
                      placeholder="Invoice # (e.g. INV-2026-01)"
                      value={bill.billNumber}
                      onChange={(e) => {
                        const updated = [...createBills];
                        updated[idx].billNumber = e.target.value;
                        setCreateBills(updated);
                      }}
                      style={{
                        padding: "6px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-strong)",
                        fontSize: 12,
                      }}
                    />
                    <input
                      type="number"
                      placeholder="Amount (₹)"
                      value={bill.amount || ""}
                      onChange={(e) => {
                        const updated = [...createBills];
                        updated[idx].amount = Number(e.target.value);
                        setCreateBills(updated);
                      }}
                      style={{
                        padding: "6px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-strong)",
                        fontSize: 12,
                      }}
                    />
                    <input
                      type="date"
                      value={bill.dueDate}
                      onChange={(e) => {
                        const updated = [...createBills];
                        updated[idx].dueDate = e.target.value;
                        setCreateBills(updated);
                      }}
                      style={{
                        padding: "6px 8px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-strong)",
                        fontSize: 12,
                      }}
                    />
                    {createBills.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setCreateBills((prev) => prev.filter((_, i) => i !== idx))}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--urgency-rose)",
                          cursor: "pointer",
                          padding: 4,
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {createBatchError && (
              <div
                style={{
                  padding: "8px 12px",
                  background: "var(--urgency-rose-bg)",
                  color: "var(--urgency-rose)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 12,
                }}
              >
                {createBatchError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
              <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)} disabled={isSubmittingCreate}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => void handleCreateBatch()} isLoading={isSubmittingCreate}>
                Launch Batch
              </Button>
            </div>
          </div>
        </ModalDialog>
      )}
    </div>
  );
}

export default function BatchesPage() {
  return (
    <Suspense
      fallback={
        <div className="page-container" style={{ padding: "40px 0", textAlign: "center" }}>
          <Clock size={28} className="rotating" style={{ color: "var(--brand-primary)", margin: "0 auto 12px" }} />
          <p style={{ color: "var(--text-secondary)" }}>Loading Batches Ledger...</p>
        </div>
      }
    >
      <BatchesContent />
    </Suspense>
  );
}
