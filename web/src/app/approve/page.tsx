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

function getApiBase(): string {
  if (typeof window !== "undefined") {
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    if (envUrl && !envUrl.includes("localhost")) {
      return envUrl;
    }
    if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      return `${window.location.protocol}//${window.location.hostname}:3001`;
    }
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
}

const apiBase = getApiBase();

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

  // OTP state
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [actionToken, setActionToken] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Reassignment state
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignReason, setReassignReason] = useState("");
  const [reassignEmail, setReassignEmail] = useState("");

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

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
        const data = (await response.json()) as ApprovalDetails;
        setDetails(data);
        // Automatically request OTP code for seamless UX
        void triggerOtpRequest(approvalToken);
      })
      .catch((requestError: unknown) => {
        setError(requestError instanceof Error ? requestError.message : "Unable to load this approval.");
      })
      .finally(() => setIsLoading(false));
  }, []);

  async function triggerOtpRequest(tokenOverride?: string) {
    const t = tokenOverride || tokenRef.current;
    if (!t) return;
    setIsRequestingOtp(true);
    setError("");
    try {
      const response = await fetch(`${apiBase}/approvals/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message || "Could not request OTP verification code.");
      }

      const data = (await response.json()) as { status: string; developmentCode?: string };
      setResendCooldown(60);
      if (data.developmentCode) {
        setDevCode(data.developmentCode);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send verification code.");
    } finally {
      setIsRequestingOtp(false);
    }
  }

  async function verifyOtp(codeToVerify?: string) {
    const code = (codeToVerify || otpCode).trim();
    if (!code || !/^\d{6}$/.test(code)) {
      setError("Please enter a valid 6-digit verification code.");
      return;
    }

    setError("");
    setIsVerifyingOtp(true);
    try {
      const response = await fetch(`${apiBase}/approvals/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenRef.current, code }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message || "Invalid or expired verification code.");
      }

      const data = (await response.json()) as { actionToken: string };
      setActionToken(data.actionToken);
      setIsOtpVerified(true);
      setNotice("Identity verified successfully! You may now review and action this batch.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setIsVerifyingOtp(false);
    }
  }

  async function submitAction(action: "complete" | "return") {
    if (!actionToken) {
      setError("Email OTP verification required before actioning.");
      return;
    }

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
        body: JSON.stringify({
          token: actionToken,
          comment: comment.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message || "This approval could not be completed. The link may have already been used.");
      }

      setNotice(
        action === "complete"
          ? "Approval recorded successfully! The workflow has moved to the next stage."
          : "Batch returned with your correction comment. The prior stage has been re-alerted."
      );
      setDetails(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to submit this approval.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitReassignment() {
    if (!reassignReason.trim()) {
      setError("Please specify a reason for requesting reassignment.");
      return;
    }

    const t = actionToken || tokenRef.current;
    if (!t) return;

    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch(`${apiBase}/approvals/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: t,
          reason: reassignReason.trim(),
          requestedContactEmail: reassignEmail.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message || "Could not submit reassignment request.");
      }

      setNotice("Reassignment request submitted successfully! The Client Administrator has been flagged to review and reassign this stage.");
      setShowReassignModal(false);
      setDetails(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request reassignment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const totalBalance = details?.bills.reduce((sum, bill) => sum + Number(bill.balanceDue), 0) ?? 0;

  return (
    <main className="approval-page">
      <header className="approval-brand">
        <span className="brand-mark" aria-hidden="true">T</span>
        <span className="brand-name">ThoorigAI<span>Bill collection tracker</span></span>
      </header>
      <section className="approval-content">
        <div className="approval-heading">
          <p className="eyebrow">APPROVER REVIEW PORTAL</p>
          <h1>Batch approval</h1>
        </div>

        {isLoading && <p className="approval-loading" role="status">Loading approval details...</p>}
        {notice && <p className="approval-success" role="status">{notice}</p>}
        {error && <p className="approval-error" role="alert">{error}</p>}

        {!isLoading && !notice && details && (
          <section className="approval-panel" aria-labelledby="batch-title">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
              <div>
                <p className="eyebrow">STAGE {details.stageOrder} · IN-PROGRESS</p>
                <h2 id="batch-title">{details.organizationName}</h2>
                <p className="approval-batch-meta">Batch ID: {details.batchId}</p>
              </div>
              <div>
                <span className={`status-pill ${isOtpVerified ? "status-connected" : "status-alerted"}`}>
                  <i />
                  {isOtpVerified ? "Verified Approver" : "OTP Verification Required"}
                </span>
              </div>
            </div>

            {/* OTP Security Verification Step */}
            {!isOtpVerified && (
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 18, margin: "20px 0" }}>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "1.05rem", color: "#0f172a" }}>🛡️ Identity Verification</h3>
                <p style={{ margin: "0 0 12px 0", fontSize: "0.88rem", color: "#475569" }}>
                  To ensure authorization security, please enter the 6-digit verification code sent to your registered approver email.
                </p>

                {devCode && (
                  <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", padding: "10px 14px", borderRadius: 6, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <span style={{ fontSize: "0.85rem", color: "#065f46" }}>
                      <strong>Demo/Local Mode:</strong> Test verification code is <code style={{ fontSize: "1rem", fontWeight: "bold", letterSpacing: 1 }}>{devCode}</code>
                    </span>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                      onClick={() => {
                        setOtpCode(devCode);
                        void verifyOtp(devCode);
                      }}
                    >
                      ✨ Auto-Fill & Verify
                    </button>
                  </div>
                )}

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Enter 6-digit OTP"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    style={{ padding: "8px 12px", fontSize: "1.1rem", letterSpacing: 4, width: 170, textAlign: "center", border: "1px solid #cbd5e1", borderRadius: 6 }}
                  />
                  <button
                    className="primary-button"
                    type="button"
                    disabled={isVerifyingOtp || otpCode.length !== 6}
                    onClick={() => void verifyOtp()}
                  >
                    {isVerifyingOtp ? "Verifying..." : "Verify Code"}
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={isRequestingOtp || resendCooldown > 0}
                    onClick={() => void triggerOtpRequest()}
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
                  </button>
                </div>
              </div>
            )}

            {/* Bills Breakdown */}
            <h3 style={{ fontSize: "0.95rem", color: "#334155", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 20 }}>
              Bills in this Batch ({details.bills.length})
            </h3>
            <table className="approval-bills">
              <thead>
                <tr>
                  <th>Bill Number</th>
                  <th>Original Amount</th>
                  <th>Balance Due</th>
                  <th>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {details.bills.map((bill) => (
                  <tr key={bill.billNumber}>
                    <td><strong>{bill.billNumber}</strong></td>
                    <td>{formatCurrency(bill.amount)}</td>
                    <td><strong style={{ color: "#0f766e" }}>{formatCurrency(bill.balanceDue)}</strong></td>
                    <td>{bill.dueDate ? new Date(bill.dueDate).toLocaleDateString() : "Immediate"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="approval-total">
              <span>Total balance for approval</span>
              <strong>{formatCurrency(totalBalance)}</strong>
            </div>

            {/* Actions Panel - Unlocked only after OTP */}
            {isOtpVerified ? (
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: 6 }} htmlFor="approval-comment">
                  Approval Notes / Return Correction Details
                </label>
                <textarea
                  id="approval-comment"
                  className="approval-comment"
                  placeholder="Optional note for approval. Required when returning the batch for revision."
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  maxLength={2000}
                  rows={3}
                />
                <div className="approval-actions" style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end", marginTop: 14 }}>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setShowReassignModal(true)}
                    style={{ marginRight: "auto" }}
                  >
                    🔄 Request reassignment
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void submitAction("return")}
                  >
                    ↩️ Return for revision
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void submitAction("complete")}
                  >
                    {isSubmitting ? "Submitting..." : "✅ Approve batch"}
                  </button>
                </div>
              </div>
            ) : (
              <p style={{ marginTop: 16, fontSize: "0.85rem", color: "#64748b", fontStyle: "italic" }}>
                🔒 Complete the 6-digit email OTP verification above to unlock Approve, Return, and Reassign actions.
              </p>
            )}

            {/* Reassignment Modal */}
            {showReassignModal && (
              <div style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(15, 23, 42, 0.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
                padding: 16,
              }}>
                <div style={{
                  background: "#fff",
                  borderRadius: 12,
                  maxWidth: 480,
                  width: "100%",
                  padding: 24,
                  boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
                }}>
                  <h3 style={{ margin: "0 0 8px 0", fontSize: "1.2rem", color: "#0f172a" }}>Request Step Reassignment</h3>
                  <p style={{ margin: "0 0 16px 0", fontSize: "0.88rem", color: "#64748b" }}>
                    If you are unavailable or not the correct person for this stage, flag this batch for the Client Administrator to reassign.
                  </p>

                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                    Reason for Reassignment <span style={{ color: "#e11d48" }}>*</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. On extended leave, out of office, or transferred to another team"
                    value={reassignReason}
                    onChange={(e) => setReassignReason(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", marginBottom: 14 }}
                  />

                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                    Suggested Replacement Email (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. colleague@example.com"
                    value={reassignEmail}
                    onChange={(e) => setReassignEmail(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", marginBottom: 20 }}
                  />

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={isSubmitting}
                      onClick={() => setShowReassignModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="primary-button"
                      disabled={isSubmitting || !reassignReason.trim()}
                      onClick={() => void submitReassignment()}
                    >
                      {isSubmitting ? "Submitting..." : "Submit Reassignment"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </section>
    </main>
  );
}
