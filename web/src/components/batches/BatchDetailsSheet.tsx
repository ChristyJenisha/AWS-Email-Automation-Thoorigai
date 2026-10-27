"use client";

import React from "react";
import Link from "next/link";
import { Clock, ExternalLink } from "lucide-react";
import { SlideOverSheet, Badge } from "../ui";
import { formatBatchId, formatCurrency } from "../../lib/utils";
import { BatchHistoryRecord } from "../../types";

interface BatchDetailsSheetProps {
  selectedBatchId: string | null;
  onClose: () => void;
  isLoadingHistory: boolean;
  batchHistory: BatchHistoryRecord | null;
}

export function BatchDetailsSheet({
  selectedBatchId,
  onClose,
  isLoadingHistory,
  batchHistory,
}: BatchDetailsSheetProps) {
  return (
    <SlideOverSheet
      isOpen={Boolean(selectedBatchId)}
      onClose={onClose}
      title={`Audit Trail: Batch ${formatBatchId(selectedBatchId)}`}
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
  );
}
