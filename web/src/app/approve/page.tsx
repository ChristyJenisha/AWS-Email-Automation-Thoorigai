"use client";

import { useEffect, useRef, useState } from "react";

type ApprovalDetails = {
  stepInstanceId: string;
  batchId: string;
  organizationName: string;
  stageOrder: number;
  bills: Array<{
    billNumber: string;
    amount: number | string;
    balanceDue: number | string;
    dueDate: string | null;
  }>;
};

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const formatCurrency = (amount: number | string) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(amount));

export default function ApprovalPage() {
  const tokenRef = useRef("");
  const [details, setDetails] = useState<ApprovalDetails | null>(null);
  const [comment, setComment] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const approvalToken = new URLSearchParams(window.location.search).get("token");
    if (!approvalToken) {
      void Promise.resolve().then(() => {
        setError("This approval link is missing its token. Ask the sender for a new link.");
        setIsLoading(false);
      });
      return;
    }

    tokenRef.current = approvalToken;

    void fetch(`${apiBase}/approvals/inspect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: approvalToken }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("This approval link is invalid, expired, or already actioned.");
        setDetails((await response.json()) as ApprovalDetails);
      })
      .catch((requestError: unknown) => {
        setError(requestError instanceof Error ? requestError.message : "Unable to load this approval.");
      })
      .finally(() => setIsLoading(false));
  }, []);

  async function submitAction(action: "complete" | "return") {
    if (action === "return" && !comment.trim()) {
      setError("Add a comment before returning this batch.");
      return;
    }

    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch(`${apiBase}/approvals/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenRef.current, comment: action === "return" ? comment.trim() : undefined }),
      });
      if (!response.ok) throw new Error("This approval could not be completed. The link may have already been used.");
      setNotice(action === "complete" ? "Approval recorded. This link can no longer be used." : "Batch returned with your comment. This link can no longer be used.");
      setDetails(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to submit this approval.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const totalBalance = details?.bills.reduce((sum, bill) => sum + Number(bill.balanceDue), 0) ?? 0;

  return (
    <main className="approval-page">
      <header className="approval-brand">
        <span className="brand-mark" aria-hidden="true">T</span>
        <span className="brand-name">ThoorigAI<span>Bill collection</span></span>
      </header>
      <section className="approval-content">
        <div className="approval-heading">
          <p className="eyebrow">APPROVER REVIEW</p>
          <h1>Batch approval</h1>
        </div>

        {isLoading && <p className="approval-loading" role="status">Loading approval details...</p>}
        {notice && <p className="approval-success" role="status">{notice}</p>}
        {!isLoading && !notice && details && (
          <section className="approval-panel" aria-labelledby="batch-title">
            <p className="eyebrow">STAGE {details.stageOrder}</p>
            <h2 id="batch-title">{details.organizationName}</h2>
            <p className="approval-batch-meta">Batch {details.batchId}</p>
            <table className="approval-bills">
              <thead><tr><th>Bill</th><th>Balance due</th></tr></thead>
              <tbody>
                {details.bills.map((bill) => (
                  <tr key={bill.billNumber}>
                    <td>{bill.billNumber}</td>
                    <td>{formatCurrency(bill.balanceDue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="approval-total"><span>Total balance</span><strong>{formatCurrency(totalBalance)}</strong></div>
            <label className="sr-only" htmlFor="approval-comment">Comment for returning this batch</label>
            <textarea
              id="approval-comment"
              className="approval-comment"
              placeholder="Comment required when returning the batch"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={2000}
            />
            <div className="approval-actions">
              <button className="secondary-button" type="button" disabled={isSubmitting} onClick={() => void submitAction("return")}>
                Return with comment
              </button>
              <button className="primary-button" type="button" disabled={isSubmitting} onClick={() => void submitAction("complete")}>
                {isSubmitting ? "Submitting..." : "Approve batch"}
              </button>
            </div>
          </section>
        )}
        {error && <p className="approval-error" role="alert">{error}</p>}
      </section>
    </main>
  );
}
