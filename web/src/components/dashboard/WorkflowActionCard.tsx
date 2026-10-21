"use client";

import React, { useState } from "react";
import {
  CheckCircle,
  RotateCcw,
  ExternalLink,
  UserCheck,
  UserX,
  PhoneCall,
  MessageSquare,
  AlertCircle,
  Tag,
} from "lucide-react";
import { AppUser, BatchRecord, ContactRecord, StepInstanceRecord } from "../../types";

type WorkflowActionCardProps = {
  batch: BatchRecord;
  step: StepInstanceRecord;
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
};

const RETURN_REASON_PRESETS = [
  "Amount discrepancy",
  "Missing invoice proof",
  "Duplicate bill found",
  "Needs vendor verification",
  "Payment terms incorrect",
];

export function WorkflowActionCard({
  batch,
  step,
  currentUser,
  isSubmittingApproval,
  approvalComment,
  setApprovalComment,
  onSubmitApproval,
  onOpenApprovalLink,
  onSubmitConfirmOnBehalf,
  onOpenReassignModal,
  onLoginAs,
}: WorkflowActionCardProps) {
  const [returnPresetActive, setReturnPresetActive] = useState<string | null>(null);

  const isAssignedApprover =
    !currentUser ||
    step.stage?.contact?.id === currentUser.id ||
    step.stage?.backupContact?.id === currentUser.id;

  const billNumbers =
    (batch.bills ?? [])
      .map((b) => b.billNumber)
      .filter(Boolean)
      .join(", ") || "this batch";

  const handlePresetClick = (preset: string) => {
    if (returnPresetActive === preset) {
      setReturnPresetActive(null);
      setApprovalComment("");
    } else {
      setReturnPresetActive(preset);
      setApprovalComment(`[${preset}]: `);
    }
  };

  return (
    <section className="workflow-panel" aria-live="polite">
      <div className="workflow-header">
        <div>
          <p className="eyebrow">WORKFLOW ACTION · BATCH {batch.id.slice(0, 8)}</p>
          <div className="workflow-title-wrap">
            <h3>Approval In Progress</h3>
            <span className="stage-badge">Stage {step.stage?.order ?? 1}</span>
          </div>
        </div>
        <span className="status-pill status-alerted">
          <i />
          {step.status}
        </span>
      </div>

      <div className="workflow-details-row">
        <div className="workflow-meta">
          <div className="approver-info">
            <UserCheck size={16} className="text-forest" />
            <strong>
              {step.stage?.contact?.name ?? "Assigned approver"}{" "}
              <span className="text-muted">({step.stage?.contact?.email})</span>
            </strong>
          </div>
          <p className="workflow-instructions">
            Stage {step.stage?.order ?? 1} is awaiting action for <strong>{billNumbers}</strong>.
            {step.stage?.backupContact && (
              <span className="backup-approver-tag">
                Backup: {step.stage.backupContact.name} ({step.stage.backupContact.email})
              </span>
            )}
          </p>

          {step.lastComment && (
            <div
              className={`comment-callout ${
                step.lastComment.includes("Reassignment") ? "reassign" : "note"
              }`}
            >
              <MessageSquare size={14} />
              <span>{step.lastComment}</span>
            </div>
          )}
        </div>

        <div className="workflow-quick-roles">
          <span className="quick-roles-title">Switch demo user:</span>
          <div className="quick-roles-btns">
            <button
              className="quick-role-btn"
              type="button"
              onClick={() => void onLoginAs("approver@example.test", "demo123")}
            >
              Approver
            </button>
            <button
              className="quick-role-btn"
              type="button"
              onClick={() => void onLoginAs("backup@example.test", "demo123")}
            >
              Backup
            </button>
            <button
              className="quick-role-btn"
              type="button"
              onClick={() => void onLoginAs("admin@example.test", "demo123")}
            >
              Admin
            </button>
          </div>
        </div>
      </div>

      {!isAssignedApprover && (
        <div className="approver-warning">
          <AlertCircle size={15} />
          <span>
            You are signed in as <strong>{currentUser?.name}</strong>. Only the assigned approver (or Admin) can approve or return this step. Switch user above to test.
          </span>
        </div>
      )}

      {/* Return Reason Presets */}
      <div className="return-reasons-wrap">
        <span className="return-reasons-label">
          <Tag size={13} /> Return reason presets:
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

      {/* Comment Input */}
      <div className="workflow-actions-area">
        <textarea
          value={approvalComment}
          onChange={(event) => setApprovalComment(event.target.value)}
          placeholder="Add comments or specific return instructions when returning this batch for revision..."
          rows={3}
          disabled={!isAssignedApprover}
          className="workflow-textarea"
        />

        <div className="workflow-btn-group">
          {/* Reassign approver button */}
          {currentUser?.role?.toLowerCase() === "admin" && (
            <button
              className="action-btn reassign"
              type="button"
              disabled={isSubmittingApproval}
              onClick={() =>
                onOpenReassignModal(
                  batch.id,
                  step.id,
                  step.stage?.contact?.name
                )
              }
              title="Reassign this workflow step to another active contact"
            >
              <UserX size={15} />
              <span>Reassign</span>
            </button>
          )}

          {/* Confirm on behalf */}
          {currentUser?.role?.toLowerCase() === "admin" && (
            <button
              className="action-btn offline"
              type="button"
              disabled={isSubmittingApproval}
              onClick={() => void onSubmitConfirmOnBehalf(batch.id, step.id)}
              title="Record manual/phone confirmation on behalf of approver"
            >
              <PhoneCall size={15} />
              <span>Confirm on behalf</span>
            </button>
          )}

          {/* Open magic link */}
          <button
            className="action-btn magic-link"
            type="button"
            onClick={() => void onOpenApprovalLink(step.id)}
            title="Open signed magic link in email approver view"
          >
            <ExternalLink size={15} />
            <span>Open Link ↗</span>
          </button>

          {/* Return for correction action */}
          <button
            className="action-btn return"
            type="button"
            disabled={isSubmittingApproval || !currentUser || !isAssignedApprover}
            onClick={() => void onSubmitApproval("return", step.id)}
          >
            <RotateCcw size={15} />
            <span>Return for correction</span>
          </button>

          {/* Approve action */}
          <button
            className="action-btn approve"
            type="button"
            disabled={isSubmittingApproval || !currentUser || !isAssignedApprover}
            onClick={() => void onSubmitApproval("complete", step.id)}
          >
            <CheckCircle size={15} />
            <span>Approve step</span>
          </button>
        </div>
      </div>
    </section>
  );
}

