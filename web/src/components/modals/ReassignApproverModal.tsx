"use client";

import React, { FormEvent } from "react";
import { X, UserX, UserPlus } from "lucide-react";
import { ContactRecord } from "../../types";
import { formatBatchId } from "../../lib/utils";

type ReassignApproverModalProps = {
  isOpen: boolean;
  onClose: () => void;
  reassignTarget: { batchId: string; stepId: string; currentContactName?: string } | null;
  contacts: ContactRecord[];
  reassignNewContactId: string;
  setReassignNewContactId: (id: string) => void;
  reassignReason: string;
  setReassignReason: (reason: string) => void;
  isSubmittingReassign: boolean;
  onSubmitReassign: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  onOpenContactsDialog: () => void;
};

export function ReassignApproverModal({
  isOpen,
  onClose,
  reassignTarget,
  contacts,
  reassignNewContactId,
  setReassignNewContactId,
  reassignReason,
  setReassignReason,
  isSubmittingReassign,
  onSubmitReassign,
  onOpenContactsDialog,
}: ReassignApproverModalProps) {
  if (!isOpen || !reassignTarget) return null;

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isSubmittingReassign) onClose();
      }}
    >
      <section
        className="bill-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reassign-dialog-title"
        style={{ maxWidth: 480 }}
      >
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">ADMIN ACTION · STAGE REASSIGNMENT</p>
            <h2 id="reassign-dialog-title">Reassign Workflow Step</h2>
          </div>
          <button
            className="dialog-close"
            type="button"
            onClick={onClose}
            disabled={isSubmittingReassign}
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        <p className="dialog-description">
          Reassign active step for Batch <strong>{formatBatchId(reassignTarget.batchId)}</strong> from{" "}
          {reassignTarget.currentContactName || "current approver"} to another active organization contact.
        </p>

        <form onSubmit={onSubmitReassign}>
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>
                Select Replacement Approver <span style={{ color: "var(--urgency-rose)" }}>*</span>
              </label>
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  onClose();
                  onOpenContactsDialog();
                }}
              >
                <UserPlus size={12} />
                <span>New Contact</span>
              </button>
            </div>
            <select
              value={reassignNewContactId}
              onChange={(e) => setReassignNewContactId(e.target.value)}
              required
              className="reassign-select"
            >
              <option value="">-- Choose active contact --</option>
              {contacts
                .filter((c) => c.isActive)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.email} ({c.role})
                  </option>
                ))}
            </select>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: 6,
              }}
            >
              Reason Note (Optional, audit logged)
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Primary approver on leave; reassigned per email request"
              value={reassignReason}
              onChange={(e) => setReassignReason(e.target.value)}
              className="reassign-textarea"
            />
          </div>

          <div className="dialog-actions">
            <button
              className="secondary-button"
              type="button"
              disabled={isSubmittingReassign}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="primary-button"
              type="submit"
              disabled={isSubmittingReassign || !reassignNewContactId}
            >
              <UserX size={14} />
              <span>{isSubmittingReassign ? "Reassigning..." : "Confirm Reassignment"}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

