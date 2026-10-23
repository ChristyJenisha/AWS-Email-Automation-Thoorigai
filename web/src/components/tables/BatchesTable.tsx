"use client";

import React from "react";
import { History, Trash2, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { AppUser, BatchRecord } from "../../types";
import { formatCurrency, formatBatchId } from "../../lib/utils";

type BatchFilterType = "ALL" | "IN_PROGRESS" | "READY_FOR_PAYMENT" | "COMPLETED";

type BatchesTableProps = {
  liveBatches: BatchRecord[];
  batchFilter: BatchFilterType;
  setBatchFilter: (filter: BatchFilterType) => void;
  currentUser: AppUser | null;
  onOpenBatchHistory: (batchId: string) => Promise<void>;
  onDeleteBatch: (batchId: string) => Promise<void>;
};

const BATCH_FILTER_TABS: Array<{ id: BatchFilterType; label: string }> = [
  { id: "ALL", label: "All batches" },
  { id: "IN_PROGRESS", label: "In progress" },
  { id: "READY_FOR_PAYMENT", label: "Ready for payment" },
  { id: "COMPLETED", label: "Completed" },
];

export function BatchesTable({
  liveBatches,
  batchFilter,
  setBatchFilter,
  currentUser,
  onOpenBatchHistory,
  onDeleteBatch,
}: BatchesTableProps) {
  const filteredBatches = liveBatches.filter(
    (b) => batchFilter === "ALL" || b.status === batchFilter
  );

  return (
    <section className="bills-section batches-section" id="batches">
      <div className="section-heading">
        <div>
          <p className="eyebrow">WORKFLOW & AUDIT TRAIL</p>
          <h2>
            Approval batches <span className="section-total">{liveBatches.length}</span>
          </h2>
        </div>
      </div>

      <div className="table-toolbar">
        <div className="filter-tabs" role="tablist" aria-label="Filter batches">
          {BATCH_FILTER_TABS.map((tab) => {
            const count =
              tab.id === "ALL"
                ? liveBatches.length
                : liveBatches.filter((b) => b.status === tab.id).length;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={batchFilter === tab.id}
                className={`filter-tab ${batchFilter === tab.id ? "selected" : ""}`}
                onClick={() => setBatchFilter(tab.id)}
              >
                {tab.label}
                <span>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Batch ID</th>
              <th>Workflow stage</th>
              <th>Status</th>
              <th>Bills count</th>
              <th className="amount-heading">Total / Remaining</th>
              <th style={{ textAlign: "right" }}>Audit trail</th>
            </tr>
          </thead>
          <tbody>
            {filteredBatches.length === 0 ? (
              <tr>
                <td className="empty-state" colSpan={6} style={{ textAlign: "center", padding: "40px 16px", color: "var(--muted)" }}>
                  <Clock size={24} style={{ margin: "0 auto 8px auto", display: "block", opacity: 0.5 }} />
                  {liveBatches.length === 0
                    ? "No batches created yet. Click 'Create batch' above to start your approval workflow."
                    : "No batches found in this status category."}
                </td>
              </tr>
            ) : (
              filteredBatches.map((batch) => {
                const totalBatchAmount = (batch.bills ?? []).reduce(
                  (sum, bill) => sum + Number(bill.amount ?? 0),
                  0
                );
                const totalRemaining = (batch.bills ?? []).reduce(
                  (sum, bill) => sum + Number(bill.balanceDue ?? 0),
                  0
                );
                const activeStep = batch.stepInstances?.find((s) => s.status === "ALERTED");

                return (
                  <tr key={batch.id}>
                    <td>
                      <span className="batch-id-tag">Batch {formatBatchId(batch.id)}</span>
                    </td>
                    <td>
                      <span className="stage-info">
                        Stage {activeStep?.stage?.order ?? batch.stepInstances?.length ?? 1} ·{" "}
                        {activeStep?.stage?.contact?.name ?? "Completed"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`status-pill status-${
                          batch.status?.toLowerCase().replace(/_/g, "-") ?? "in-progress"
                        }`}
                      >
                        <i />
                        {batch.status ?? "IN_PROGRESS"}
                      </span>
                    </td>
                    <td>{(batch.bills ?? []).length} bill(s)</td>
                    <td className="amount-cell">
                      <strong>{formatCurrency(totalBatchAmount)}</strong>
                      <small>{formatCurrency(totalRemaining)} remaining</small>
                    </td>
                    <td className="action-cell" style={{ textAlign: "right" }}>
                      <div className="batch-action-btns">
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => void onOpenBatchHistory(batch.id)}
                        >
                          <History size={13} />
                          <span>Audit trail & details →</span>
                        </button>
                          <button
                            className="secondary-button danger-btn"
                            type="button"
                            onClick={() => void onDeleteBatch(batch.id)}
                            title="Delete this batch and all its bills"
                          >
                            <Trash2 size={13} />
                            <span>Delete</span>
                          </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

