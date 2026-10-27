"use client";

import React from "react";
import { ModalDialog, Button } from "../ui";
import { formatBatchId, isValidConfirmNote } from "../../lib/utils";
import { BatchRecord, StepInstanceRecord } from "../../types";

export interface ConfirmModalTarget {
  batch: BatchRecord;
  step: StepInstanceRecord;
}

interface BatchConfirmModalProps {
  target: ConfirmModalTarget | null;
  onClose: () => void;
  confirmNote: string;
  setConfirmNote: (note: string) => void;
  confirmError: string | null;
  isSubmitting: boolean;
  onConfirm: () => Promise<void>;
}

export function BatchConfirmModal({
  target,
  onClose,
  confirmNote,
  setConfirmNote,
  confirmError,
  isSubmitting,
  onConfirm,
}: BatchConfirmModalProps) {
  if (!target) return null;

  return (
    <ModalDialog
      isOpen={Boolean(target)}
      onClose={onClose}
      title="Confirm on Behalf of Approver"
      description="Advance this batch to the next approval stage with an authorized audit note."
    >
      <div style={{ display: "grid", gap: 14 }}>
        <div
          style={{
            padding: "10px 14px",
            background: "var(--bg-subtle)",
            borderRadius: "var(--radius-md)",
            fontSize: 12,
          }}
        >
          <div>
            <strong>Batch:</strong> {formatBatchId(target.batch.id)}
          </div>
          <div>
            <strong>Current Approver:</strong>{" "}
            {target.step.stage?.contact?.name ?? "Assigned Approver"} (
            {target.step.stage?.contact?.email})
          </div>
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            Audit Confirmation Note (required, min 10 characters){" "}
            <span style={{ color: "var(--urgency-rose)" }}>*</span>
          </label>
          <textarea
            value={confirmNote}
            onChange={(e) => setConfirmNote(e.target.value)}
            placeholder="e.g. Approved via phone call confirmation with John on 2026-10-25..."
            rows={3}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-strong)",
              fontSize: 13,
            }}
          />
        </div>

        {confirmError && (
          <div
            style={{
              padding: "8px 12px",
              background: "var(--urgency-rose-bg)",
              color: "var(--urgency-rose)",
              borderRadius: "var(--radius-sm)",
              fontSize: 12,
            }}
          >
            {confirmError}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void onConfirm()}
            isLoading={isSubmitting}
            disabled={!isValidConfirmNote(confirmNote)}
          >
            Confirm & Forward
          </Button>
        </div>
      </div>
    </ModalDialog>
  );
}
