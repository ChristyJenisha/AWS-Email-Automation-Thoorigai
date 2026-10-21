"use client";

import React, { FormEvent } from "react";
import { X, Plus } from "lucide-react";

type AddDemoBillModalProps = {
  isOpen: boolean;
  onClose: () => void;
  draft: { customer: string; invoice: string; amount: string; due: string };
  setDraft: (draft: { customer: string; invoice: string; amount: string; due: string }) => void;
  onAddBill: (e: FormEvent<HTMLFormElement>) => void;
};

export function AddDemoBillModal({
  isOpen,
  onClose,
  draft,
  setDraft,
  onAddBill,
}: AddDemoBillModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="bill-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">DEMO WORKSPACE</p>
            <h2 id="dialog-title">Add a bill</h2>
          </div>
          <button className="dialog-close" onClick={onClose} aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>
        <p className="dialog-description">Add a sample receivable to this temporary dashboard.</p>

        <form onSubmit={onAddBill}>
          <label>
            Customer name
            <input
              required
              autoFocus
              value={draft.customer}
              onChange={(event) => setDraft({ ...draft, customer: event.target.value })}
              placeholder="e.g. Acme Industries"
            />
          </label>
          <div className="form-two-columns">
            <label>
              Invoice number
              <input
                required
                value={draft.invoice}
                onChange={(event) => setDraft({ ...draft, invoice: event.target.value })}
                placeholder="e.g. INV-2482"
              />
            </label>
            <label>
              Amount (INR)
              <input
                required
                min="1"
                type="number"
                inputMode="numeric"
                value={draft.amount}
                onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
                placeholder="0"
              />
            </label>
          </div>
          <label>
            Due date
            <input
              required
              type="date"
              value={draft.due}
              onChange={(event) => setDraft({ ...draft, due: event.target.value })}
            />
          </label>
          <div className="dialog-actions">
            <button className="secondary-button" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-button" type="submit">
              <Plus size={14} />
              <span>Add to demo</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

