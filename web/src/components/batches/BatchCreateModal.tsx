"use client";

import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { ModalDialog, Button } from "../ui";
import { WorkflowRecord } from "../../types";

export interface BatchBillInput {
  billNumber: string;
  amount: number;
  dueDate: string;
}

interface BatchCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflows: WorkflowRecord[];
  createTemplateId: string;
  setCreateTemplateId: (id: string) => void;
  createBills: BatchBillInput[];
  setCreateBills: React.Dispatch<React.SetStateAction<BatchBillInput[]>>;
  createBatchError: string | null;
  isSubmitting: boolean;
  onCreateBatch: () => Promise<void>;
}

export function BatchCreateModal({
  isOpen,
  onClose,
  workflows,
  createTemplateId,
  setCreateTemplateId,
  createBills,
  setCreateBills,
  createBatchError,
  isSubmitting,
  onCreateBatch,
}: BatchCreateModalProps) {
  if (!isOpen) return null;

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Approval Batch"
      description="Bundle vendor or customer bills into an automated multi-stage sign-off batch."
    >
      <div style={{ display: "grid", gap: 16 }}>
        {/* Workflow Template */}
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            Approval Workflow Template <span style={{ color: "var(--urgency-rose)" }}>*</span>
          </label>
          <select
            value={createTemplateId || workflows[0]?.id || ""}
            onChange={(e) => setCreateTemplateId(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-strong)",
              fontSize: 13,
            }}
          >
            {workflows.map((wf) => (
              <option key={wf.id} value={wf.id}>
                {wf.name} ({wf.stages?.length ?? 1} stage{(wf.stages?.length ?? 1) > 1 ? "s" : ""})
              </option>
            ))}
          </select>
        </div>

        {/* Invoices List */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, margin: 0 }}>
              Invoices / Bills in Batch <span style={{ color: "var(--urgency-rose)" }}>*</span>
            </label>
            <button
              type="button"
              onClick={() =>
                setCreateBills((prev) => [
                  ...prev,
                  { billNumber: "", amount: 0, dueDate: new Date().toISOString().slice(0, 10) },
                ])
              }
              style={{
                background: "none",
                border: "none",
                color: "var(--brand-primary)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Plus size={12} />
              <span>Add Invoice</span>
            </button>
          </div>

          <div style={{ display: "grid", gap: 8, maxHeight: 220, overflowY: "auto" }}>
            {createBills.map((bill, idx) => (
              <div
                key={idx}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 120px 130px 30px",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <input
                  type="text"
                  placeholder="Invoice # (e.g. INV-2026-01)"
                  value={bill.billNumber}
                  onChange={(e) => {
                    const updated = [...createBills];
                    updated[idx].billNumber = e.target.value;
                    setCreateBills(updated);
                  }}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-strong)",
                    fontSize: 12,
                  }}
                />
                <input
                  type="number"
                  placeholder="Amount (₹)"
                  value={bill.amount || ""}
                  onChange={(e) => {
                    const updated = [...createBills];
                    updated[idx].amount = Number(e.target.value);
                    setCreateBills(updated);
                  }}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-strong)",
                    fontSize: 12,
                  }}
                />
                <input
                  type="date"
                  value={bill.dueDate}
                  onChange={(e) => {
                    const updated = [...createBills];
                    updated[idx].dueDate = e.target.value;
                    setCreateBills(updated);
                  }}
                  style={{
                    padding: "6px 8px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-strong)",
                    fontSize: 12,
                  }}
                />
                {createBills.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setCreateBills((prev) => prev.filter((_, i) => i !== idx))}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--urgency-rose)",
                      cursor: "pointer",
                      padding: 4,
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {createBatchError && (
          <div
            style={{
              padding: "8px 12px",
              background: "var(--urgency-rose-bg)",
              color: "var(--urgency-rose)",
              borderRadius: "var(--radius-sm)",
              fontSize: 12,
            }}
          >
            {createBatchError}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void onCreateBatch()} isLoading={isSubmitting}>
            Launch Batch
          </Button>
        </div>
      </div>
    </ModalDialog>
  );
}
