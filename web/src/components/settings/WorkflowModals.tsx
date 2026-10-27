"use client";

import React, { FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ModalDialog, Button, Badge } from "../ui";
import { ContactRecord, WorkflowRecord } from "../../types";

export interface StageDraft {
  contactId: string;
  backupContactId: string;
  reminderIntervalHours: number;
  maxReminders: number;
}

interface WorkflowModalsProps {
  createWfOpen: boolean;
  setCreateWfOpen: (open: boolean) => void;
  editWfOpen: boolean;
  setEditWfOpen: (open: boolean) => void;
  deleteWfTarget: WorkflowRecord | null;
  setDeleteWfTarget: (target: WorkflowRecord | null) => void;
  wfName: string;
  setWfName: (name: string) => void;
  wfStages: StageDraft[];
  handleAddStage: () => void;
  handleRemoveStage: (idx: number) => void;
  handleStageChange: (idx: number, field: keyof StageDraft, value: string | number) => void;
  activeContacts: ContactRecord[];
  isSubmittingWf: boolean;
  handleCreateWorkflow: (e: FormEvent) => Promise<void>;
  handleEditWorkflow: (e: FormEvent) => Promise<void>;
  handleDeleteWorkflow: () => Promise<void>;
}

export function WorkflowModals({
  createWfOpen,
  setCreateWfOpen,
  editWfOpen,
  setEditWfOpen,
  deleteWfTarget,
  setDeleteWfTarget,
  wfName,
  setWfName,
  wfStages,
  handleAddStage,
  handleRemoveStage,
  handleStageChange,
  activeContacts,
  isSubmittingWf,
  handleCreateWorkflow,
  handleEditWorkflow,
  handleDeleteWorkflow,
}: WorkflowModalsProps) {
  return (
    <>
      {/* CREATE WORKFLOW TEMPLATE MODAL */}
      <ModalDialog
        isOpen={createWfOpen}
        onClose={() => !isSubmittingWf && setCreateWfOpen(false)}
        title="Create Workflow Template"
        description="Configure sequential approval stages with designated primary officers and reminder rules."
        maxWidth="620px"
      >
        <form onSubmit={handleCreateWorkflow} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600 }}>
            <span>Template Name</span>
            <input
              type="text"
              required
              placeholder="e.g. Standard 2-Stage Approval, Executive CapEx Review"
              value={wfName}
              onChange={(e) => setWfName(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-light)",
                fontSize: 13,
              }}
            />
          </label>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
              Sequential Approval Stages
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={<Plus size={13} />}
              onClick={handleAddStage}
            >
              Add Stage
            </Button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: "360px", overflowY: "auto", paddingRight: 4 }}>
            {wfStages.map((stage, idx) => (
              <div
                key={idx}
                style={{
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--border-light)",
                  borderRadius: "var(--radius-md)",
                  padding: "14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Badge variant="info">Stage #{idx + 1}</Badge>
                  {wfStages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveStage(idx)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--urgency-rose)",
                        fontSize: 12,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Trash2 size={12} />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600 }}>
                    <span>Primary Approver *</span>
                    <select
                      required
                      value={stage.contactId}
                      onChange={(e) => handleStageChange(idx, "contactId", e.target.value)}
                      style={{
                        padding: "7px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-light)",
                        fontSize: 12.5,
                        background: "var(--bg-surface)",
                      }}
                    >
                      <option value="">Select contact...</option>
                      {activeContacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.email})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600 }}>
                    <span>Backup Approver</span>
                    <select
                      value={stage.backupContactId}
                      onChange={(e) => handleStageChange(idx, "backupContactId", e.target.value)}
                      style={{
                        padding: "7px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-light)",
                        fontSize: 12.5,
                        background: "var(--bg-surface)",
                      }}
                    >
                      <option value="">None (Optional)</option>
                      {activeContacts
                        .filter((c) => c.id !== stage.contactId)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.email})
                          </option>
                        ))}
                    </select>
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600 }}>
                    <span>Reminder Interval (Hours)</span>
                    <input
                      type="number"
                      min={1}
                      max={720}
                      value={stage.reminderIntervalHours}
                      onChange={(e) =>
                        handleStageChange(idx, "reminderIntervalHours", Number(e.target.value))
                      }
                      style={{
                        padding: "6px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-light)",
                        fontSize: 12.5,
                        background: "var(--bg-surface)",
                      }}
                    />
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600 }}>
                    <span>Max Reminders</span>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={stage.maxReminders}
                      onChange={(e) =>
                        handleStageChange(idx, "maxReminders", Number(e.target.value))
                      }
                      style={{
                        padding: "6px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-light)",
                        fontSize: 12.5,
                        background: "var(--bg-surface)",
                      }}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmittingWf}
              onClick={() => setCreateWfOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmittingWf}>
              Save Workflow Template
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* EDIT WORKFLOW TEMPLATE MODAL */}
      <ModalDialog
        isOpen={editWfOpen}
        onClose={() => !isSubmittingWf && setEditWfOpen(false)}
        title="Edit Workflow Template"
        description="Update stage sequence, approvers, and automated dispatch intervals."
        maxWidth="620px"
      >
        <form onSubmit={handleEditWorkflow} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600 }}>
            <span>Template Name</span>
            <input
              type="text"
              required
              value={wfName}
              onChange={(e) => setWfName(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-light)",
                fontSize: 13,
              }}
            />
          </label>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
              Sequential Approval Stages
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={<Plus size={13} />}
              onClick={handleAddStage}
            >
              Add Stage
            </Button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: "360px", overflowY: "auto", paddingRight: 4 }}>
            {wfStages.map((stage, idx) => (
              <div
                key={idx}
                style={{
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--border-light)",
                  borderRadius: "var(--radius-md)",
                  padding: "14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Badge variant="info">Stage #{idx + 1}</Badge>
                  {wfStages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveStage(idx)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--urgency-rose)",
                        fontSize: 12,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Trash2 size={12} />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600 }}>
                    <span>Primary Approver *</span>
                    <select
                      required
                      value={stage.contactId}
                      onChange={(e) => handleStageChange(idx, "contactId", e.target.value)}
                      style={{
                        padding: "7px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-light)",
                        fontSize: 12.5,
                        background: "var(--bg-surface)",
                      }}
                    >
                      <option value="">Select contact...</option>
                      {activeContacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.email})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600 }}>
                    <span>Backup Approver</span>
                    <select
                      value={stage.backupContactId}
                      onChange={(e) => handleStageChange(idx, "backupContactId", e.target.value)}
                      style={{
                        padding: "7px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-light)",
                        fontSize: 12.5,
                        background: "var(--bg-surface)",
                      }}
                    >
                      <option value="">None (Optional)</option>
                      {activeContacts
                        .filter((c) => c.id !== stage.contactId)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.email})
                          </option>
                        ))}
                    </select>
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600 }}>
                    <span>Reminder Interval (Hours)</span>
                    <input
                      type="number"
                      min={1}
                      max={720}
                      value={stage.reminderIntervalHours}
                      onChange={(e) =>
                        handleStageChange(idx, "reminderIntervalHours", Number(e.target.value))
                      }
                      style={{
                        padding: "6px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-light)",
                        fontSize: 12.5,
                        background: "var(--bg-surface)",
                      }}
                    />
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600 }}>
                    <span>Max Reminders</span>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={stage.maxReminders}
                      onChange={(e) =>
                        handleStageChange(idx, "maxReminders", Number(e.target.value))
                      }
                      style={{
                        padding: "6px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-light)",
                        fontSize: 12.5,
                        background: "var(--bg-surface)",
                      }}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmittingWf}
              onClick={() => setEditWfOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmittingWf}>
              Save Changes
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* DELETE WORKFLOW CONFIRM MODAL */}
      <ModalDialog
        isOpen={Boolean(deleteWfTarget)}
        onClose={() => !isSubmittingWf && setDeleteWfTarget(null)}
        title="Delete Workflow Template"
        maxWidth="460px"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Are you sure you want to permanently delete the workflow template{" "}
            <strong style={{ color: "var(--text-primary)" }}>&ldquo;{deleteWfTarget?.name}&rdquo;</strong>?
            This action cannot be undone.
          </p>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmittingWf}
              onClick={() => setDeleteWfTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              isLoading={isSubmittingWf}
              onClick={() => void handleDeleteWorkflow()}
            >
              Delete Workflow
            </Button>
          </div>
        </div>
      </ModalDialog>
    </>
  );
}
