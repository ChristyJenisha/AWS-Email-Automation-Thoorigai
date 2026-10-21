"use client";

import React, { FormEvent } from "react";
import { X, Plus, Trash2, ArrowRight, UserPlus, Layers } from "lucide-react";
import { ContactRecord, WorkflowRecord } from "../../types";

type WorkflowBuilderModalProps = {
  isOpen: boolean;
  onClose: () => void;
  workflows: WorkflowRecord[];
  contacts: ContactRecord[];
  newWorkflowName: string;
  setNewWorkflowName: (name: string) => void;
  newWorkflowStages: Array<{
    contactId: string;
    backupContactId: string;
    reminderIntervalHours: number;
    maxReminders: number;
  }>;
  setNewWorkflowStages: React.Dispatch<
    React.SetStateAction<
      Array<{
        contactId: string;
        backupContactId: string;
        reminderIntervalHours: number;
        maxReminders: number;
      }>
    >
  >;
  isSavingWorkflow: boolean;
  onCreateWorkflow: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  onDeleteWorkflow: (id: string) => Promise<void>;
  onSelectWorkflowForBatch: (wf: WorkflowRecord) => void;
  onOpenContactsDialog: () => void;
};

export function WorkflowBuilderModal({
  isOpen,
  onClose,
  workflows,
  contacts,
  newWorkflowName,
  setNewWorkflowName,
  newWorkflowStages,
  setNewWorkflowStages,
  isSavingWorkflow,
  onCreateWorkflow,
  onDeleteWorkflow,
  onSelectWorkflowForBatch,
  onOpenContactsDialog,
}: WorkflowBuilderModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isSavingWorkflow) onClose();
      }}
    >
      <section
        className="bill-dialog workflows-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wf-dialog-title"
      >
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">ADMINISTRATION</p>
            <h2 id="wf-dialog-title">Workflow Templates</h2>
          </div>
          <button
            className="dialog-close"
            type="button"
            disabled={isSavingWorkflow}
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        <p className="dialog-description">
          Configure sequential multi-stage approval templates with primary approvers, backup contacts, and automated reminder rules.
        </p>

        <div className="workflow-templates-list">
          {workflows.map((wf) => (
            <div className="workflow-template-card" key={wf.id}>
              <div className="workflow-template-head">
                <div className="wf-title-group">
                  <strong>{wf.name}</strong>
                  <span className="wf-stage-count">
                    ({wf.stages.length} stage{wf.stages.length === 1 ? "" : "s"})
                  </span>
                </div>
                <div className="wf-action-buttons">
                  <button
                    className="primary-button create-with-wf-btn"
                    type="button"
                    onClick={() => onSelectWorkflowForBatch(wf)}
                    title="Create a new approval batch using this workflow"
                  >
                    <Plus size={12} />
                    <span>Create Batch with this</span>
                  </button>
                  {(!wf._count || wf._count.batches === 0) && (
                    <button
                      className="secondary-button delete-wf-btn"
                      type="button"
                      onClick={() => void onDeleteWorkflow(wf.id)}
                    >
                      <Trash2 size={12} />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="workflow-stages-preview">
                {wf.stages.map((stg, sIndex) => (
                  <span key={stg.id || sIndex} className="stage-chip-wrapper">
                    <span className="stage-chip">
                      <strong>#{stg.order}</strong> {stg.contact?.name || "Approver"}
                      {stg.backupContact && (
                        <small className="backup-name"> ({stg.backupContact.name})</small>
                      )}
                      <small className="reminder-hours"> {stg.reminderIntervalHours ?? 24}h</small>
                    </span>
                    {sIndex < wf.stages.length - 1 && (
                      <ArrowRight size={13} className="stage-chip-arrow" />
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {workflows.length === 0 && <p className="empty-state">No workflow templates found.</p>}
        </div>

        <form className="contact-create-form" onSubmit={onCreateWorkflow}>
          <p className="section-kicker">CREATE NEW WORKFLOW TEMPLATE</p>
          <label className="wf-name-label">
            Template Name
            <input
              required
              placeholder="e.g. Standard 2-Stage Approval, High-Value Review"
              value={newWorkflowName}
              onChange={(e) => setNewWorkflowName(e.target.value)}
            />
          </label>

          <div className="section-kicker" style={{ marginTop: 14 }}>
            SEQUENTIAL APPROVAL STAGES
          </div>

          <div className="stage-builder-list">
            {newWorkflowStages.map((stage, idx) => (
              <div className="stage-builder-row" key={idx}>
                <div className="stage-num-badge">{idx + 1}</div>
                <label>
                  <div className="stage-contact-head">
                    <span>Primary Approver</span>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => {
                        onClose();
                        onOpenContactsDialog();
                      }}
                    >
                      <UserPlus size={11} />
                      <span>New Contact</span>
                    </button>
                  </div>
                  <select
                    required
                    value={stage.contactId}
                    onChange={(e) =>
                      setNewWorkflowStages((curr) =>
                        curr.map((item, itemIdx) =>
                          itemIdx === idx ? { ...item, contactId: e.target.value } : item
                        )
                      )
                    }
                  >
                    <option value="">Select contact...</option>
                    {contacts
                      .filter((c) => c.isActive)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.email})
                        </option>
                      ))}
                  </select>
                </label>

                <label>
                  Backup Approver (Optional)
                  <select
                    value={stage.backupContactId}
                    onChange={(e) =>
                      setNewWorkflowStages((curr) =>
                        curr.map((item, itemIdx) =>
                          itemIdx === idx ? { ...item, backupContactId: e.target.value } : item
                        )
                      )
                    }
                  >
                    <option value="">None</option>
                    {contacts
                      .filter((c) => c.isActive && c.id !== stage.contactId)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.email})
                        </option>
                      ))}
                  </select>
                </label>

                <label>
                  Interval (Hours)
                  <input
                    type="number"
                    min="1"
                    max="720"
                    value={stage.reminderIntervalHours}
                    onChange={(e) =>
                      setNewWorkflowStages((curr) =>
                        curr.map((item, itemIdx) =>
                          itemIdx === idx
                            ? { ...item, reminderIntervalHours: Number(e.target.value) }
                            : item
                        )
                      )
                    }
                  />
                </label>

                <label>
                  Max Reminders
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={stage.maxReminders}
                    onChange={(e) =>
                      setNewWorkflowStages((curr) =>
                        curr.map((item, itemIdx) =>
                          itemIdx === idx
                            ? { ...item, maxReminders: Number(e.target.value) }
                            : item
                        )
                      )
                    }
                  />
                </label>

                <button
                  className="remove-bill-button"
                  type="button"
                  disabled={newWorkflowStages.length === 1}
                  onClick={() =>
                    setNewWorkflowStages((curr) => curr.filter((_, itemIdx) => itemIdx !== idx))
                  }
                  aria-label="Remove stage"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <button
            className="text-button"
            type="button"
            onClick={() =>
              setNewWorkflowStages((curr) => [
                ...curr,
                { contactId: "", backupContactId: "", reminderIntervalHours: 24, maxReminders: 3 },
              ])
            }
            style={{ marginBottom: 16 }}
          >
            <Plus size={14} />
            <span>Add next approval stage</span>
          </button>

          <div className="dialog-actions">
            <button
              className="secondary-button"
              type="button"
              disabled={isSavingWorkflow}
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="primary-button" type="submit" disabled={isSavingWorkflow}>
              {isSavingWorkflow ? "Saving..." : "Save Template"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

