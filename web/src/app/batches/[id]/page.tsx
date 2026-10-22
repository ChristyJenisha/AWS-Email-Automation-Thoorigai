"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { useDataContext } from "../../../lib/DataContext";
import { authFetch, getApiBase } from "../../../lib/api";
import { BatchHistoryRecord } from "../../../types";
import { formatCurrency } from "../../../lib/utils";
import { Badge } from "../../../components/ui";

export default function BatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const batchId = resolvedParams.id;
  const { authToken } = useDataContext();

  const [history, setHistory] = useState<BatchHistoryRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchHistory = async () => {
      setIsLoading(true);
      setError(null);
      const apiBase = getApiBase();

      try {
        const response = await authFetch(
          `${apiBase}/batches/${encodeURIComponent(batchId)}/history`,
          authToken
        );
        if (!response.ok) {
          throw new Error(`Batch not found or unauthorized (${response.status})`);
        }
        const data = (await response.json()) as BatchHistoryRecord;
        if (isMounted) setHistory(data);
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load batch");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void fetchHistory();
    return () => {
      isMounted = false;
    };
  }, [batchId, authToken]);

  if (isLoading) {
    return (
      <div className="page-container" style={{ padding: "40px 0", textAlign: "center" }}>
        <Clock size={28} className="ui-button__spinner" style={{ color: "var(--brand-primary)", marginBottom: 12 }} />
        <p style={{ color: "var(--text-secondary)" }}>Loading batch details #{batchId}...</p>
      </div>
    );
  }

  if (error || !history) {
    return (
      <div className="page-container" style={{ padding: "40px 0", textAlign: "center" }}>
        <AlertTriangle size={32} style={{ color: "var(--urgency-rose)", marginBottom: 12 }} />
        <h3 style={{ margin: "0 0 8px", color: "var(--text-primary)" }}>Batch Not Found</h3>
        <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>{error ?? "Unable to locate batch."}</p>
        <Link href="/batches" className="ui-button ui-button--secondary ui-button--md">
          <ArrowLeft size={14} />
          <span>Back to Batches Ledger</span>
        </Link>
      </div>
    );
  }

  const totalAmount = (history.bills ?? []).reduce((sum, b) => sum + Number(b.amount ?? 0), 0);
  const totalBalanceDue = (history.bills ?? []).reduce((sum, b) => sum + Number(b.balanceDue ?? 0), 0);

  return (
    <div className="page-container">
      {/* Top Navigation Breadcrumb */}
      <div style={{ marginBottom: 20 }}>
        <Link
          href="/batches"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "var(--text-secondary)",
            fontSize: 13,
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={14} />
          <span>Back to Batches Ledger</span>
        </Link>
      </div>

      {/* Header Info Banner */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          padding: "20px 24px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-light)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-sm)",
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700 }}>
              Batch #{history.id.slice(0, 8)}
            </span>
            <Badge
              variant={
                history.status === "COMPLETED"
                  ? "success"
                  : history.status === "READY_FOR_PAYMENT"
                  ? "info"
                  : "warning"
              }
            >
              {history.status?.replace(/_/g, " ")}
            </Badge>
          </div>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 13 }}>
            Template: <strong>{history.template?.name ?? "Standard Approval"}</strong> · Organization:{" "}
            <strong>{history.organization?.name ?? "Thoorigai Infotech"}</strong>
          </p>
        </div>

        <div style={{ textAlign: "right" }}>
          <small style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase" }}>
            Total Invoiced
          </small>
          <div style={{ fontSize: 22, fontWeight: 750, color: "var(--text-primary)" }}>
            {formatCurrency(totalAmount)}
          </div>
          <small style={{ color: "var(--urgency-amber-text)", fontSize: 12 }}>
            Balance Due: {formatCurrency(totalBalanceDue)}
          </small>
        </div>
      </div>

      {/* Two Column Layout: Workflow Stages & Invoices */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 28 }}>
        {/* Stages Progress */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-light)",
            borderRadius: "var(--radius-lg)",
            padding: "20px",
          }}
        >
          <h3 style={{ margin: "0 0 16px", fontSize: 15, color: "var(--text-primary)" }}>
            Approval Stages ({history.stepInstances?.length ?? 0})
          </h3>
          <div style={{ display: "grid", gap: 10 }}>
            {history.stepInstances?.map((stg) => (
              <div
                key={stg.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  border: "1px solid var(--border-light)",
                  borderRadius: "var(--radius-md)",
                  background:
                    stg.status === "ALERTED"
                      ? "var(--urgency-amber-bg)"
                      : stg.status === "ESCALATED"
                      ? "var(--urgency-rose-bg)"
                      : "var(--bg-subtle)",
                }}
              >
                <div>
                  <strong style={{ fontSize: 13 }}>Stage {stg.stage?.order}:</strong>{" "}
                  <span>{stg.stage?.contact?.name ?? "Approver"}</span>
                  <small style={{ display: "block", color: "var(--text-muted)", fontSize: 11 }}>
                    {stg.stage?.contact?.email}
                  </small>
                  {stg.lastComment && (
                    <small
                      style={{
                        display: "block",
                        marginTop: 4,
                        fontStyle: "italic",
                        color: "var(--text-secondary)",
                      }}
                    >
                      &ldquo;{stg.lastComment}&rdquo;
                    </small>
                  )}
                </div>
                <Badge
                  variant={
                    stg.status === "COMPLETED"
                      ? "success"
                      : stg.status === "ALERTED"
                      ? "warning"
                      : stg.status === "ESCALATED"
                      ? "urgent"
                      : "neutral"
                  }
                >
                  {stg.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Invoice Items */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-light)",
            borderRadius: "var(--radius-lg)",
            padding: "20px",
          }}
        >
          <h3 style={{ margin: "0 0 16px", fontSize: 15, color: "var(--text-primary)" }}>
            Invoices in Batch ({history.bills?.length ?? 0})
          </h3>
          <div style={{ display: "grid", gap: 8 }}>
            {history.bills?.map((bill) => (
              <div
                key={bill.id}
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
                  <strong style={{ fontFamily: "monospace" }}>{bill.billNumber}</strong>
                  {bill.dueDate && (
                    <small style={{ display: "block", color: "var(--text-muted)" }}>
                      Due: {new Date(bill.dueDate).toLocaleDateString("en-IN")}
                    </small>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <strong>{formatCurrency(Number(bill.amount ?? 0))}</strong>
                  <small style={{ display: "block", color: "var(--text-muted)" }}>
                    Due: {formatCurrency(Number(bill.balanceDue ?? 0))}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chronological Audit Trail */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-light)",
          borderRadius: "var(--radius-lg)",
          padding: "20px 24px",
          marginBottom: 32,
        }}
      >
        <h3 style={{ margin: "0 0 16px", fontSize: 15, color: "var(--text-primary)" }}>
          Audit Trail ({history.auditLogs?.length ?? 0} events)
        </h3>
        <div style={{ display: "grid", gap: 10 }}>
          {history.auditLogs?.map((log) => (
            <div
              key={log.id}
              style={{
                padding: "12px 14px",
                border: "1px solid var(--border-light)",
                borderRadius: "var(--radius-md)",
                background: "var(--bg-surface)",
                fontSize: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <strong style={{ textTransform: "capitalize", color: "var(--text-primary)" }}>
                  {log.action.replace(/_/g, " ")}
                </strong>
                <small style={{ color: "var(--text-muted)" }}>
                  {new Date(log.createdAt).toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </small>
              </div>
              <small style={{ color: "var(--text-secondary)", display: "block" }}>
                Actor: <strong>{log.actor}</strong>
              </small>
              {log.detail && (
                <pre
                  style={{
                    margin: "8px 0 0",
                    padding: "8px 10px",
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
  );
}
