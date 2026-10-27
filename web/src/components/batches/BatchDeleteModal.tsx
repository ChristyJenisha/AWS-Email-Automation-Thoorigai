"use client";

import React from "react";
import { ModalDialog, Button } from "../ui";
import { formatBatchId } from "../../lib/utils";
import { BatchRecord } from "../../types";

interface BatchDeleteModalProps {
  target: BatchRecord | null;
  onClose: () => void;
  deleteError: string | null;
  isSubmitting: boolean;
  onDelete: () => Promise<void>;
}

export function BatchDeleteModal({
  target,
  onClose,
  deleteError,
  isSubmitting,
  onDelete,
}: BatchDeleteModalProps) {
  if (!target) return null;

  return (
    <ModalDialog
      isOpen={Boolean(target)}
      onClose={onClose}
      title="Delete Batch"
      description="Are you sure you want to permanently delete this approval batch and its associated invoices?"
    >
      <div style={{ display: "grid", gap: 14 }}>
        <div
          style={{
            padding: "12px",
            background: "var(--urgency-rose-bg)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--urgency-rose-border)",
            fontSize: 13,
            color: "var(--urgency-rose)",
          }}
        >
          <p style={{ margin: 0, fontWeight: 600 }}>This action cannot be undone.</p>
          <p style={{ margin: "4px 0 0", fontSize: 12 }}>
            Batch {formatBatchId(target.id)} with {(target.bills ?? []).length} invoices will be removed.
          </p>
        </div>

        {deleteError && (
          <div
            style={{
              padding: "8px 12px",
              background: "var(--urgency-rose-bg)",
              color: "var(--urgency-rose)",
              borderRadius: "var(--radius-sm)",
              fontSize: 12,
            }}
          >
            {deleteError}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void onDelete()}
            isLoading={isSubmitting}
          >
            Delete Permanently
          </Button>
        </div>
      </div>
    </ModalDialog>
  );
}
