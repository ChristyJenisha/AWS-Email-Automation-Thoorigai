"use client";

import React, { FormEvent } from "react";
import { X, CreditCard, CheckCircle2 } from "lucide-react";
import { BatchRecord, PaymentLineDraft, PaymentRecord } from "../../types";
import { formatExactCurrency } from "../../lib/utils";

type PaymentEntryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  paymentBatch: BatchRecord | null;
  onAccountPaymentId: string | null;
  isOnAccountEntry: boolean;
  onAccountAmount: string;
  setOnAccountAmount: (amount: string) => void;
  paymentLines: PaymentLineDraft[];
  setPaymentLines: React.Dispatch<React.SetStateAction<PaymentLineDraft[]>>;
  paymentDate: string;
  setPaymentDate: (date: string) => void;
  paymentReference: string;
  setPaymentReference: (ref: string) => void;
  paymentRecords: Record<string, PaymentRecord[]>;
  isSavingPayment: boolean;
  onCreatePayment: (e: FormEvent<HTMLFormElement>) => Promise<void>;
};

export function PaymentEntryModal({
  isOpen,
  onClose,
  paymentBatch,
  onAccountPaymentId,
  isOnAccountEntry,
  onAccountAmount,
  setOnAccountAmount,
  paymentLines,
  setPaymentLines,
  paymentDate,
  setPaymentDate,
  paymentReference,
  setPaymentReference,
  paymentRecords,
  isSavingPayment,
  onCreatePayment,
}: PaymentEntryModalProps) {
  if (!isOpen) return null;

  const availableOnAccount = Number(
    paymentRecords[paymentBatch?.id ?? ""]?.find((p) => p.id === onAccountPaymentId)
      ?.unallocatedAmount ?? 0
  );

  const settlementTotal = paymentLines.reduce(
    (sum, line) => sum + Number(line.amount || 0) + Number(line.deductionAmount || 0),
    0
  );

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSavingPayment) onClose();
      }}
    >
      <section
        className="bill-dialog payment-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-dialog-title"
      >
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">BATCH {paymentBatch?.id?.slice(0, 8)}</p>
            <h2 id="payment-dialog-title">
              {onAccountPaymentId
                ? "Allocate on-account payment"
                : isOnAccountEntry
                ? "Record on-account payment"
                : "Allocate payment"}
            </h2>
          </div>
          <button
            className="dialog-close"
            type="button"
            disabled={isSavingPayment}
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        <p className="dialog-description">
          {isOnAccountEntry
            ? "Record the received amount now and assign it to bills later."
            : onAccountPaymentId
            ? "Apply the remaining on-account balance to bills. Cash plus deductions cannot exceed that balance."
            : "Allocate cash by bill. Deductions also reduce bill balances and count toward the settlement total."}
        </p>

        <form onSubmit={onCreatePayment}>
          {isOnAccountEntry ? (
            <label className="on-account-amount">
              Amount received (INR)
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                inputMode="decimal"
                value={onAccountAmount}
                onChange={(event) => setOnAccountAmount(event.target.value)}
                placeholder="0.00"
              />
            </label>
          ) : (
            <>
              {onAccountPaymentId && (
                <div className="on-account-available">
                  <span>Available to allocate:</span>
                  <strong>{formatExactCurrency(availableOnAccount)}</strong>
                </div>
              )}
              <div className="payment-allocation-list">
                {paymentLines.map((line, index) => (
                  <div className="payment-allocation-row" key={line.billId}>
                    <div className="payment-bill-summary">
                      <strong>{line.billNumber}</strong>
                      <span>{formatExactCurrency(line.balanceDue)} remaining</span>
                    </div>
                    <label>
                      Cash applied
                      <input
                        type="number"
                        min="0"
                        max={line.balanceDue}
                        step="0.01"
                        inputMode="decimal"
                        value={line.amount}
                        onChange={(event) =>
                          setPaymentLines((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, amount: event.target.value } : item
                            )
                          )
                        }
                        placeholder="0.00"
                      />
                    </label>
                    <label>
                      Deduction
                      <input
                        type="number"
                        min="0"
                        max={line.balanceDue}
                        step="0.01"
                        inputMode="decimal"
                        value={line.deductionAmount}
                        onChange={(event) =>
                          setPaymentLines((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, deductionAmount: event.target.value }
                                : item
                            )
                          )
                        }
                        placeholder="0.00"
                      />
                    </label>
                    <label>
                      Type
                      <select
                        value={line.deductionType}
                        onChange={(event) =>
                          setPaymentLines((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, deductionType: event.target.value }
                                : item
                            )
                          )
                        }
                      >
                        <option value="">None</option>
                        <option value="TDS">TDS</option>
                        <option value="RETENTION">Retention</option>
                        <option value="PENALTY">Penalty</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </label>
                  </div>
                ))}
              </div>
            </>
          )}

          {!onAccountPaymentId && (
            <div className="payment-metadata">
              <label>
                Payment date
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(event) => setPaymentDate(event.target.value)}
                />
              </label>
              <label>
                Reference / UTR
                <input
                  maxLength={200}
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                  placeholder="Optional bank ref / UTR"
                />
              </label>
            </div>
          )}

          {!isOnAccountEntry && (
            <div className="payment-total">
              <span>{onAccountPaymentId ? "Amount allocated" : "Settlement total"}</span>
              <strong>{formatExactCurrency(settlementTotal)}</strong>
            </div>
          )}

          <div className="dialog-actions">
            <button
              className="secondary-button"
              type="button"
              disabled={isSavingPayment}
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="primary-button" type="submit" disabled={isSavingPayment}>
              <CreditCard size={14} />
              <span>
                {isSavingPayment
                  ? "Saving..."
                  : isOnAccountEntry
                  ? "Record on account"
                  : onAccountPaymentId
                  ? "Allocate funds"
                  : "Save allocations"}
              </span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

