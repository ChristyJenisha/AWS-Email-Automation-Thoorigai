"use client";

import React from "react";
import { Receipt, FileText, Upload, RefreshCw, ExternalLink } from "lucide-react";
import { BatchRecord, PaymentRecord } from "../../types";
import { formatExactCurrency, formatBatchId } from "../../lib/utils";

type PaymentHistorySectionProps = {
  liveBatches: BatchRecord[];
  paymentRecords: Record<string, PaymentRecord[]>;
  proofLinks: Record<string, string>;
  isUploadingProofFor: string | null;
  onCreatePaymentProofViewLink: (paymentId: string) => Promise<void>;
  onAttachPaymentProof: (paymentId: string, file: File) => Promise<void>;
};

export function PaymentHistorySection({
  liveBatches,
  paymentRecords,
  proofLinks,
  isUploadingProofFor,
  onCreatePaymentProofViewLink,
  onAttachPaymentProof,
}: PaymentHistorySectionProps) {
  const batchesWithPayments = liveBatches.filter(
    (b) => (paymentRecords[b.id]?.length ?? 0) > 0
  );

  if (batchesWithPayments.length === 0) return null;

  return (
    <section className="payment-review" aria-labelledby="payment-history-title">
      <div className="workflow-header">
        <div>
          <p className="eyebrow">PAYMENT HISTORY</p>
          <h3 id="payment-history-title">Recorded payments</h3>
        </div>
        <span className="status-pill status-connected">
          <Receipt size={13} />
          Audit logged
        </span>
      </div>

      <div className="payment-review-list">
        {batchesWithPayments.map((batch) => (
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
                    {payment.reference || "No payment reference"}
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
                        : "Attach proof"}
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
        ))}
      </div>
    </section>
  );
}

