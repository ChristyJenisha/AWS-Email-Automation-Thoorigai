"use client";

import React from "react";
import { CreditCard, Trash2, PlusCircle, CheckSquare } from "lucide-react";
import { AppUser, BatchRecord, PaymentRecord } from "../../types";
import { formatExactCurrency, formatBatchId } from "../../lib/utils";

type PaymentReviewSectionProps = {
  liveBatches: BatchRecord[];
  paymentRecords: Record<string, PaymentRecord[]>;
  currentUser: AppUser | null;
  onOpenPaymentEntry: (batch: BatchRecord) => void;
  onOpenOnAccountEntry: (batch: BatchRecord) => void;
  onOpenOnAccountAllocation: (batch: BatchRecord, payment: PaymentRecord) => void;
  onDeleteBatch: (batchId: string) => Promise<void>;
};

export function PaymentReviewSection({
  liveBatches,
  paymentRecords,
  currentUser,
  onOpenPaymentEntry,
  onOpenOnAccountEntry,
  onOpenOnAccountAllocation,
  onDeleteBatch,
}: PaymentReviewSectionProps) {
  const readyBatches = liveBatches.filter((b) => b.status === "READY_FOR_PAYMENT");

  if (readyBatches.length === 0) return null;

  return (
    <section className="payment-review" aria-labelledby="payment-review-title">
      <div className="workflow-header">
        <div>
          <p className="eyebrow">PAYMENT REVIEW</p>
          <h3 id="payment-review-title">Ready for payment</h3>
        </div>
        <span className="status-pill status-ready">
          <CreditCard size={13} />
          {readyBatches.length} batch{readyBatches.length === 1 ? "" : "es"} ready
        </span>
      </div>

      <div className="payment-review-list">
        {readyBatches.map((batch) => (
          <div className="payment-review-batch" key={batch.id}>
            <div className="payment-batch-header">
              <strong>Batch {formatBatchId(batch.id)}</strong>
              <span>{batch.bills?.length ?? 0} bill(s) verified & approved</span>
            </div>

            <div className="payment-review-list">
              {(batch.bills ?? []).map((bill) => (
                <div className="payment-review-row" key={bill.id ?? bill.billNumber}>
                  <div className="bill-info">
                    <strong>{bill.billNumber}</strong>
                    <span className="bill-balance">
                      {formatExactCurrency(Number(bill.balanceDue ?? bill.amount ?? 0))} remaining
                    </span>
                  </div>
                  <span className={`status-pill status-${bill.status?.toLowerCase() ?? "pending"}`}>
                    <i />
                    {bill.status ?? "PENDING"}
                  </span>
                </div>
              ))}
            </div>

            {paymentRecords[batch.id]
              ?.filter((payment) => Number(payment.unallocatedAmount) > 0)
              .map((payment) => (
                <div className="on-account-row" key={payment.id}>
                  <div>
                    <strong>On-account balance</strong>
                    <span>
                      {formatExactCurrency(Number(payment.unallocatedAmount))} available to allocate
                    </span>
                  </div>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => onOpenOnAccountAllocation(batch, payment)}
                  >
                    <CheckSquare size={14} />
                    <span>Allocate to bills</span>
                  </button>
                </div>
              ))}

            <div className="payment-review-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => onOpenOnAccountEntry(batch)}
              >
                <PlusCircle size={14} />
                <span>Record on account</span>
              </button>

              <button
                className="primary-button"
                type="button"
                onClick={() => onOpenPaymentEntry(batch)}
              >
                <CreditCard size={14} />
                <span>Record payment</span>
              </button>

              {currentUser?.role?.toLowerCase() === "admin" && (
                <button
                  className="secondary-button danger-btn"
                  type="button"
                  onClick={() => void onDeleteBatch(batch.id)}
                  title="Delete this batch and its bills"
                >
                  <Trash2 size={14} />
                  <span>Delete batch</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

