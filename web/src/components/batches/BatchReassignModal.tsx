"use client";

import React from "react";
import { ModalDialog, Button } from "../ui";
import { BatchRecord, ContactRecord, StepInstanceRecord } from "../../types";

export interface ReassignModalTarget {
  batch: BatchRecord;
  step: StepInstanceRecord;
}

interface BatchReassignModalProps {
  target: ReassignModalTarget | null;
  onClose: () => void;
  contacts: ContactRecord[];
  reassignContactId: string;
  setReassignContactId: (id: string) => void;
  reassignReason: string;
  setReassignReason: (reason: string) => void;
  reassignError: string | null;
  isSubmitting: boolean;
  onReassign: () => Promise<void>;
}

export function BatchReassignModal({
  target,
  onClose,
  contacts,
  reassignContactId,
  setReassignContactId,
  reassignReason,
  setReassignReason,
  reassignError,
  isSubmitting,
  onReassign,
}: BatchReassignModalProps) {
  if (!target) return null;

  return (
    <ModalDialog
      isOpen={Boolean(target)}
      onClose={onClose}
      title="Reassign Approval Step"
      description="Transfer responsibility for this stage to another active organizational contact."
    >
      <div style={{ display: "grid", gap: 14 }}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            New Approver <span style={{ color: "var(--urgency-rose)" }}>*</span>
          </label>
          <select
            value={reassignContactId}
            onChange={(e) => setReassignContactId(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-strong)",
              fontSize: 13,
            }}
          >
            <option value="">Select an active contact...</option>
            {contacts
              .filter((c) => c.isActive && c.id !== target.step.stage?.contact?.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.email}) - {c.role}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            Reason for Reassignment (optional)
          </label>
          <input
            type="text"
            value={reassignReason}
            onChange={(e) => setReassignReason(e.target.value)}
            placeholder="e.g. Primary approver on leave until Monday"
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-strong)",
              fontSize: 13,
            }}
          />
        </div>

        {reassignError && (
          <div
            style={{
              padding: "8px 12px",
              background: "var(--urgency-rose-bg)",
              color: "var(--urgency-rose)",
              borderRadius: "var(--radius-sm)",
              fontSize: 12,
            }}
          >
            {reassignError}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void onReassign()}
            isLoading={isSubmitting}
            disabled={!reassignContactId}
          >
            Confirm Reassignment
          </Button>
        </div>
      </div>
    </ModalDialog>
  );
}
