"use client";

import React, { useState } from "react";
import {
  CreditCard,
  Receipt,
  FileText,
  Upload,
  RefreshCw,
  ExternalLink,
  PlusCircle,
  CheckSquare,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { AppUser, BatchRecord, PaymentRecord } from "../../types";
import { formatExactCurrency, formatBatchId } from "../../lib/utils";

type SettlementsHubProps = {
  liveBatches: BatchRecord[];
  paymentRecords: Record<string, PaymentRecord[]>;
  proofLinks: Record<string, string>;
  isUploadingProofFor: string | null;
  currentUser: AppUser | null;
  onOpenPaymentEntry: (batch: BatchRecord) => void;
  onOpenOnAccountEntry: (batch: BatchRecord) => void;
  onOpenOnAccountAllocation: (batch: BatchRecord, payment: PaymentRecord) => void;
  onDeleteBatch: (batchId: string) => Promise<void>;
  onCreatePaymentProofViewLink: (paymentId: string) => Promise<void>;
  onAttachPaymentProof: (paymentId: string, file: File) => Promise<void>;
};

export function SettlementsHub({
  liveBatches,
  paymentRecords,
  proofLinks,
  isUploadingProofFor,
  currentUser,
  onOpenPaymentEntry,
  onOpenOnAccountEntry,
  onOpenOnAccountAllocation,
  onDeleteBatch,
  onCreatePaymentProofViewLink,
  onAttachPaymentProof,
}: SettlementsHubProps) {
  const readyBatches = liveBatches.filter((b) => b.status === "READY_FOR_PAYMENT");
  const batchesWithPayments = liveBatches.filter(
    (b) => (paymentRecords[b.id]?.length ?? 0) > 0
  );

  const [activeTab, setActiveTab] = useState<"awaiting" | "history">(
    readyBatches.length > 0 ? "awaiting" : "history"
  );

  if (readyBatches.length === 0 && batchesWithPayments.length === 0) {
    return null;
  }

  return (
    <section className="settlements-hub" aria-labelledby="settlements-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">PHASE 9 · PAYMENTS & SETTLEMENTS</p>
          <h2 id="settlements-title">Settlement Center</h2>
        </div>

        <div className="settlement-tabs">
          <button
            type="button"
            className={`settlement-tab-btn ${activeTab === "awaiting" ? "active" : ""}`}
            onClick={() => setActiveTab("awaiting")}
          >
            <CreditCard size={14} />
            <span>Ready for Payment ({readyBatches.length})</span>
          </button>
          <button
            type="button"
            className={`settlement-tab-btn ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            <Receipt size={14} />
            <span>Settlement History & Proofs ({batchesWithPayments.length})</span>
          </button>
        </div>
      </div>

      {activeTab === "awaiting" && (
        <div className="payment-review-list">
          {readyBatches.length === 0 ? (
            <div className="empty-state-card">
              <CheckCircle2 size={24} className="text-forest" />
              <p>No batches are currently awaiting payment. Once all approval stages complete, batches appear here automatically.</p>
            </div>
          ) : (
            readyBatches.map((batch) => (
              <div className="payment-review-batch" key={batch.id}>
                <div className="payment-batch-header">
                  <div>
                    <strong>Batch {formatBatchId(batch.id)}</strong>
                    <span className="batch-verified-note">
                      ✓ All approval stages verified ({batch.bills?.length ?? 0} bills)
                    </span>
                  </div>
                  <span className="status-pill status-ready-for-payment">
                    Ready for Payment
                  </span>
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
                        <strong>On-account balance available:</strong>
                        <span>
                          {formatExactCurrency(Number(payment.unallocatedAmount))} ready to allocate
                        </span>
                      </div>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => onOpenOnAccountAllocation(batch, payment)}
                      >
                        <CheckSquare size={13} />
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
                    <span>Record payment & allocate</span>
                  </button>

                    <button
                      className="secondary-button danger-btn"
                      type="button"
                      onClick={() => void onDeleteBatch(batch.id)}
                      title="Delete this batch and its bills"
                    >
                      <Trash2 size={13} />
                      <span>Delete</span>
                    </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "history" && (
        <div className="payment-review-list">
          {batchesWithPayments.length === 0 ? (
            <div className="empty-state-card">
              <Receipt size={24} className="text-muted" />
              <p>No settled payments recorded yet. S3 proof files and payment entries will appear here.</p>
            </div>
          ) : (
            batchesWithPayments.map((batch) => (
              <div className="payment-review-batch" key={batch.id}>
                <div className="payment-batch-header">
                  <strong>Batch {formatBatchId(batch.id)}</strong>
                  <span className="status-tag">{batch.status ?? ""}</span>
                </div>

                {paymentRecords[batch.id].map((payment) => (
                  <div className="payment-history-row" key={payment.id}>
                    <div className="payment-history-details">
                      <strong>{formatExactCurrency(Number(payment.amount))}</strong>
                      <span>
                        {payment.reference ? `Ref: ${payment.reference}` : "No payment reference"}
                        {payment.paidAt
                          ? ` · ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
                              new Date(payment.paidAt)
                            )}`
                          : ""}
                      </span>
                      {Number(payment.unallocatedAmount) > 0 && (
                        <span className="unallocated-text">
                          {formatExactCurrency(Number(payment.unallocatedAmount))} remains unallocated
                        </span>
                      )}
                    </div>

                    <div className="payment-proof-actions">
                      {payment.proofKey && (
                        <>
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={() => void onCreatePaymentProofViewLink(payment.id)}
                          >
                            <RefreshCw size={13} />
                            <span>{proofLinks[payment.id] ? "Refresh link" : "Get view link"}</span>
                          </button>
                          {proofLinks[payment.id] && (
                            <a
                              className="secondary-button view-proof-link"
                              href={proofLinks[payment.id]}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <ExternalLink size={13} />
                              <span>Open proof</span>
                            </a>
                          )}
                        </>
                      )}

                      <label className="secondary-button payment-proof-upload">
                        <Upload size={13} />
                        <span>
                          {isUploadingProofFor === payment.id
                            ? "Uploading..."
                            : payment.proofKey
                            ? "Replace proof"
                            : "Attach proof (S3)"}
                        </span>
                        <input
                          className="sr-only"
                          type="file"
                          accept="application/pdf,image/jpeg,image/png"
                          disabled={isUploadingProofFor !== null}
                          onChange={(event) => {
                            const file = event.currentTarget.files?.[0];
                            event.currentTarget.value = "";
                            if (file) void onAttachPaymentProof(payment.id, file);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}

