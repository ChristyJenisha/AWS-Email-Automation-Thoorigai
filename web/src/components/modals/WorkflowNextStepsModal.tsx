"use client";

import React from "react";
import { X, CheckCircle2, ArrowRight, ExternalLink, ShieldCheck, Mail, CreditCard, Clock, FileCheck } from "lucide-react";
import { BatchRecord } from "../../types";
import { formatCurrency, formatBatchId } from "../../lib/utils";

type WorkflowNextStepsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  batch: BatchRecord | null;
  billNumber?: string;
  amount?: number;
  workflowName?: string;
  onOpenMagicLink: (stepId: string) => Promise<void>;
  onViewInPipeline: (batchId: string) => void;
};

export function WorkflowNextStepsModal({
  isOpen,
  onClose,
  batch,
  billNumber,
  amount,
  workflowName,
  onOpenMagicLink,
  onViewInPipeline,
}: WorkflowNextStepsModalProps) {
  if (!isOpen || !batch) return null;

  const alertedStep = batch.stepInstances?.find((s) => s.status === "ALERTED") ?? batch.stepInstances?.[0];
  const approver = alertedStep?.stage?.contact;
  const approverName = approver?.name ?? "Approver";
  const approverEmail = approver?.email ?? "";
  const stageOrder = alertedStep?.stage?.order ?? 1;

  const totalAmount = amount ?? (batch.bills ?? []).reduce((sum, b) => sum + Number(b.amount ?? 0), 0);
  const isSingleBill = (batch.bills?.length ?? 1) === 1 || Boolean(billNumber);
  const displayBillNumber = billNumber || batch.bills?.[0]?.billNumber || `Batch ${formatBatchId(batch.id)}`;

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="bill-dialog next-steps-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="next-steps-title"
      >
        <div className="dialog-heading">
          <div>
            <span className="eyebrow-badge">SUBMISSION CONFIRMED</span>
            <h2 id="next-steps-title" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <CheckCircle2 size={22} className="text-forest" />
              <span>{isSingleBill ? `Bill ${displayBillNumber} Submitted!` : `Batch ${formatBatchId(batch.id)} Created!`}</span>
            </h2>
          </div>
          <button className="dialog-close" type="button" onClick={onClose} aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>

        {/* Summary Pill Bar */}
        <div className="next-steps-summary-bar">
          <div className="summary-item">
            <small>AMOUNT</small>
            <strong>{formatCurrency(totalAmount)}</strong>
          </div>
          <div className="summary-item">
            <small>PIPELINE</small>
            <strong>{workflowName || "Executive Workflow"}</strong>
          </div>
          <div className="summary-item">
            <small>STAGE 1 APPROVER</small>
            <strong>{approverName}</strong>
          </div>
        </div>

        {/* Interactive Step-by-Step Action Roadmap */}
        <div className="roadmap-container">
          <p className="roadmap-title">What happens next? (Step-by-Step Workflow)</p>

          <div className="roadmap-steps">
            {/* Step 1 */}
            <div className="roadmap-step current">
              <div className="step-icon-wrap active">
                <Mail size={16} />
              </div>
              <div className="step-content">
                <div className="step-header">
                  <strong>1. Approver Alerted via Email (Active Now)</strong>
                  <span className="step-status-pill status-alerted">Dispatched</span>
                </div>
                <p>
                  A notification email containing an HMAC-signed secure <strong>Magic Link</strong> was automatically sent to:
                  <br />
                  <span className="email-tag">{approverName} &lt;{approverEmail}&gt;</span>
                </p>
                {alertedStep && (
                  <div className="step-actions">
                    <button
                      type="button"
                      className="magic-link-quick-btn"
                      onClick={() => void onOpenMagicLink(alertedStep.id)}
                    >
                      <ExternalLink size={13} />
                      <span>⚡ Open Magic Link as Approver (Test Mode)</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Step 2 */}
            <div className="roadmap-step">
              <div className="step-icon-wrap">
                <ShieldCheck size={16} />
              </div>
              <div className="step-content">
                <div className="step-header">
                  <strong>2. OTP Verification & Approval Sign-off</strong>
                  <span className="step-status-pill status-pending">Awaiting Approver</span>
                </div>
                <p>
                  Upon clicking the link, the approver verifies identity via a 6-digit OTP sent to their email, enters any comments, and clicks <strong>Approve</strong> (or <strong>Return</strong> if corrections are needed).
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="roadmap-step">
              <div className="step-icon-wrap">
                <Clock size={16} />
              </div>
              <div className="step-content">
                <div className="step-header">
                  <strong>3. Multi-Stage Pipeline Progression</strong>
                  <span className="step-status-pill status-pending">Automated</span>
                </div>
                <p>
                  Once approved, the system automatically advances to Stage 2 (or next stage) and notifies the next approver without any manual intervention.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="roadmap-step">
              <div className="step-icon-wrap">
                <CreditCard size={16} />
              </div>
              <div className="step-content">
                <div className="step-header">
                  <strong>4. Settlement Center & Payment Execution</strong>
                  <span className="step-status-pill status-pending">Next Phase</span>
                </div>
                <p>
                  Once all stages are approved, the bill moves automatically to <strong>Settlement Center</strong> (status: <code>READY_FOR_PAYMENT</code>). Finance records the payment transfer, deductions (TDS), and uploads payment receipt proof.
                </p>
              </div>
            </div>

            {/* Step 5 */}
            <div className="roadmap-step">
              <div className="step-icon-wrap">
                <FileCheck size={16} />
              </div>
              <div className="step-content">
                <div className="step-header">
                  <strong>5. Completed & Immutable Audit Trail</strong>
                  <span className="step-status-pill status-pending">Final</span>
                </div>
                <p>
                  Bill balance reaches ₹0, marking the bill <strong>PAID</strong> with permanent audit log entries preserving actors, timestamps, and IP addresses.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="dialog-actions" style={{ justifyContent: "space-between", marginTop: 20 }}>
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              onClose();
              onViewInPipeline(batch.id);
            }}
          >
            <ArrowRight size={14} />
            <span>View in Approval Pipeline</span>
          </button>

          <button className="primary-button" type="button" onClick={onClose}>
            Got it, continue
          </button>
        </div>
      </section>
    </div>
  );
}

