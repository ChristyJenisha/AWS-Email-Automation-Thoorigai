"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Clock,
  CreditCard,
  UserCheck,
  ShieldAlert,
  ArrowRight,
  UserX,
  ExternalLink,
  History,
  CheckCircle,
  Search,
  Filter,
  BellRing,
  ChevronDown,
  Eye,
  TrendingUp,
  Trash2,
} from "lucide-react";
import { useDataContext } from "../lib/DataContext";
import {
  formatCurrency,
  isValidConfirmNote,
  compareActiveBatchesUrgency,
  formatBatchId,
} from "../lib/utils";
import {
  Badge,
  Button,
  MetricCard,
  ModalDialog,
  SlideOverSheet,
  ActionDropdown,
  AIGradientBorder,
} from "../components/ui";
import { BatchHistoryRecord, BatchRecord, StepInstanceRecord } from "../types";
import { authFetch, getApiBase } from "../lib/api";

function getTimeGreeting(date: Date = new Date()): string {
  const hours = date.getHours();
  if (hours < 12) return "Good morning";
  if (hours < 17) return "Good afternoon";
  return "Good evening";
}

export default function CommandCenterPage() {
  const router = useRouter();
  const {
    batches,
    contacts,
    currentUser,
    authToken,
    overdueCount,
    inFlightCount,
    readyForPaymentCount,
    refreshData,
  } = useDataContext();

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [approverFilter, setApproverFilter] = useState("all");
  const [nowMs, setNowMs] = useState(() => Date.now());

  React.useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Confirm on Behalf Modal State
  const [confirmModalTarget, setConfirmModalTarget] = useState<{
    batch: BatchRecord;
    step: StepInstanceRecord;
  } | null>(null);
  const [confirmNote, setConfirmNote] = useState("");
  const [isSubmittingConfirm, setIsSubmittingConfirm] = useState(false);
  const [confirmError, setConfirmError] = useState("");

  // Reassign Modal State
  const [reassignModalTarget, setReassignModalTarget] = useState<{
    batch: BatchRecord;
    step: StepInstanceRecord;
  } | null>(null);
  const [reassignContactId, setReassignContactId] = useState("");
  const [reassignReason, setReassignReason] = useState("");
  const [isSubmittingReassign, setIsSubmittingReassign] = useState(false);
  const [reassignError, setReassignError] = useState("");

  // Delete Batch Modal State
  const [deleteModalTarget, setDeleteModalTarget] = useState<BatchRecord | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Audit Slide-Over Sheet State
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [batchHistory, setBatchHistory] = useState<BatchHistoryRecord | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Notice Banner
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

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

  // Active batches sorted deterministically by urgency
  const sortedActiveBatches = useMemo(() => {
    return batches
      .filter((b) => b.status === "IN_PROGRESS")
      .filter((b) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const matchesId = b.id.toLowerCase().includes(q);
        const matchesBills = b.bills?.some((bill) => bill.billNumber?.toLowerCase().includes(q));
        return matchesId || matchesBills;
      })
      .filter((b) => {
        if (approverFilter === "all") return true;
        const alertedStep = b.stepInstances?.find(
          (s) => s.status === "ALERTED" || s.status === "ESCALATED"
        );
        return (
          alertedStep?.stage?.contact?.id === approverFilter ||
          alertedStep?.stage?.backupContact?.id === approverFilter
        );
      })
      .sort(compareActiveBatchesUrgency);
  }, [batches, searchQuery, approverFilter]);

  // Total monetary value across active batches in flight
  const activePipelineValue = useMemo(() => {
    return batches
      .filter((b) => b.status === "IN_PROGRESS" || b.status === "RETURNED")
      .reduce((total, b) => {
        const batchTotal = (b.bills ?? []).reduce((sum, bill) => sum + Number(bill.amount ?? 0), 0);
        return total + batchTotal;
      }, 0);
  }, [batches]);

  // Open Approval Magic Link
  const handleOpenMagicLink = async (stepId: string) => {
    if (!authToken) return;
    const apiBase = getApiBase();
    try {
      const response = await fetch(`${apiBase}/workflows/steps/${encodeURIComponent(stepId)}/approval-link`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!response.ok) throw new Error("Could not generate approval link");
      const data = (await response.json()) as { url: string; approverEmail: string };
      window.open(data.url, "_blank");
      setFeedbackNotice(`Opened signed magic link for ${data.approverEmail} in a new tab.`);
    } catch (err) {
      setFeedbackNotice(err instanceof Error ? err.message : "Could not open approval link.");
    }
  };

  // Submit 2-Step Confirm on Behalf
  const handleConfirmOnBehalf = async () => {
    if (!confirmModalTarget || !authToken || !currentUser) return;
    if (currentUser.role?.toLowerCase() !== "admin") {
      setConfirmError("Access denied: Only administrators can confirm on behalf of approvers.");
      return;
    }
    if (!isValidConfirmNote(confirmNote)) {
      setConfirmError("A confirmation note of at least 10 characters is required.");
      return;
    }
    const trimmed = confirmNote.trim();

    setIsSubmittingConfirm(true);
    setConfirmError("");
    const apiBase = getApiBase();

    try {
      const response = await authFetch(
        `${apiBase}/batches/${encodeURIComponent(confirmModalTarget.batch.id)}/steps/${encodeURIComponent(
          confirmModalTarget.step.id
        )}/confirm-on-behalf`,
        authToken,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: trimmed }),
        }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message || "Could not confirm on behalf of approver.");
      }

      setConfirmModalTarget(null);
      setConfirmNote("");
      setFeedbackNotice(
        `Batch ${formatBatchId(confirmModalTarget.batch.id)} confirmed on behalf of approver. Forwarded to next stage.`
      );
      await refreshData();
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "Confirmation failed.");
    } finally {
      setIsSubmittingConfirm(false);
    }
  };

  // Submit Reassignment
  const handleReassign = async () => {
    if (!reassignModalTarget || !authToken || !currentUser) return;
    if (currentUser.role?.toLowerCase() !== "admin") {
      setReassignError("Access denied: Only administrators can reassign workflow steps.");
      return;
    }
    if (!reassignContactId) {
      setReassignError("Please select a new approver.");
      return;
    }

    setIsSubmittingReassign(true);
    setReassignError("");
    const apiBase = getApiBase();

    try {
      const response = await authFetch(
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

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message || "Could not reassign step.");
      }

      setReassignModalTarget(null);
      setReassignContactId("");
      setReassignReason("");
      setFeedbackNotice("Step successfully reassigned. New approval link and OTP dispatched.");
      await refreshData();
    } catch (err) {
      setReassignError(err instanceof Error ? err.message : "Reassignment failed.");
    } finally {
      setIsSubmittingReassign(false);
    }
  };

  // Open Audit History Slide-Over Sheet
  const handleOpenHistory = async (batchId: string) => {
    setSelectedBatchId(batchId);
    setIsLoadingHistory(true);
    const apiBase = getApiBase();

    try {
      const response = await authFetch(`${apiBase}/batches/${encodeURIComponent(batchId)}/history`, authToken);
      if (response.ok) {
        const data = (await response.json()) as BatchHistoryRecord;
        setBatchHistory(data);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingHistory(false);
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
      setFeedbackNotice(`Batch ${formatBatchId(deleteModalTarget.id)} was successfully soft-deleted.`);
      await refreshData();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete batch.");
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  const greeting = getTimeGreeting();
  const firstName = currentUser?.name ? currentUser.name.split(" ")[0] : "Admin";

  return (
    <div className="command-center-container">
      {/* Page Heading */}
      <div className="section-heading" style={{ marginBottom: 20 }}>
        <div>
          <p className="eyebrow">ACCOUNTS RECEIVABLE OPERATIONS · COMMAND CENTER</p>
          <h2>
            {greeting}, {firstName}<span>.</span>
          </h2>
          <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: 13 }}>
            Command Center: &ldquo;Currently With&rdquo; — Live bottleneck triage and active approvals to unblock cash flow.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/batches" className="ui-button ui-button--primary ui-button--sm">
            <span>Full Batches Ledger →</span>
          </Link>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackNotice && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            background: "var(--brand-light)",
            border: "1px solid var(--brand-border)",
            borderRadius: "var(--radius-md)",
            marginBottom: 20,
            fontSize: 13,
            color: "var(--brand-primary)",
          }}
        >
          <span>{feedbackNotice}</span>
          <button
            type="button"
            onClick={() => setFeedbackNotice(null)}
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontWeight: 700 }}
          >
            ×
          </button>
        </div>
      )}

      {/* KPI Cards Row - Material Dashboard Floating Gradients */}
      <div className="metrics-grid" style={{ marginBottom: 24 }}>
        <MetricCard
          title="Active in Flight"
          value={inFlightCount}
          subtitle="Currently with approvers"
          icon={<Clock size={20} />}
          urgency="primary"
          badge={
            inFlightCount > 0 ? (
              <Badge variant="info">
                In Progress
              </Badge>
            ) : undefined
          }
        />
        <MetricCard
          title="Overdue / Critical"
          value={overdueCount}
          subtitle="Pending > 24h or Escalated"
          icon={<AlertTriangle size={20} />}
          urgency="urgent"
          badge={
            overdueCount > 0 ? (
              <Badge variant="urgent" icon={<AlertTriangle size={11} />}>
                Attention Needed
              </Badge>
            ) : undefined
          }
        />
        <MetricCard
          title="Ready for Payment"
          value={readyForPaymentCount}
          subtitle="All approval stages completed"
          icon={<CreditCard size={20} />}
          urgency="success"
          badge={
            readyForPaymentCount > 0 ? (
              <Badge variant="success" icon={<CheckCircle size={11} />}>
                Ready
              </Badge>
            ) : undefined
          }
        />
        <MetricCard
          title="Pipeline Value"
          value={formatCurrency(activePipelineValue)}
          subtitle="Across active in-flight batches"
          icon={<TrendingUp size={20} />}
          urgency="info"
        />
      </div>

      {/* Filter / Search Bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "10px 16px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-light)",
          borderRadius: "var(--radius-lg)",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 260px", maxWidth: 400, position: "relative" }}>
          <Search size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search by batch ID or invoice... (⌘K)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 13,
              color: "var(--text-primary)",
            }}
          />
          <kbd
            style={{
              fontSize: 10,
              padding: "2px 6px",
              borderRadius: 4,
              border: "1px solid var(--border-light)",
              background: "var(--bg-subtle)",
              color: "var(--text-muted)",
              fontFamily: "monospace",
              flexShrink: 0,
            }}
          >
            ⌘K
          </kbd>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Filter size={14} style={{ color: "var(--text-muted)" }} />
          <div style={{ position: "relative", display: "inline-block" }}>
            <select
              value={approverFilter}
              onChange={(e) => setApproverFilter(e.target.value)}
              style={{
                appearance: "none",
                WebkitAppearance: "none",
                padding: "6px 28px 6px 10px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-strong)",
                background: "var(--bg-surface)",
                fontSize: 12.5,
                fontWeight: 500,
                color: "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              <option value="all">All Approvers</option>
              {contacts
                .filter((c) => c.isActive)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.email})
                  </option>
                ))}
            </select>
            <ChevronDown
              size={13}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
                color: "var(--text-muted)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Urgent Bottlenecks Action Table */}
      <AIGradientBorder
        variant={sortedActiveBatches.length > 0 ? "urgent" : "success"}
        duration={5}
        style={{ marginBottom: 32 }}
      >
        <div style={{ background: "var(--bg-surface)", width: "100%" }}>
          <div
            style={{
              padding: "14px 18px",
              borderBottom: "1px solid var(--border-light)",
              background: "var(--bg-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <strong>Urgent Workflow Bottlenecks ({sortedActiveBatches.length})</strong>
            <small style={{ color: "var(--text-muted)", fontSize: 11 }}>
              Sorted by: Escalated First → Longest in Stage Descending
            </small>
          </div>

        {sortedActiveBatches.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)" }}>
            <CheckCircle size={32} style={{ color: "var(--brand-primary)", marginBottom: 8 }} />
            <p style={{ margin: 0, fontWeight: 600, color: "var(--text-primary)" }}>
              No active bottlenecks found!
            </p>
            <small>All in-flight batches are moving according to schedule.</small>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr
                  style={{
                    background: "var(--bg-subtle)",
                    borderBottom: "1px solid var(--border-light)",
                    color: "var(--text-secondary)",
                    textAlign: "left",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  <th style={{ padding: "10px 16px" }}>Batch & Value</th>
                  <th style={{ padding: "10px 16px" }}>Stage</th>
                  <th style={{ padding: "10px 16px" }}>Currently With</th>
                  <th style={{ padding: "10px 16px" }}>Time in Stage</th>
                  <th style={{ padding: "10px 16px" }}>Reminders</th>
                  <th style={{ padding: "10px 16px" }}>Latest Signal</th>
                  <th style={{ padding: "10px 16px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedActiveBatches.map((batch) => {
                  const alertedStep = batch.stepInstances?.find(
                    (s) => s.status === "ALERTED" || s.status === "ESCALATED"
                  );
                  const isEscalated = alertedStep?.status === "ESCALATED";

                  const totalAmount = (batch.bills ?? []).reduce(
                    (sum, b) => sum + Number(b.amount ?? 0),
                    0
                  );

                  const assignedContact = alertedStep?.stage?.contact;
                  const backupContact = alertedStep?.stage?.backupContact;

                  // Aging calculation
                  const alertedDate = alertedStep?.alertedAt ? new Date(alertedStep.alertedAt) : null;
                  const hoursInStage = alertedDate
                    ? Math.max(0, Math.round((nowMs - alertedDate.getTime()) / (1000 * 60 * 60)))
                    : null;
                  const isOverdue = isEscalated || (hoursInStage !== null && hoursInStage > 24);

                  return (
                    <tr
                      key={batch.id}
                      style={{
                        borderBottom: "1px solid var(--border-light)",
                        background: isEscalated
                          ? "var(--urgency-rose-bg)"
                          : isOverdue
                          ? "var(--urgency-amber-bg)"
                          : "transparent",
                      }}
                    >
                      {/* Batch & Value */}
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <strong style={{ fontFamily: "monospace", fontSize: 13, color: "var(--text-primary)" }}>
                            {formatBatchId(batch.id)}
                          </strong>
                          <span style={{ fontWeight: 650, color: "var(--text-primary)" }}>
                            {formatCurrency(totalAmount)}
                          </span>
                          <small style={{ color: "var(--text-muted)", fontSize: 11 }}>
                            {batch.bills?.length ?? 0} invoice{(batch.bills?.length ?? 0) === 1 ? "" : "s"}
                          </small>
                        </div>
                      </td>

                      {/* Stage */}
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontWeight: 600 }}>Stage {alertedStep?.stage?.order ?? 1}</span>
                        <br />
                        <small style={{ color: "var(--text-muted)" }}>
                          {batch.template?.name ?? "Standard Approval"}
                        </small>
                      </td>

                      {/* Currently With */}
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: "50%",
                              background: isEscalated ? "var(--urgency-rose)" : "var(--brand-primary)",
                              color: "var(--text-inverse)",
                              display: "grid",
                              placeItems: "center",
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            <UserCheck size={14} />
                          </div>
                          <div>
                            <strong>{assignedContact?.name ?? "Approver"}</strong>
                            <br />
                            <small style={{ color: "var(--text-muted)" }}>
                              {assignedContact?.email ?? "—"}
                            </small>
                            {backupContact && (
                              <small style={{ display: "block", color: "var(--brand-primary)", fontSize: 10 }}>
                                Backup: {backupContact.name}
                              </small>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Time in Stage */}
                      <td style={{ padding: "12px 16px" }}>
                        {hoursInStage !== null ? (
                          <Badge
                            variant={isEscalated ? "urgent" : isOverdue ? "warning" : "neutral"}
                            icon={
                              isEscalated ? (
                                <ShieldAlert size={12} />
                              ) : isOverdue ? (
                                <AlertTriangle size={12} />
                              ) : (
                                <Clock size={12} />
                              )
                            }
                          >
                            {isEscalated
                              ? `ESCALATED (${Math.round(hoursInStage / 24)}d)`
                              : hoursInStage > 24
                              ? `${Math.floor(hoursInStage / 24)}d ${hoursInStage % 24}h`
                              : `${hoursInStage} hour${hoursInStage === 1 ? "" : "s"}`}
                          </Badge>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>Just started</span>
                        )}
                      </td>

                      {/* Reminders Health */}
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontWeight: 600 }}>
                          {alertedStep?.reminderCount ?? 0} of {alertedStep?.stage?.maxReminders ?? 3}
                        </span>
                        <br />
                        <small style={{ color: "var(--text-muted)" }}>
                          Interval: {alertedStep?.stage?.reminderIntervalHours ?? 24}h
                        </small>
                      </td>

                      {/* Latest Signal */}
                      <td style={{ padding: "12px 16px", maxWidth: 220 }}>
                        {isEscalated ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "3px 8px",
                              background: "var(--urgency-rose-bg)",
                              color: "var(--urgency-rose)",
                              borderRadius: "var(--radius-sm)",
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            <ShieldAlert size={12} />
                            Escalated to backup
                          </span>
                        ) : (alertedStep?.reminderCount ?? 0) >= (alertedStep?.stage?.maxReminders ?? 3) ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "3px 8px",
                              background: "var(--urgency-amber-bg)",
                              color: "var(--urgency-amber-text)",
                              borderRadius: "var(--radius-sm)",
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            <BellRing size={12} />
                            Max reminders reached
                          </span>
                        ) : alertedStep?.lastComment ? (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "3px 8px",
                              background: "rgba(0,0,0,0.04)",
                              borderRadius: "var(--radius-sm)",
                              fontSize: 11,
                              color: "var(--text-secondary)",
                              fontStyle: "italic",
                            }}
                            title={alertedStep.lastComment}
                          >
                            &ldquo;{alertedStep.lastComment.slice(0, 45)}
                            {alertedStep.lastComment.length > 45 ? "..." : ""}&rdquo;
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>—</span>
                        )}
                      </td>

                      {/* Inline Actions */}
                      <td style={{ padding: "12px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", gap: 6, alignItems: "center", justifyContent: "flex-end" }}>
                          {alertedStep && currentUser?.role?.toLowerCase() === "admin" ? (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() =>
                                setConfirmModalTarget({
                                  batch,
                                  step: alertedStep,
                                })
                              }
                              title="Authorize offline phone or verbal sign-off"
                            >
                              Confirm
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => void handleOpenHistory(batch.id)}
                              leftIcon={<History size={12} />}
                              title="Inspect full audit trail"
                            >
                              Audit
                            </Button>
                          )}

                          <ActionDropdown
                            items={[
                              ...(alertedStep && currentUser?.role?.toLowerCase() === "admin"
                                ? [
                                    {
                                      label: "Reassign Approver",
                                      icon: <UserX size={14} />,
                                      onClick: () =>
                                        setReassignModalTarget({
                                          batch,
                                          step: alertedStep,
                                        }),
                                    },
                                  ]
                                : []),
                              ...(alertedStep
                                ? [
                                    {
                                      label: "Open Magic Link",
                                      icon: <ExternalLink size={14} />,
                                      onClick: () => void handleOpenMagicLink(alertedStep.id),
                                    },
                                  ]
                                : []),
                              {
                                label: "View Audit Trail",
                                icon: <History size={14} />,
                                onClick: () => void handleOpenHistory(batch.id),
                              },
                              {
                                label: "Batch Details Page",
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
                })}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </AIGradientBorder>

      {/* Ready for Payment Banner */}
      {readyForPaymentCount > 0 && (
        <AIGradientBorder variant="success" duration={4} style={{ marginBottom: 32 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 20px",
              background: "var(--bg-surface)",
              width: "100%",
            }}
          >
            <div>
              <strong style={{ fontSize: 14, color: "var(--text-primary)" }}>
                {readyForPaymentCount} batch{readyForPaymentCount === 1 ? "" : "es"} completed approval and ready for settlement
              </strong>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
                All stage sign-offs have been authorized. The finance team can now record bank transfers and upload proofs.
              </p>
            </div>
            <Link href="/payments" className="ui-button ui-button--primary ui-button--md">
              <span>Open Settlement Ledger</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </AIGradientBorder>
      )}

      {/* 2-Step Confirm on Behalf Modal */}
      {confirmModalTarget && (
        <ModalDialog
          isOpen={Boolean(confirmModalTarget)}
          onClose={() => setConfirmModalTarget(null)}
          title="Confirm on Behalf of Approver"
          description="Authorizing this batch on behalf of the approver advances the workflow to the next stage."
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
                <strong>Batch:</strong> {formatBatchId(confirmModalTarget.batch.id)}
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
                placeholder="e.g. Approved verbally via phone call with Director Rajesh at 11:30 AM..."
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
              <Button
                variant="secondary"
                onClick={() => setConfirmModalTarget(null)}
                disabled={isSubmittingConfirm}
              >
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

      {/* Inline Reassign Modal */}
      {reassignModalTarget && (
        <ModalDialog
          isOpen={Boolean(reassignModalTarget)}
          onClose={() => setReassignModalTarget(null)}
          title="Reassign Workflow Step"
          description="Transfer responsibility for this approval stage to another active contact."
        >
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 6,
                }}
              >
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
                  .filter(
                    (c) =>
                      c.isActive &&
                      c.id !== reassignModalTarget.step.stage?.contact?.id
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.email}) - {c.role}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 6,
                }}
              >
                Reason for Reassignment (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Primary approver on annual leave"
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
              <Button
                variant="secondary"
                onClick={() => setReassignModalTarget(null)}
                disabled={isSubmittingReassign}
              >
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
          description="Are you sure you want to delete this approval batch and its associated invoices?"
        >
          <div style={{ display: "grid", gap: 14 }}>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 8,
                background: "var(--urgency-rose-bg)",
                border: "1px solid var(--urgency-rose-border)",
                color: "var(--urgency-rose)",
              }}
            >
              <p style={{ margin: 0, fontWeight: 600 }}>This action soft-deletes the batch from the active ledger.</p>
              <p style={{ margin: "4px 0 0", fontSize: 12 }}>
                Batch {formatBatchId(deleteModalTarget.id)} with {(deleteModalTarget.bills ?? []).length} invoices will be removed.
              </p>
            </div>

            {deleteError && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 6,
                  background: "var(--urgency-rose-bg)",
                  border: "1px solid var(--urgency-rose)",
                  color: "var(--urgency-rose)",
                  fontSize: 13,
                }}
              >
                {deleteError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDeleteModalTarget(null)}
                disabled={isSubmittingDelete}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => void handleDeleteBatch()}
                isLoading={isSubmittingDelete}
              >
                Delete Batch
              </Button>
            </div>
          </div>
        </ModalDialog>
      )}

      {/* Slide-Over Audit Sheet */}
      <SlideOverSheet
        isOpen={Boolean(selectedBatchId)}
        onClose={() => {
          setSelectedBatchId(null);
          setBatchHistory(null);
        }}
        title={`Audit Trail: Batch ${formatBatchId(selectedBatchId)}`}
        description="Complete chronological timeline of workflow dispatches, sign-offs, and reminders."
      >
        {isLoadingHistory ? (
          <div style={{ padding: "30px 0", textAlign: "center", color: "var(--text-muted)" }}>
            Loading audit history...
          </div>
        ) : batchHistory ? (
          <div style={{ display: "grid", gap: 20 }}>
            {/* Batch Overview */}
            <div
              style={{
                padding: "14px",
                background: "var(--bg-subtle)",
                borderRadius: "var(--radius-md)",
                fontSize: 12,
              }}
            >
              <div>
                <strong>Status:</strong> {batchHistory.status}
              </div>
              <div>
                <strong>Organization:</strong> {batchHistory.organization?.name}
              </div>
              <div>
                <strong>Workflow Template:</strong> {batchHistory.template?.name}
              </div>
              <div>
                <strong>Total Invoices:</strong> {batchHistory.bills?.length ?? 0}
              </div>
            </div>

            {/* Stages Progress */}
            <div>
              <strong style={{ fontSize: 13, display: "block", marginBottom: 10 }}>
                Workflow Stages
              </strong>
              <div style={{ display: "grid", gap: 8 }}>
                {batchHistory.stepInstances?.map((stg) => (
                  <div
                    key={stg.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      border: "1px solid var(--border-light)",
                      borderRadius: "var(--radius-md)",
                      fontSize: 12,
                    }}
                  >
                    <div>
                      <strong>Stage {stg.stage?.order}:</strong> {stg.stage?.contact?.name}
                      <small style={{ display: "block", color: "var(--text-muted)" }}>
                        {stg.stage?.contact?.email}
                      </small>
                    </div>
                    <Badge
                      variant={
                        stg.status === "COMPLETED"
                          ? "success"
                          : stg.status === "ALERTED"
                          ? "warning"
                          : "neutral"
                      }
                    >
                      {stg.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Chronological Audit Logs */}
            <div>
              <strong style={{ fontSize: 13, display: "block", marginBottom: 10 }}>
                Audit Events ({batchHistory.auditLogs?.length ?? 0})
              </strong>
              <div style={{ display: "grid", gap: 8 }}>
                {batchHistory.auditLogs?.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      padding: "10px 12px",
                      border: "1px solid var(--border-light)",
                      borderRadius: "var(--radius-md)",
                      background: "var(--bg-surface)",
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <strong style={{ textTransform: "capitalize" }}>
                        {log.action.replace(/_/g, " ")}
                      </strong>
                      <small style={{ color: "var(--text-muted)" }}>
                        {new Date(log.createdAt).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                    </div>
                    <small style={{ color: "var(--text-secondary)", display: "block" }}>
                      Actor: {log.actor}
                    </small>
                    {log.detail && (
                      <pre
                        style={{
                          margin: "6px 0 0",
                          padding: "6px",
                          background: "var(--bg-subtle)",
                          borderRadius: "var(--radius-sm)",
                          fontSize: 11,
                          overflowX: "auto",
                        }}
                      >
                        {JSON.stringify(log.detail, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: "20px 0", color: "var(--text-muted)" }}>
            No audit records found for this batch.
          </div>
        )}
      </SlideOverSheet>
    </div>
  );
}
