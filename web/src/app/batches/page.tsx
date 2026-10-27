"use client";

import React, { Suspense, useState, useMemo, useCallback, useEffect, useRef } from "react";
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
  Bell,
  Eye,
  ChevronDown,
  CreditCard,
  Download,
} from "lucide-react";
import { useDataContext } from "../../lib/DataContext";
import {
  formatCurrency,
  isValidConfirmNote,
  filterBatches,
  sortBatches,
  formatBatchId,
  formatStageDuration,
} from "../../lib/utils";
import { exportBatchesToCSV } from "../../lib/exportUtils";
import {
  Badge,
  Button,
  ModalDialog,
  SlideOverSheet,
  ActionDropdown,
  AIGradientBorder,
} from "../../components/ui";
import { authFetch, getApiBase } from "../../lib/api";
import { BatchRecord, ContactRecord, BatchHistoryRecord } from "../../types";
import {
  BatchConfirmModal,
  BatchReassignModal,
  BatchDeleteModal,
  BatchDetailsSheet,
  BatchCreateModal,
} from "../../components/batches";

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
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
            Batches Ledger <span className="shell-header-badge">{totalItems} displayed</span>
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
              className={`ui-status-tab ${currentStatus === tab.id ? "active" : ""}`}
              style={{
                borderRadius: "var(--radius-full)",
                padding: "6px 14px",
                fontSize: 13,
                fontWeight: currentStatus === tab.id ? 600 : 500,
                border: "1px solid",
                borderColor: currentStatus === tab.id ? "var(--brand-primary)" : "var(--border-light)",
                background: currentStatus === tab.id ? "var(--brand-primary)" : "var(--bg-subtle)",
                color: currentStatus === tab.id ? "var(--text-inverse)" : "var(--text-primary)",
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
                  color: currentStatus === tab.id ? "var(--text-inverse)" : "var(--text-secondary)",
                }}
              >
                {counts[tab.id]}
              </span>
            </button>
          ))}
        </div>

        {/* Payment Waiting Process Alert Banner */}
        {counts.READY_FOR_PAYMENT > 0 && (
          <div
            style={{
              marginBottom: 16,
              padding: "16px 20px",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--status-info-border)",
              background: "var(--status-info-bg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "var(--brand-primary)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 2px 6px rgba(15,118,110,0.25)",
                }}
              >
                <CreditCard size={20} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                  <span>{counts.READY_FOR_PAYMENT} Batch{counts.READY_FOR_PAYMENT === 1 ? "" : "es"} Ready for Payment Recording</span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: "var(--radius-full)",
                      background: "var(--status-info-text)",
                      color: "#ffffff",
                      fontWeight: 600,
                    }}
                  >
                    Waiting Process
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3 }}>
                  All approval stages are 100% verified. Action required: Record bank disbursement details, transaction UTR, and upload receipts to settle invoices.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push("/payments")}
              className="ui-button ui-button--primary"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 18px",
                fontSize: 13,
                fontWeight: 600,
                boxShadow: "0 2px 4px rgba(15,118,110,0.2)",
              }}
            >
              <CreditCard size={15} />
              <span>Record Payment in Waiting Process &rarr;</span>
            </button>
          </div>
        )}

        {/* Search & Approver Select */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          {/* Search Box */}
          <div style={{ flex: "1 1 280px", position: "relative", display: "flex", alignItems: "center" }}>
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
              ref={searchInputRef}
              type="text"
              placeholder="Search by Batch ID or Invoice #... (⌘K)"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                updateQuery({ q: e.target.value.trim() || null, page: "1" });
              }}
              style={{
                width: "100%",
                padding: "8px 45px 8px 34px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-strong)",
                background: "var(--bg-surface)",
                fontSize: 13,
                fontFamily: "inherit",
              }}
            />
            <kbd
              style={{
                position: "absolute",
                right: searchInput ? 32 : 12,
                fontSize: 10,
                padding: "2px 5px",
                borderRadius: 4,
                border: "1px solid var(--border-light)",
                background: "var(--bg-subtle)",
                color: "var(--text-muted)",
                fontFamily: "monospace",
              }}
            >
              ⌘K
            </kbd>
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
          <div style={{ minWidth: 200, position: "relative" }}>
            <select
              value={currentApprover}
              onChange={(e) => updateQuery({ approver: e.target.value || null, page: "1" })}
              style={{
                width: "100%",
                appearance: "none",
                WebkitAppearance: "none",
                padding: "8px 28px 8px 12px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-strong)",
                background: "var(--bg-surface)",
                fontSize: 13,
                fontFamily: "inherit",
                color: "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              <option value="">All Approvers</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.role})
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
                color: "var(--text-muted)",
              }}
            />
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

          {/* Export to CSV Button */}
          <div style={{ marginLeft: "auto" }}>
            <button
              type="button"
              onClick={() => exportBatchesToCSV(filteredBatches)}
              className="ui-button ui-button--outline"
              title="Download current ledger as CSV spreadsheet"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-strong)",
                background: "var(--bg-surface)",
                color: "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Batches Table */}
      <AIGradientBorder variant="ai" duration={6} style={{ width: "100%" }}>
        <div
          style={{
            background: "var(--bg-surface)",
            width: "100%",
            overflow: "hidden",
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
                  style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-secondary)", cursor: "pointer", textAlign: "right", whiteSpace: "nowrap" }}
                >
                  <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 6, width: "100%", whiteSpace: "nowrap" }}>
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
                            {formatBatchId(batch.id)}
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

                      {/* Current Stage & Approver with Time-in-Stage & Reminders */}
                      <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                        {activeStep ? (
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                              <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 13 }}>
                                {activeStep.stage?.contact?.name ?? "Assigned Approver"}
                              </span>
                              {activeStep.status === "ESCALATED" && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    padding: "1px 5px",
                                    borderRadius: 4,
                                    background: "var(--urgency-rose-bg)",
                                    color: "var(--urgency-rose)",
                                    fontWeight: 700,
                                  }}
                                >
                                  ESCALATED
                                </span>
                              )}
                            </div>
                            <div style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 3 }}>
                              Stage {activeStep.stage?.order ?? 1} of {totalSteps} · {activeStep.stage?.contact?.email}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11 }}>
                              {activeStep.alertedAt && (
                                <span
                                  style={{
                                    color: activeStep.status === "ESCALATED" ? "var(--urgency-rose)" : "var(--text-secondary)",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 3,
                                    fontWeight: 500,
                                  }}
                                >
                                  <Clock size={11} />
                                  {formatStageDuration(activeStep.alertedAt)}
                                </span>
                              )}
                              <span
                                style={{
                                  color: (activeStep.reminderCount ?? 0) >= (activeStep.stage?.maxReminders ?? 3) ? "var(--urgency-amber)" : "var(--text-muted)",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 3,
                                }}
                              >
                                <Bell size={11} />
                                {activeStep.reminderCount ?? 0}/{activeStep.stage?.maxReminders ?? 3} reminders
                              </span>
                            </div>
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
                      <td style={{ padding: "14px 16px", verticalAlign: "middle", textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", gap: 6, alignItems: "center", justifyContent: "flex-end" }}>
                          {batch.status === "READY_FOR_PAYMENT" && (
                            <button
                              type="button"
                              onClick={() => router.push("/payments")}
                              className="ui-button ui-button--primary ui-button--sm"
                              title="Record bank payment and allocate to bills"
                              style={{ padding: "4px 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}
                            >
                              <CreditCard size={13} />
                              <span>Record Payment</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => void handleOpenAuditSheet(batch.id)}
                            className="ui-button ui-button--secondary ui-button--sm"
                            title="Open Audit Trail & Details Slide-Over"
                            style={{ padding: "4px 10px", fontSize: 12 }}
                          >
                            <History size={13} />
                            <span>Audit</span>
                          </button>

                          <ActionDropdown
                            items={[
                              ...(batch.status === "READY_FOR_PAYMENT"
                                ? [
                                    {
                                      label: "Record Payment",
                                      icon: <CreditCard size={14} style={{ color: "var(--brand-primary)" }} />,
                                      onClick: () => {
                                        router.push("/payments");
                                      },
                                    },
                                  ]
                                : []),
                              ...(batch.status === "IN_PROGRESS" && activeStep && currentUser?.role?.toLowerCase() === "admin"
                                ? [
                                    {
                                      label: "Confirm on Behalf",
                                      icon: <ShieldCheck size={14} style={{ color: "var(--brand-primary)" }} />,
                                      onClick: () => {
                                        setConfirmModalTarget({ batch, step: activeStep });
                                        setConfirmNote("");
                                        setConfirmError(null);
                                      },
                                    },
                                    {
                                      label: "Reassign Approver",
                                      icon: <UserCheck size={14} style={{ color: "var(--status-info-text)" }} />,
                                      onClick: () => {
                                        setReassignModalTarget({ batch, step: activeStep });
                                        setReassignContactId("");
                                        setReassignReason("");
                                        setReassignError(null);
                                      },
                                    },
                                  ]
                                : []),
                              {
                                label: "View Batch Details",
                                icon: <Eye size={14} />,
                                onClick: () => {
                                  router.push(`/batches/${encodeURIComponent(batch.id)}`);
                                },
                              },
                              ...(currentUser?.role?.toLowerCase() === "admin"
                                ? [
                                    {
                                      label: "Delete Batch",
                                      icon: <Trash2 size={14} />,
                                      variant: "danger" as const,
                                      onClick: () => {
                                        setDeleteModalTarget(batch);
                                        setDeleteError(null);
                                      },
                                    },
                                  ]
                                : []),
                            ]}
                          />
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
      </AIGradientBorder>

      {/* Slide-Over Audit Sheet */}
      <BatchDetailsSheet
        selectedBatchId={selectedBatchId}
        onClose={() => {
          setSelectedBatchId(null);
          setBatchHistory(null);
        }}
        isLoadingHistory={isLoadingHistory}
        batchHistory={batchHistory}
      />

      {/* Confirm on Behalf Modal */}
      <BatchConfirmModal
        target={confirmModalTarget}
        onClose={() => setConfirmModalTarget(null)}
        confirmNote={confirmNote}
        setConfirmNote={setConfirmNote}
        confirmError={confirmError}
        isSubmitting={isSubmittingConfirm}
        onConfirm={handleConfirmOnBehalf}
      />

      {/* Reassign Step Modal */}
      <BatchReassignModal
        target={reassignModalTarget}
        onClose={() => setReassignModalTarget(null)}
        contacts={contacts}
        reassignContactId={reassignContactId}
        setReassignContactId={setReassignContactId}
        reassignReason={reassignReason}
        setReassignReason={setReassignReason}
        reassignError={reassignError}
        isSubmitting={isSubmittingReassign}
        onReassign={handleReassign}
      />

      {/* Delete Batch Modal */}
      <BatchDeleteModal
        target={deleteModalTarget}
        onClose={() => setDeleteModalTarget(null)}
        deleteError={deleteError}
        isSubmitting={isSubmittingDelete}
        onDelete={handleDeleteBatch}
      />

      {/* Create Batch Modal */}
      <BatchCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        workflows={workflows}
        createTemplateId={createTemplateId}
        setCreateTemplateId={setCreateTemplateId}
        createBills={createBills}
        setCreateBills={setCreateBills}
        createBatchError={createBatchError}
        isSubmitting={isSubmittingCreate}
        onCreateBatch={handleCreateBatch}
      />
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
