"use client";

import React, { useState } from "react";
import {
  Clock,
  UserCheck,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  CheckCircle,
  ExternalLink,
  PhoneCall,
  UserX,
  Tag,
  History,
  FileText,
  Layers,
  Trash2,
  ArrowRightCircle,
  CreditCard,
  ArrowRight,
} from "lucide-react";
import { AppUser, BatchRecord, ContactRecord, StepInstanceRecord } from "../../types";
import { formatCurrency, formatExactCurrency } from "../../lib/utils";

type CurrentlyWithBoardProps = {
  liveBatches: BatchRecord[];
  currentUser: AppUser | null;
  contacts: ContactRecord[];
  isSubmittingApproval: boolean;
  approvalComment: string;
  setApprovalComment: (comment: string) => void;
  onSubmitApproval: (action: "complete" | "return", stepId: string) => Promise<void>;
  onOpenApprovalLink: (stepId: string) => Promise<void>;
  onSubmitConfirmOnBehalf: (batchId: string, stepId: string) => Promise<void>;
  onOpenReassignModal: (batchId: string, stepId: string, currentContactName?: string) => void;
  onLoginAs: (email: string, password?: string) => Promise<string | null>;
  onOpenBatchHistory: (batchId: string) => Promise<void>;
  onDeleteBatch?: (batchId: string) => Promise<void>;
};

const RETURN_REASON_PRESETS = [
  "Amount discrepancy",
  "Missing invoice proof",
  "Duplicate bill found",
  "Needs vendor verification",
  "Payment terms incorrect",
];

