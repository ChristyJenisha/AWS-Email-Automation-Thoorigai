"use client";

import React from "react";
import { Clock, UserCheck, ArrowRight, ExternalLink, AlertTriangle, CheckCircle, ChevronRight, Layers, FileText } from "lucide-react";
import { AppUser, BatchRecord } from "../../types";
import { formatCurrency } from "../../lib/utils";

type CompactPipelineSectionProps = {
  liveBatches: BatchRecord[];
  currentUser: AppUser | null;
  onOpenApprovalLink: (stepId: string) => Promise<void>;
  onNavigateToPipeline: () => void;
  onOpenBatchHistory: (batchId: string) => Promise<void>;
};

export function CompactPipelineSection({
  liveBatches,
  onOpenApprovalLink,
  onNavigateToPipeline,
  onOpenBatchHistory,
}: CompactPipelineSectionProps) {
  const activeBatches = liveBatches.filter(
    (b) => b.status === "IN_PROGRESS" || b.status === "READY_FOR_PAYMENT"
  );

  if (activeBatches.length === 0) {
    return (
      <div className="compact-pipeline-card empty">
        <div className="empty-pipeline-inner">
          <Clock size={24} className="text-muted" style={{ opacity: 0.6 }} />
          <div>
            <strong>No approvals currently in flight</strong>
            <p>All bills are settled. Use <strong>+ New Action</strong> above to submit a new bill for approval.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="compact-pipeline-card" aria-label="Active Approvals Summary">
      <div className="compact-pipeline-header">
        <div>
          <span className="section-eyebrow">IN-FLIGHT APPROVALS</span>
          <h2 className="compact-pipeline-title">
            Active Approval Pipeline{" "}
            <span className="active-count-tag">{activeBatches.length} in flight</span>
          </h2>
          <p className="compact-pipeline-sub">
            Track which approver currently holds each bill. Click <strong>Review in Pipeline</strong> for full stepper and decision controls.
          </p>
        </div>

        <button
          type="button"
          className="pipeline-tab-switch-btn"
          onClick={onNavigateToPipeline}
          title="Open the full interactive pipeline inspector"
        >
          <span>Open Full Pipeline Board</span>
          <ArrowRight size={14} />
        </button>
      </div>

      <div className="compact-pipeline-table-wrap">
        <table className="compact-pipeline-table">
          <thead>
            <tr>
              <th>Invoice / Batch</th>
              <th>Total Amount</th>
              <th>Current Stage</th>
              <th>Currently With</th>
              <th>Next Action</th>
              <th style={{ textAlign: "right" }}>Quick Action</th>
            </tr>
          </thead>
          <tbody>
            {activeBatches.map((batch) => {
              const alertedStep = batch.stepInstances?.find((s) => s.status === "ALERTED");
              const completedSteps = batch.stepInstances?.filter((s) => s.status === "COMPLETED") ?? [];
              const totalSteps = batch.stepInstances?.length ?? 1;
              const currentStageOrder = alertedStep?.stage?.order ?? completedSteps.length + 1;
              const isReady = batch.status === "READY_FOR_PAYMENT";
              const assignedContact = alertedStep?.stage?.contact;
              const isSingleBill = (batch.bills?.length ?? 0) === 1;
              const billTitle = isSingleBill
                ? batch.bills?.[0]?.billNumber || `Bill ${batch.id.slice(0, 8)}`
                : `Batch ${batch.id.slice(0, 8)} (${batch.bills?.length ?? 0} bills)`;

              const totalAmount = (batch.bills ?? []).reduce(
                (sum, b) => sum + Number(b.amount ?? 0),
                0
              );

              return (
                <tr key={batch.id}>
                  <td>
                    <div className="compact-item-info">
                      <div className="compact-item-icon">
                        {isSingleBill ? <FileText size={14} /> : <Layers size={14} />}
                      </div>
                      <div>
                        <strong>{billTitle}</strong>
                        <span className="compact-type-badge">
                          {isSingleBill ? "Single Bill" : `${batch.bills?.length} Invoices`}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td>
                    <span className="compact-amount">{formatCurrency(totalAmount)}</span>
                  </td>

                  <td>
                    <span className="stage-pill-compact">
                      Stage {currentStageOrder} of {totalSteps}
                    </span>
                  </td>

                  <td>
                    <div className="compact-approver">
                      <UserCheck size={14} className="text-forest" />
                      <div>
                        <strong>{isReady ? "Finance / Settlement" : assignedContact?.name ?? "Approver"}</strong>
                        {!isReady && assignedContact?.email && (
                          <small className="compact-email">{assignedContact.email}</small>
                        )}
                      </div>
                    </div>
                  </td>

                  <td>
                    {isReady ? (
                      <span className="compact-status-pill ready">
                        <CheckCircle size={12} /> Ready for Settlement
                      </span>
                    ) : (
                      <span className="compact-status-pill pending">
                        <Clock size={12} /> Awaiting OTP Sign-off
                      </span>
                    )}
                  </td>

                  <td style={{ textAlign: "right" }}>
                    <div className="compact-actions-row">
                      {alertedStep && !isReady && (
                        <button
                          type="button"
                          className="compact-action-btn magic"
                          onClick={() => void onOpenApprovalLink(alertedStep.id)}
                          title="Open the approver magic link in new tab"
                        >
                          <ExternalLink size={12} />
                          <span>Magic Link ↗</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="compact-action-btn view"
                        onClick={onNavigateToPipeline}
                        title="View full stepper in Approval Pipeline"
                      >
                        <span>Review & Approve</span>
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

