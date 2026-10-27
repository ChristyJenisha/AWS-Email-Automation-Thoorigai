"use client";

import React, { FormEvent } from "react";
import { X, Plus, Trash2, Mail, Layers, ArrowRight, UserPlus, Settings } from "lucide-react";
import { BatchBillDraft, ContactRecord, WorkflowRecord } from "../../types";
import { emptyBatchBill } from "../../lib/utils";

type CreateBatchModalProps = {
  isOpen: boolean;
  onClose: () => void;
  workflows: WorkflowRecord[];
  liveWorkflow: WorkflowRecord | null;
  contacts: ContactRecord[];
  selectedTemplateId: string;
  setSelectedTemplateId: (id: string) => void;
  setLiveWorkflow: (wf: WorkflowRecord) => void;
  batchBills: BatchBillDraft[];
  setBatchBills: React.Dispatch<React.SetStateAction<BatchBillDraft[]>>;
  isCreatingBatch: boolean;
  onCreateBatch: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  onOpenWorkflowsDialog: () => void;
  onOpenContactsDialog: () => void;
};

export function CreateBatchModal({
  isOpen,
  onClose,
  workflows,
  liveWorkflow,
  contacts,
  selectedTemplateId,
  setSelectedTemplateId,
  setLiveWorkflow,
  batchBills,
  setBatchBills,
  isCreatingBatch,
  onCreateBatch,
  onOpenWorkflowsDialog,
  onOpenContactsDialog,
}: CreateBatchModalProps) {
  if (!isOpen) return null;

  const stageContactId = liveWorkflow?.stages?.[0]?.contact?.id;
  const freshContact =
    contacts.find((c) => c.id === stageContactId) ?? liveWorkflow?.stages?.[0]?.contact;
  const contactName = freshContact?.name ?? "Demo Approver";
  const contactEmail = freshContact?.email ?? "christyjenisha12@gmail.com";

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isCreatingBatch) onClose();
      }}
    >
      <section
        className="bill-dialog batch-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-dialog-title"
      >
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">{liveWorkflow?.name ?? "WORKFLOW"}</p>
            <h2 id="batch-dialog-title">Create approval batch</h2>
            <div className="notify-badge">
              <Mail size={13} className="text-forest" />
              <span>Magic Link will be sent to:</span>
              <strong>{contactName} ({contactEmail})</strong>
            </div>
          </div>
          <button
            className="dialog-close"
            type="button"
            onClick={onClose}
            disabled={isCreatingBatch}
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        <p className="dialog-description">
          Add one or more bills. The first approver will be notified via email after the batch is saved.
        </p>

        <form onSubmit={onCreateBatch}>
          <div className="workflow-select-card">
            <div className="workflow-select-header">
              <label className="section-label">Select Workflow & Approver Chain</label>
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
                  <span>ACTIVE APPROVAL PIPELINE:</span>
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

          <div className="batch-bills-container">
            <span className="section-label">Bills in this Batch ({batchBills.length})</span>
            {batchBills.map((bill, index) => (
              <div className="batch-bill-row" key={index}>
                <label>
                  Bill number
                  <input
                    required
                    value={bill.billNumber}
                    onChange={(event) =>
                      setBatchBills((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, billNumber: event.target.value } : item
                        )
                      )
                    }
                    placeholder="INV-2026-001"
                  />
                </label>
                <label>
                  Amount (INR)
                  <input
                    required
                    min="0.01"
                    step="0.01"
                    type="number"
                    inputMode="decimal"
                    value={bill.amount}
                    onChange={(event) =>
                      setBatchBills((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, amount: event.target.value } : item
                        )
                      )
                    }
                    placeholder="0.00"
                  />
                </label>
                <label>
                  Due date
                  <input
                    type="date"
                    value={bill.dueDate}
                    onChange={(event) =>
                      setBatchBills((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, dueDate: event.target.value } : item
                        )
                      )
                    }
                  />
                </label>
                <button
                  className="remove-bill-button"
                  type="button"
                  disabled={batchBills.length === 1 || isCreatingBatch}
                  onClick={() =>
                    setBatchBills((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index)
                    )
                  }
                  aria-label={`Remove bill ${index + 1}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>

          <button
            className="text-button add-bill-row"
            type="button"
            disabled={isCreatingBatch}
            onClick={() => setBatchBills((current) => [...current, emptyBatchBill()])}
          >
            <Plus size={14} />
            <span>Add another bill</span>
          </button>

          <div className="dialog-actions">
            <button
              className="secondary-button"
              type="button"
              disabled={isCreatingBatch}
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="primary-button" type="submit" disabled={isCreatingBatch}>
              {isCreatingBatch ? "Creating..." : "Create batch"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

