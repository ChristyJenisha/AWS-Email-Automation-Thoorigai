"use client";

import React from "react";
import { X, Layers, FileSpreadsheet, ShieldAlert, MailCheck, Clock, CheckCircle2, AlertTriangle, RotateCcw } from "lucide-react";
import { BatchHistoryRecord } from "../../types";
import { formatCurrency } from "../../lib/utils";

type HistoryTab = "stages" | "bills" | "audit" | "notifications";

type BatchHistoryDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  selectedBatchHistory: BatchHistoryRecord | null;
  historyTab: HistoryTab;
  setHistoryTab: (tab: HistoryTab) => void;
};

export function BatchHistoryDrawer({
  isOpen,
  onClose,
  isLoading,
  selectedBatchHistory,
  historyTab,
  setHistoryTab,
}: BatchHistoryDrawerProps) {
  if (!isOpen) return null;

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="bill-dialog batch-history-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-dialog-title"
      >
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">AUDIT TRAIL & LIFECYCLE</p>
            <h2 id="history-dialog-title">
              Batch {selectedBatchHistory?.id.slice(0, 8)} Details
            </h2>
          </div>
          <button className="dialog-close" type="button" onClick={onClose} aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>

        {isLoading ? (
          <div className="loading-state-box">
            <Clock size={20} className="rotating" />
            <p>Loading batch audit records and history...</p>
          </div>
        ) : selectedBatchHistory ? (
          <>
            <div className="history-overview-grid">
              <div className="history-overview-box">
                <small>Status</small>
                <strong>
                  <span
                    className={`status-pill status-${
                      selectedBatchHistory.status?.toLowerCase().replace(/_/g, "-") ?? "in-progress"
                    }`}
                  >
                    <i />
                    {selectedBatchHistory.status}
                  </span>
                </strong>
              </div>
              <div className="history-overview-box">
                <small>Template</small>
                <strong>{selectedBatchHistory.template?.name || "Standard Workflow"}</strong>
              </div>
              <div className="history-overview-box">
                <small>Bills Total</small>
                <strong>
                  {formatCurrency(
                    (selectedBatchHistory.bills ?? []).reduce(
                      (sum, b) => sum + Number(b.amount ?? 0),
                      0
                    )
                  )}
                </strong>
              </div>
              <div className="history-overview-box">
                <small>Created</small>
                <strong>
                  {selectedBatchHistory.createdAt
                    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
                        new Date(selectedBatchHistory.createdAt)
                      )
                    : "Recent"}
                </strong>
              </div>
            </div>

            <div className="history-tabs">
              <button
                className={`history-tab ${historyTab === "stages" ? "active" : ""}`}
                onClick={() => setHistoryTab("stages")}
              >
                <Layers size={13} />
                <span>Stages ({selectedBatchHistory.stepInstances?.length ?? 0})</span>
              </button>
              <button
                className={`history-tab ${historyTab === "bills" ? "active" : ""}`}
                onClick={() => setHistoryTab("bills")}
              >
                <FileSpreadsheet size={13} />
                <span>Bills ({selectedBatchHistory.bills?.length ?? 0})</span>
              </button>
              <button
                className={`history-tab ${historyTab === "audit" ? "active" : ""}`}
                onClick={() => setHistoryTab("audit")}
              >
                <ShieldAlert size={13} />
                <span>Audit Trail ({selectedBatchHistory.auditLogs?.length ?? 0})</span>
              </button>
              <button
                className={`history-tab ${historyTab === "notifications" ? "active" : ""}`}
                onClick={() => setHistoryTab("notifications")}
              >
                <MailCheck size={13} />
                <span>Email Log ({selectedBatchHistory.notifications?.length ?? 0})</span>
              </button>
            </div>

            {historyTab === "stages" && (
              <div className="timeline-stages">
                {(selectedBatchHistory.stepInstances ?? []).map((step) => {
                  const isDone = step.status === "COMPLETED";
                  const isAlerted = step.status === "ALERTED";
                  const isReturned = step.status === "RETURNED";
                  return (
                    <div
                      key={step.id}
                      className={`timeline-stage-card ${
                        isDone ? "completed" : isAlerted ? "alerted" : isReturned ? "returned" : ""
                      }`}
                    >
                      <div className="timeline-stage-header">
                        <div>
                          <strong>
                            Stage {step.stage?.order}: {step.stage?.contact?.name ?? "Approver"}
                          </strong>
                          <span className="approver-email-sub">
                            ({step.stage?.contact?.email})
                          </span>
                        </div>
                        <span
                          className={`status-pill status-${step.status?.toLowerCase() ?? "pending"}`}
                        >
                          <i />
                          {step.status}
                        </span>
                      </div>
                      {step.stage?.backupContact && (
                        <div className="backup-approver-note">
                          Backup Approver: {step.stage.backupContact.name} (
                          {step.stage.backupContact.email})
                        </div>
                      )}
                      {step.lastComment && (
                        <div className="timeline-last-comment">
                          💬 {step.lastComment}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {historyTab === "bills" && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Bill Number</th>
                      <th>Due Date</th>
                      <th>Status</th>
                      <th className="amount-heading">Amount / Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedBatchHistory.bills ?? []).map((bill) => (
                      <tr key={bill.id ?? bill.billNumber}>
                        <td>
                          <strong>{bill.billNumber}</strong>
                        </td>
                        <td>
                          {bill.dueDate
                            ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
                                new Date(bill.dueDate)
                              )
                            : "—"}
                        </td>
                        <td>
                          <span
                            className={`status-pill status-${
                              bill.status?.toLowerCase() ?? "pending"
                            }`}
                          >
                            <i />
                            {bill.status}
                          </span>
                        </td>
                        <td className="amount-cell">
                          {formatCurrency(Number(bill.amount ?? 0))}
                          <small>
                            {formatCurrency(Number(bill.balanceDue ?? 0))} remaining
                          </small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {historyTab === "audit" && (
              <div className="audit-list">
                {(selectedBatchHistory.auditLogs ?? []).map((log) => (
                  <div className="audit-entry" key={log.id}>
                    <div>
                      <div className="audit-header-tags">
                        <span className="status-pill status-ready-for-payment">{log.action}</span>
                        <span className="audit-entry-actor">{log.actor}</span>
                      </div>
                      {log.detail && (
                        <div className="audit-entry-detail">
                          {typeof log.detail === "object"
                            ? JSON.stringify(log.detail)
                            : String(log.detail)}
                        </div>
                      )}
                    </div>
                    <div className="audit-entry-time">
                      {new Intl.DateTimeFormat("en-IN", {
                        dateStyle: "short",
                        timeStyle: "medium",
                      }).format(new Date(log.createdAt))}
                    </div>
                  </div>
                ))}
                {(selectedBatchHistory.auditLogs?.length ?? 0) === 0 && (
                  <p className="empty-state">No audit logs recorded for this batch yet.</p>
                )}
              </div>
            )}

            {historyTab === "notifications" && (
              <div className="notif-list">
                {(selectedBatchHistory.notifications ?? []).map((notif) => (
                  <div className="notif-item" key={notif.id}>
                    <div>
                      <strong>{notif.recipient}</strong>
                      <div className="notif-subtext">
                        {notif.sentAt
                          ? `Sent at ${new Intl.DateTimeFormat("en-IN", {
                              dateStyle: "short",
                              timeStyle: "medium",
                            }).format(new Date(notif.sentAt))}`
                          : "Pending delivery"}
                        {notif.error && (
                          <span className="notif-error">Error: {notif.error}</span>
                        )}
                      </div>
                    </div>
                    <span className={`status-pill status-${notif.status.toLowerCase()}`}>
                      <i />
                      {notif.status}
                    </span>
                  </div>
                ))}
                {(selectedBatchHistory.notifications?.length ?? 0) === 0 && (
                  <p className="empty-state">
                    No email notifications recorded for this batch yet.
                  </p>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="approval-error">Batch details could not be found.</p>
        )}

        <div className="dialog-actions" style={{ marginTop: 20 }}>
          <button className="primary-button" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </section>
    </div>
  );
}

