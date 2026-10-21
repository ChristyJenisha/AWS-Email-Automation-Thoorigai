"use client";

import React, { useState, FormEvent } from "react";
import { X, Mail, Layers, ArrowRight, UserPlus, Settings, FileText, CheckCircle2, DollarSign, Calendar } from "lucide-react";
import { ContactRecord, WorkflowRecord } from "../../types";

type SubmitIndividualBillModalProps = {
  isOpen: boolean;
  onClose: () => void;
  workflows: WorkflowRecord[];
  liveWorkflow: WorkflowRecord | null;
  contacts: ContactRecord[];
  selectedTemplateId: string;
  setSelectedTemplateId: (id: string) => void;
  setLiveWorkflow: (wf: WorkflowRecord) => void;
  isSubmitting: boolean;
  onSubmitBill: (data: {
    billNumber: string;
    amount: number;
    dueDate?: string;
  }) => Promise<void>;
  onOpenWorkflowsDialog: () => void;
  onOpenContactsDialog: () => void;
};

export function SubmitIndividualBillModal({
  isOpen,
  onClose,
  workflows,
  liveWorkflow,
  contacts,
  selectedTemplateId,
  setSelectedTemplateId,
  setLiveWorkflow,
  isSubmitting,
  onSubmitBill,
  onOpenWorkflowsDialog,
  onOpenContactsDialog,
}: SubmitIndividualBillModalProps) {
  const [billNumber, setBillNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");

  if (!isOpen) return null;

  const stageContactId = liveWorkflow?.stages?.[0]?.contact?.id;
  const freshContact =
    contacts.find((c) => c.id === stageContactId) ?? liveWorkflow?.stages?.[0]?.contact;
  const contactName = freshContact?.name ?? "Approver";
  const contactEmail = freshContact?.email ?? "approver@example.test";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!billNumber.trim() || !numAmount || numAmount <= 0) return;

    await onSubmitBill({
      billNumber: billNumber.trim(),
      amount: numAmount,
      dueDate: dueDate || undefined,
    });

    // Reset draft fields
    setBillNumber("");
    setAmount("");
    setDueDate("");
  };

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <section
        className="bill-dialog batch-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="individual-bill-title"
      >
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">DIRECT INVOICE SUBMISSION</p>
            <h2 id="individual-bill-title">Submit Individual Bill for Approval</h2>
            <div className="notify-badge">
              <Mail size={13} className="text-forest" />
              <span>Magic Link & OTP will be sent to:</span>
              <strong>{contactName} ({contactEmail})</strong>
            </div>
          </div>
          <button
            className="dialog-close"
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        <p className="dialog-description">
          Submit an individual bill directly into the multi-stage approval workflow without having to build a batch. The first approver will automatically receive an email with a secure magic link.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Bill Inputs */}
          <div className="form-group-card">
            <span className="section-label">Bill / Invoice Details</span>
            <div className="form-two-columns">
              <label>
                Invoice / Bill Number *
                <input
                  required
                  autoFocus
                  value={billNumber}
                  onChange={(e) => setBillNumber(e.target.value)}
                  placeholder="e.g. INV-2026-001"
                />
              </label>
              <label>
                Amount (INR) *
                <input
                  required
                  min="0.01"
                  step="0.01"
                  type="number"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 25000"
                />
              </label>
            </div>
            <label>
              Due Date (Optional)
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </label>
          </div>

          {/* Workflow Selector */}
          <div className="workflow-select-card">
            <div className="workflow-select-header">
              <label className="section-label">Select Approval Pipeline</label>
              <div className="workflow-select-links">
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    onClose();
                    onOpenWorkflowsDialog();
                  }}
                >
                  <Settings size={12} />
                  <span>Manage Workflows</span>
                </button>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    onClose();
                    onOpenContactsDialog();
                  }}
                >
                  <UserPlus size={12} />
                  <span>Add Contact</span>
                </button>
              </div>
            </div>

            <select
              value={selectedTemplateId}
              onChange={(e) => {
                setSelectedTemplateId(e.target.value);
                const found = workflows.find((w) => w.id === e.target.value);
                if (found) setLiveWorkflow(found);
              }}
              className="workflow-select-input"
            >
              {workflows.map((wf) => {
                const approverContact =
                  contacts.find((c) => c.id === wf.stages?.[0]?.contact?.id) ??
                  wf.stages?.[0]?.contact;
                return (
                  <option key={wf.id} value={wf.id}>
                    {wf.name} ({wf.stages?.length ?? 1} stage
                    {(wf.stages?.length ?? 1) > 1 ? "s" : ""}) → 1st:{" "}
                    {approverContact?.name ?? "Approver"} ({approverContact?.email ?? "Email"})
                  </option>
                );
              })}
            </select>

            {liveWorkflow && (
              <div className="pipeline-preview">
                <div className="pipeline-title">
                  <Layers size={13} />
                  <span>APPROVAL CHAIN:</span>
                  <strong>{liveWorkflow.name}</strong>
                </div>

                <div className="pipeline-stages">
                  {liveWorkflow.stages?.map((stg, sIdx) => {
                    const freshC = contacts.find((c) => c.id === stg.contact?.id) ?? stg.contact;
                    const freshBackup =
                      contacts.find((c) => c.id === stg.backupContact?.id) ?? stg.backupContact;
                    return (
                      <div key={stg.id || sIdx} className="pipeline-stage-wrap">
                        <span className={`stage-chip ${sIdx === 0 ? "current" : ""}`}>
                          <strong>#{stg.order}</strong> {freshC?.name || "Approver"}
                          {freshBackup && (
                            <small className="backup-name"> (Backup: {freshBackup.name})</small>
                          )}
                          <small className="reminder-hours"> {stg.reminderIntervalHours ?? 24}h</small>
                        </span>
                        {sIdx < (liveWorkflow.stages?.length ?? 0) - 1 && (
                          <ArrowRight size={13} className="stage-arrow" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Workflow Steps Preview Note */}
          <div className="flow-explanation-box">
            <CheckCircle2 size={15} className="text-forest" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: "12px", lineHeight: "1.4" }}>
              <strong>What happens next?</strong>
              <div style={{ color: "var(--muted)", marginTop: "2px" }}>
                1. Bill is created in the database and enters <strong>Stage 1</strong>.
                <br />
                2. <strong>{contactName}</strong> receives an email with a secure Magic Link and OTP request.
                <br />
                3. After approval, the bill advances automatically to payment settlement.
              </div>
            </div>
          </div>

          <div className="dialog-actions">
            <button
              className="secondary-button"
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Bill for Approval →"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