export function CurrentlyWithBoard({
  liveBatches,
  currentUser,
  isSubmittingApproval,
  approvalComment,
  setApprovalComment,
  onSubmitApproval,
  onOpenApprovalLink,
  onSubmitConfirmOnBehalf,
  onOpenReassignModal,
  onLoginAs,
  onOpenBatchHistory,
  onDeleteBatch,
}: CurrentlyWithBoardProps) {
  const [returnPresetActive, setReturnPresetActive] = useState<string | null>(null);

  // Active batches currently in flight (not yet COMPLETED)
  const activeBatches = liveBatches.filter(
    (b) => b.status === "IN_PROGRESS" || b.status === "READY_FOR_PAYMENT"
  );

  const handlePresetClick = (preset: string) => {
    if (returnPresetActive === preset) {
      setReturnPresetActive(null);
      setApprovalComment("");
    } else {
      setReturnPresetActive(preset);
      setApprovalComment(`[${preset}]: `);
    }
  };

  if (activeBatches.length === 0) {
    return (
      <section className="currently-with-section" aria-label="Currently With Tracker">
        <div className="section-heading">
          <div>
            <p className="eyebrow">CORE POC SCREEN · WORKFLOW TRACKER</p>
            <h2>Currently With Pipeline</h2>
          </div>
        </div>
        <div className="empty-currently-with">
          <Clock size={32} className="text-muted" style={{ opacity: 0.5, marginBottom: 8 }} />
          <p>No batches are currently in flight. Create a batch to start the approval pipeline.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="currently-with-section" aria-label="Currently With Tracker">
      <div className="section-heading">
        <div>
          <p className="eyebrow">CORE POC SCREEN · MULTI-STAGE APPROVAL</p>
          <h2>
            Currently With Dashboard{" "}
            <span className="section-total">{activeBatches.length} active</span>
          </h2>
        </div>
        <span className="status-pill status-alerted">
          <Clock size={12} /> Live In-Flight Tracking
        </span>
      </div>

      <div className="currently-with-grid">
        {activeBatches.map((batch) => {
          const alertedStep = batch.stepInstances?.find((s) => s.status === "ALERTED");
          const completedSteps = batch.stepInstances?.filter((s) => s.status === "COMPLETED") ?? [];
          const totalStepsCount = batch.stepInstances?.length ?? 1;
          const currentStageOrder = alertedStep?.stage?.order ?? completedSteps.length + 1;
          const isReadyForPayment = batch.status === "READY_FOR_PAYMENT";

          const assignedContact = alertedStep?.stage?.contact;
          const backupContact = alertedStep?.stage?.backupContact;

          const isAssignedApprover =
            !currentUser ||
            assignedContact?.id === currentUser.id ||
            backupContact?.id === currentUser.id;

          const totalBatchAmount = (batch.bills ?? []).reduce(
            (sum, bill) => sum + Number(bill.amount ?? 0),
            0
          );
          const totalRemaining = (batch.bills ?? []).reduce(
            (sum, bill) => sum + Number(bill.balanceDue ?? 0),
            0
          );

          // Calculate time in stage if alertedAt exists
          const alertedDate = alertedStep?.alertedAt ? new Date(alertedStep.alertedAt) : null;
          const hoursInStage = alertedDate
            ? Math.max(0, Math.round((Date.now() - alertedDate.getTime()) / (1000 * 60 * 60)))
            : null;

          const isOverdue = (alertedStep?.reminderCount ?? 0) > 1 || (hoursInStage !== null && hoursInStage > 24);

          return (
            <div className={`currently-with-card ${isOverdue ? "card-overdue" : ""}`} key={batch.id}>
              {/* Card Header */}
              <div className="card-top-row">
                <div>
                  <span className="batch-id-badge">
                    {(batch.bills?.length ?? 0) === 1 ? `Bill ${batch.bills?.[0]?.billNumber}` : `Batch ${batch.id.slice(0, 8)}`}
                  </span>
                  {(batch.bills?.length ?? 0) === 1 ? (
                    <span className="batch-type-pill single">Single Bill</span>
                  ) : (
                    <span className="batch-type-pill batch">Batch ({batch.bills?.length ?? 0} bills)</span>
                  )}
                  <span className="stage-tracker-pill">
                    Stage {currentStageOrder} of {totalStepsCount}
                  </span>
                </div>

                <div className="card-status-badges">
                  {isOverdue && (
                    <span className="status-pill status-overdue-tag">
                      <AlertTriangle size={11} /> Overdue
                    </span>
                  )}
                  <span
                    className={`status-pill status-${
                      isReadyForPayment
                        ? "ready-for-payment"
                        : alertedStep?.status?.toLowerCase() ?? "in-progress"
                    }`}
                  >
                    <i />
                    {isReadyForPayment ? "Ready for Payment" : alertedStep?.status ?? "IN_PROGRESS"}
                  </span>
                </div>
              </div>

              {/* Visual Multi-Stage Progress Stepper */}
              {batch.stepInstances && batch.stepInstances.length > 0 && (
                <div className="batch-stepper-wrap">
                  <div className="batch-stepper">
                    {batch.stepInstances.map((step, idx) => {
                      const isCompleted = step.status === "COMPLETED";
                      const isAlerted = step.status === "ALERTED";
                      const isReturned = step.status === "RETURNED";
                      return (
                        <div
                          key={step.id}
                          className={`stepper-node ${
                            isCompleted
                              ? "completed"
                              : isAlerted
                              ? "active"
                              : isReturned
                              ? "returned"
                              : "pending"
                          }`}
                        >
                          <div className="stepper-dot">
                            {isCompleted ? (
                              <CheckCircle size={13} />
                            ) : isAlerted ? (
                              <span className="stepper-pulse-dot" />
                            ) : (
                              <span>{idx + 1}</span>
                            )}
                          </div>
                          <div className="stepper-meta">
                            <span className="stepper-stage-title">
                              Stage {step.stage?.order ?? idx + 1}
                            </span>
                            <span
                              className="stepper-approver-name"
                              title={step.stage?.contact?.email || undefined}
                            >
                              {step.stage?.contact?.name ?? "Approver"}
                            </span>
                          </div>
                          {idx < (batch.stepInstances?.length ?? 1) - 1 && (
                            <div className="stepper-connector" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Currently With Contact Bar */}
              <div className="currently-assigned-box">
                <div className="assigned-main">
                  <div className="assigned-avatar">
                    <UserCheck size={18} />
                  </div>
                  <div className="assigned-copy">
                    <small>CURRENTLY WITH:</small>
                    <strong>
                      {isReadyForPayment
                        ? "Finance / Client Admin (Ready for Settlement)"
                        : assignedContact?.name ?? "Assigned Approver"}
                    </strong>
                    {!isReadyForPayment && assignedContact?.email && (
                      <span className="assigned-email">{assignedContact.email}</span>
                    )}
                  </div>
                </div>

                {!isReadyForPayment && backupContact && (
                  <div className="backup-approver-badge">
                    <ShieldCheck size={13} />
                    <span>Backup: {backupContact.name}</span>
                  </div>
                )}
              </div>

              {/* Progress & Time in Stage Indicator */}
              <div className="timeline-meta-strip">
                <div>
                  <Clock size={13} />
                  <span>
                    {hoursInStage !== null
                      ? `In stage for ${hoursInStage} hour${hoursInStage === 1 ? "" : "s"}`
                      : "Recently advanced"}
                  </span>
                </div>
                {alertedStep?.reminderCount !== undefined && alertedStep.reminderCount > 0 && (
                  <span className="reminder-count-tag">
                    {alertedStep.reminderCount} reminder{alertedStep.reminderCount === 1 ? "" : "s"} sent
                  </span>
                )}
                <button
                  type="button"
                  className="card-history-link"
                  onClick={() => void onOpenBatchHistory(batch.id)}
                >
                  <History size={12} />
                  <span>View Timeline & Audit</span>
                </button>
              </div>

              {/* Next Required Action Guidance Box */}
              <div className={`next-action-callout ${isReadyForPayment ? "action-ready" : "action-in-progress"}`}>
                <div className="next-action-header">
                  <span className="next-action-title">
                    <ArrowRightCircle size={15} />
                    <strong>NEXT REQUIRED ACTION:</strong>
                  </span>
                  {isReadyForPayment ? (
                    <span className="next-action-status-badge ready">Ready for Settlement</span>
                  ) : (
                    <span className="next-action-status-badge pending">
                      Awaiting Stage {currentStageOrder} Sign-off
                    </span>
                  )}
                </div>

                <div className="next-action-body">
                  {isReadyForPayment ? (
                    <div className="next-action-instruction">
                      <p>
                        <strong>All approval stages have been completed successfully.</strong>
                        <br />
                        Finance team must record the bank payment transfer and upload payment proof in the <strong>Settlement Center</strong> below.
                      </p>
                      <button
                        type="button"
                        className="next-action-quick-btn primary"
                        onClick={() => {
                          document.getElementById("settlements")?.scrollIntoView({ behavior: "smooth" });
                        }}
                      >
                        <CreditCard size={13} />
                        <span>Go to Settlement Center →</span>
                      </button>
                    </div>
                  ) : alertedStep ? (
                    <div className="next-action-instruction">
                      <p>
                        Waiting for <strong>Stage {currentStageOrder}</strong> approval from{" "}
                        <strong>{assignedContact?.name ?? "Approver"}</strong>
                        {assignedContact?.email ? ` (${assignedContact.email})` : ""}.
                        <br />
                        Approver must open their secure Magic Link, verify OTP, and click <strong>Approve</strong>.
                      </p>
                      <div className="next-action-btn-row">
                        <button
                          type="button"
                          className="next-action-quick-btn magic"
                          onClick={() => void onOpenApprovalLink(alertedStep.id)}
                          title="Open the external approver page with signed HMAC token"
                        >
                          <ExternalLink size={13} />
                          <span>⚡ Open Magic Link as Approver</span>
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Bills in this Batch with Stage Verification Badges */}
              <div className="batch-bills-preview">
                <div className="preview-heading">
                  <span className="preview-label">
                    <FileText size={13} /> Bills Verified in this Process ({batch.bills?.length ?? 0}):
                  </span>
                  <span className="preview-total">
                    Total: <strong>{formatCurrency(totalBatchAmount)}</strong>
                    {totalRemaining < totalBatchAmount && (
                      <small> ({formatCurrency(totalRemaining)} remaining)</small>
                    )}
                  </span>
                </div>

                <div className="preview-bills-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Bill #</th>
                        <th>Amount</th>
                        <th>Balance Due</th>
                        <th>Process Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(batch.bills ?? []).map((bill) => {
                        const isVerifiedInCurrent = completedSteps.length > 0;
                        return (
                          <tr key={bill.id ?? bill.billNumber}>
                            <td>
                              <strong>{bill.billNumber}</strong>
                            </td>
                            <td>{formatExactCurrency(Number(bill.amount ?? 0))}</td>
                            <td>
                              <span className="bill-remaining">
                                {formatExactCurrency(Number(bill.balanceDue ?? bill.amount ?? 0))}
                              </span>
                            </td>
                            <td>
                              {isReadyForPayment ? (
                                <span className="status-pill status-connected">
                                  <CheckCircle size={11} /> Fully Verified
                                </span>
                              ) : isVerifiedInCurrent ? (
                                <span className="status-pill status-ready">
                                  <CheckCircle size={11} /> Stage {completedSteps.length} Verified
                                </span>
                              ) : (
                                <span className="status-pill status-alerted">
                                  <Clock size={11} /> Awaiting Stage {currentStageOrder}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Area for Alerted Stage */}
              {alertedStep && (
                <div className="card-actions-container">
                  <div className="return-reasons-wrap">
                    <span className="return-reasons-label">
                      <Tag size={12} /> Quick Return Reason Presets:
                    </span>
                    <div className="return-chips">
                      {RETURN_REASON_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          className={`return-chip ${returnPresetActive === preset ? "selected" : ""}`}
                          onClick={() => handlePresetClick(preset)}
                          disabled={!isAssignedApprover}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea
                    className="workflow-textarea"
                    rows={2}
                    value={approvalComment}
                    onChange={(e) => setApprovalComment(e.target.value)}
                    placeholder="Add approval notes or return instructions..."
                    disabled={!isAssignedApprover}
                  />

                  <div className="card-buttons-row">
                    {/* Role switcher hint */}
                    <div className="card-role-switch">
                      <span>Test as:</span>
                      <button
                        type="button"
                        onClick={() => void onLoginAs("approver@example.test", "demo123")}
                      >
                        Approver 1
                      </button>
                      <button
                        type="button"
                        onClick={() => void onLoginAs("backup@example.test", "demo123")}
                      >
                        Approver 2
                      </button>
                      <button
                        type="button"
                        onClick={() => void onLoginAs("admin@example.test", "demo123")}
                      >
                        Admin
                      </button>
                    </div>

                    <div className="card-action-btns">
                      {currentUser?.role?.toLowerCase() === "admin" && (
                        <>
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={() =>
                              onOpenReassignModal(
                                batch.id,
                                alertedStep.id,
                                assignedContact?.name
                              )
                            }
                            title="Reassign this step to another active contact"
                          >
                            <UserX size={13} />
                            <span>Reassign</span>
                          </button>

                          <button
                            className="secondary-button"
                            type="button"
                            onClick={() =>
                              void onSubmitConfirmOnBehalf(batch.id, alertedStep.id)
                            }
                            title="Record offline/phone confirmation"
                          >
                            <PhoneCall size={13} />
                            <span>Confirm Offline</span>
                          </button>
                        </>
                      )}

                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => void onOpenApprovalLink(alertedStep.id)}
                        title="Open external approver magic link"
                      >
                        <ExternalLink size={13} />
                        <span>Magic Link ↗</span>
                      </button>

                      {onDeleteBatch && (
                        <button
                          className="secondary-button danger-btn"
                          type="button"
                          onClick={() => void onDeleteBatch(batch.id)}
                          title="Delete this batch and all its bills"
                          style={{ borderColor: "#fca5a5", color: "#b91c1c" }}
                        >
                          <Trash2 size={13} />
                          <span>Delete Batch</span>
                        </button>
                      )}

                      <button
                        className="secondary-button danger-btn"
                        type="button"
                        disabled={isSubmittingApproval || !isAssignedApprover}
                        onClick={() => void onSubmitApproval("return", alertedStep.id)}
                      >
                        <RotateCcw size={13} />
                        <span>Return</span>
                      </button>

                      <button
                        className="primary-button"
                        type="button"
                        disabled={isSubmittingApproval || !isAssignedApprover}
                        onClick={() => void onSubmitApproval("complete", alertedStep.id)}
                      >
                        <CheckCircle size={13} />
                        <span>Approve Stage {currentStageOrder}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

