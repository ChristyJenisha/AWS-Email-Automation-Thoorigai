"use client";

import { useEffect, useRef, useState } from "react";
import {
  ShieldCheck,
  Shield,
  RotateCcw,
  CheckCircle,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  UserX,
  Tag,
  Clock,
  AlertTriangle,
  FileCheck2,
  ArrowRight,
} from "lucide-react";

const RETURN_PRESETS = [
  "Amount discrepancy",
  "Missing invoice proof",
  "Duplicate bill found",
  "Incorrect payment terms",
];

type ApprovalDetails = {
  stepInstanceId: string;
  batchId: string;
  organizationName: string;
  stageOrder: number;
  status?: string;
  batchStatus?: string;
  activeStage?: {
    order: number;
    approverName: string;
    approverEmail: string;
    token: string;
    url: string;
  } | null;
  bills: Array<{
    billNumber: string;
    amount: number | string;
    balanceDue: number | string;
    dueDate: string | null;
  }>;
};

function getApiBase(): string {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_API_URL ?? "";
  }
  return process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
}

const formatCurrency = (amount: number | string) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(amount));

export default function ApprovalPage() {
  const apiBase = getApiBase();
  const tokenRef = useRef("");
  const autoVerifyAttemptedRef = useRef(false);
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

  // Verification receipt state
  const [verifiedAction, setVerifiedAction] = useState<{
    action: "complete" | "return" | "reassign";
    timestamp: string;
    comment?: string;
  } | null>(null);

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
    const urlParams = new URLSearchParams(window.location.search);
    const approvalToken = urlParams.get("token");
    const autoOtp = urlParams.get("otp") || urlParams.get("code");

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
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { message?: string };
          if (payload.message?.includes("no longer in progress") || payload.message?.includes("can be actioned")) {
            throw new Error("This bill has already been approved and completed!");
          }
          throw new Error(payload.message || "This approval link is invalid, expired, or already actioned.");
        }
        const data = (await response.json()) as ApprovalDetails;
        setDetails(data);
        if (data.status === "COMPLETED") {
          if (data.activeStage) {
            setNotice(
              `Stage ${data.stageOrder} was already approved. This batch has advanced to Stage ${data.activeStage.order}, awaiting authorization from ${data.activeStage.approverName} (${data.activeStage.approverEmail}).`
            );
          } else {
            setNotice("All approval stages for this batch have already been completed!");
          }
        } else {
          const cleanCode = autoOtp?.trim();
          if (cleanCode && /^\d{6}$/.test(cleanCode) && !autoVerifyAttemptedRef.current) {
            autoVerifyAttemptedRef.current = true;
            setOtpCode(cleanCode);
            setNotice("⚡ Automatic Magic Link: Authenticating 6-digit identity code...");
            void verifyOtp(cleanCode, approvalToken);
          } else if (!cleanCode) {
            setNotice("A 6-digit verification code has been dispatched to your registered approver email. Please enter the code below to authorize.");
          }
        }
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
        throw new Error(payload.message || "Failed to dispatch verification code.");
      }

      const payload = (await response.json()) as {
        devCode?: string;
        developmentCode?: string;
        status?: "sent" | "simulated";
        provider?: string;
        message?: string;
      };
      const code = payload.devCode || payload.developmentCode;
      if (code) {
        setDevCode(code);
      }
      setResendCooldown(60);
      if (payload.status === "simulated" || code) {
        setNotice(
          payload.message ||
            "Demo / Simulation Mode: Test verification code generated. Click 'Auto-Fill & Verify' or enter the 6-digit code below."
        );
      } else {
        setNotice(payload.message || "A 6-digit verification code has been dispatched to your email address.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send verification OTP.");
    } finally {
      setIsRequestingOtp(false);
    }
  }

  async function verifyOtp(codeToVerify?: string, tokenOverride?: string) {
    if (actionToken || isOtpVerified) {
      return;
    }
    const code = (codeToVerify || otpCode).trim();
    const token = tokenOverride || tokenRef.current;
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
        body: JSON.stringify({ token, code }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message || "Invalid or expired verification code.");
      }

      const data = (await response.json()) as { actionToken: string };
      setError("");
      setActionToken(data.actionToken);
      setIsOtpVerified(true);
      setNotice("✓ Identity verified automatically via Magic Link! You may now review each bill and submit approval.");
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

      const formattedTimestamp = new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "medium",
      }).format(new Date());

      setVerifiedAction({
        action,
        timestamp: formattedTimestamp,
        comment: comment.trim() || undefined,
      });

      setNotice(
        action === "complete"
          ? "Batch approved and verified successfully! The verification receipt is displayed below."
          : "Batch returned with your correction comment. The prior stage has been re-alerted."
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to submit this approval.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function quickVerifyAndApprove() {
    const code = devCode;
    if (!code) return;
    setOtpCode(code);
    setError("");
    setIsVerifyingOtp(true);
    setIsSubmitting(true);
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

      const approvalResponse = await fetch(`${apiBase}/approvals/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: data.actionToken,
          comment: comment.trim() || "Verified and approved.",
        }),
      });

      if (!approvalResponse.ok) {
        const payload = (await approvalResponse.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message || "Approval could not be completed.");
      }

      const formattedTimestamp = new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "medium",
      }).format(new Date());

      setVerifiedAction({
        action: "complete",
        timestamp: formattedTimestamp,
        comment: comment.trim() || undefined,
      });

      setNotice("Batch approved and verified automatically! Verification receipt generated below.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quick verification failed.");
    } finally {
      setIsVerifyingOtp(false);
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

      const formattedTimestamp = new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "medium",
      }).format(new Date());

      setVerifiedAction({
        action: "reassign",
        timestamp: formattedTimestamp,
        comment: reassignReason.trim(),
      });

      setNotice("Reassignment request submitted successfully! The Client Administrator has been flagged to review and reassign this stage.");
      setShowReassignModal(false);
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

        {/* 1. POST-VERIFICATION RECEIPT VIEW (Shown after action is completed) */}
        {!isLoading && verifiedAction && details && (
          <section className="approval-panel verification-receipt-panel" aria-labelledby="receipt-title">
            <div className="receipt-header">
              <div className="receipt-status-pill">
                {verifiedAction.action === "complete" ? (
                  <span className="status-pill status-connected">
                    <CheckCircle size={14} /> Approved & Verified
                  </span>
                ) : verifiedAction.action === "return" ? (
                  <span className="status-pill status-overdue-tag">
                    <RotateCcw size={14} /> Returned for Revision
                  </span>
                ) : (
                  <span className="status-pill status-alerted">
                    <UserX size={14} /> Reassignment Requested
                  </span>
                )}
              </div>
              <span className="receipt-timestamp">Recorded: {verifiedAction.timestamp}</span>
            </div>

            <div className="receipt-title-box">
              <h2 id="receipt-title">
                {verifiedAction.action === "complete"
                  ? "Stage Verification Completed"
                  : verifiedAction.action === "return"
                  ? "Batch Returned for Revision"
                  : "Reassignment Initiated"}
              </h2>
              <p className="approval-batch-meta">
                Organization: <strong>{details.organizationName}</strong> · Batch ID: {details.batchId} · Stage #{details.stageOrder}
              </p>
            </div>

            {/* LIST OF VERIFIED BILLS */}
            <div className="receipt-bills-wrap">
              <div className="receipt-bills-head">
                <h3>
                  <FileCheck2 size={16} className="text-forest" />
                  Bills Verified in this Process ({details.bills.length})
                </h3>
                <span className="receipt-verified-count">
                  ✓ All {details.bills.length} bills confirmed in Stage {details.stageOrder}
                </span>
              </div>

              <table className="approval-bills">
                <thead>
                  <tr>
                    <th>Bill Number</th>
                    <th>Original Amount</th>
                    <th>Balance Due</th>
                    <th>Due Date</th>
                    <th>Verification Status</th>
                  </tr>
                </thead>
                <tbody>
                  {details.bills.map((bill) => (
                    <tr key={bill.billNumber}>
                      <td>
                        <strong>{bill.billNumber}</strong>
                      </td>
                      <td>{formatCurrency(bill.amount)}</td>
                      <td>
                        <strong style={{ color: "var(--brand-primary)" }}>{formatCurrency(bill.balanceDue)}</strong>
                      </td>
                      <td>{bill.dueDate ? new Date(bill.dueDate).toLocaleDateString() : "Immediate"}</td>
                      <td>
                        <span className={`status-pill ${verifiedAction.action === "complete" ? "status-connected" : "status-alerted"}`}>
                          <CheckCircle2 size={12} />
                          {verifiedAction.action === "complete"
                            ? `Verified in Stage ${details.stageOrder}`
                            : verifiedAction.action === "return"
                            ? "Returned for Revision"
                            : "Reassign Pending"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="approval-total">
                <span>Total Verified Balance</span>
                <strong>{formatCurrency(totalBalance)}</strong>
              </div>
            </div>

            {verifiedAction.comment && (
              <div className="receipt-notes-box">
                <strong>Your Verification Note / Comment:</strong>
                <p>{verifiedAction.comment}</p>
              </div>
            )}

            <div className="receipt-next-steps">
              <CheckCircle2 size={20} className="text-forest" />
              <div>
                <strong>Audit Record Confirmed & Stored</strong>
                <p>
                  {verifiedAction.action === "complete"
                    ? `Stage ${details.stageOrder} is marked COMPLETED in PostgreSQL. Automated email notifications have been dispatched to the next-stage approvers and client dashboard.`
                    : "The batch has been returned to the submitter with your notes. An audit log has been created."}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* 2. COMPLETED STAGE NOTICE PANEL (Shown when opening a previously completed stage link) */}
        {!isLoading && !verifiedAction && details && details.status === "COMPLETED" && (
          <section className="approval-panel" aria-labelledby="completed-stage-title">
            <div style={{ background: "var(--brand-light)", border: "1px solid var(--brand-border)", borderRadius: "var(--radius-lg)", padding: 24, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <CheckCircle2 size={24} style={{ color: "var(--brand-primary)" }} />
                <h2 id="completed-stage-title" style={{ margin: 0, fontSize: "1.25rem", color: "var(--brand-primary)", fontWeight: 700 }}>
                  Stage {details.stageOrder} Has Already Been Approved
                </h2>
              </div>
              <p style={{ margin: "0 0 16px 0", fontSize: "0.95rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                This approval link is for Stage {details.stageOrder}, which was previously authorized and marked as complete.
              </p>

              {details.activeStage ? (
                <div style={{ background: "var(--bg-surface)", border: "1px solid var(--brand-border)", borderRadius: "var(--radius-lg)", padding: 18, marginTop: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <span className="status-pill status-alerted" style={{ marginBottom: 6, display: "inline-flex" }}>
                        <Clock size={12} /> Stage {details.activeStage.order} In Progress
                      </span>
                      <h3 style={{ margin: "4px 0", fontSize: "1.05rem", color: "var(--text-primary)" }}>
                        Currently Awaiting Approval from {details.activeStage.approverName}
                      </h3>
                      <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-secondary)" }}>
                        Notification and verification code sent to: <strong>{details.activeStage.approverEmail}</strong>
                      </p>
                    </div>
                    <div>
                      <a
                        href={details.activeStage.url}
                        className="primary-button"
                        style={{
                          fontSize: "0.95rem",
                          padding: "10px 20px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          textDecoration: "none",
                        }}
                      >
                        <span>Open Stage {details.activeStage.order} Approval Portal</span>
                        <ArrowRight size={16} />
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-lg)", padding: 16, marginTop: 12 }}>
                  <p style={{ margin: 0, fontSize: "0.92rem", color: "var(--text-primary)", fontWeight: 600 }}>
                    ✓ All stages are complete! This batch is currently <strong>Ready for Payment</strong>.
                  </p>
                </div>
              )}
            </div>

            {/* Bills Breakdown */}
            <h3 style={{ fontSize: "0.95rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 20 }}>
              Bills in this Batch ({details.bills.length})
            </h3>
            <table className="approval-bills">
              <thead>
                <tr>
                  <th>Bill Number</th>
                  <th>Original Amount</th>
                  <th>Balance Due</th>
                  <th>Due Date</th>
                  <th>Stage Status</th>
                </tr>
              </thead>
              <tbody>
                {details.bills.map((bill) => (
                  <tr key={bill.billNumber}>
                    <td><strong>{bill.billNumber}</strong></td>
                    <td>{formatCurrency(bill.amount)}</td>
                    <td><strong style={{ color: "var(--brand-primary)" }}>{formatCurrency(bill.balanceDue)}</strong></td>
                    <td>{bill.dueDate ? new Date(bill.dueDate).toLocaleDateString() : "Immediate"}</td>
                    <td>
                      <span className="status-pill status-connected">
                        <CheckCircle size={11} /> Approved in Stage {details.stageOrder}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="approval-total">
              <span>Total balance</span>
              <strong>{formatCurrency(totalBalance)}</strong>
            </div>
          </section>
        )}

        {/* 3. ACTIVE APPROVAL PANEL (Shown while review is pending) */}
        {!isLoading && !verifiedAction && details && details.status !== "COMPLETED" && (
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
                  {isOtpVerified ? "✓ Identity Verified" : "OTP Verification Required"}
                </span>
              </div>
            </div>

            {/* OTP Automatically Verified Banner */}
            {isOtpVerified && (
              <div
                style={{
                  background: "var(--brand-light)",
                  border: "1px solid var(--brand-border)",
                  borderRadius: "var(--radius-lg)",
                  padding: "16px 20px",
                  margin: "20px 0",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <ShieldCheck size={24} style={{ color: "var(--brand-primary)", flexShrink: 0 }} />
                <div>
                  <h4 style={{ margin: "0 0 2px 0", fontSize: "1rem", color: "var(--brand-primary)", fontWeight: 750 }}>
                    Identity Automatically Authenticated
                  </h4>
                  <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-secondary)" }}>
                    Your 6-digit verification code was automatically recognized and authenticated from the secure link. All approval actions are unlocked below.
                  </p>
                </div>
              </div>
            )}

            {/* OTP Security Verification Step */}
            {!isOtpVerified && (
              <div style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-lg)", padding: 18, margin: "20px 0" }}>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "1.05rem", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                  <ShieldCheck size={18} className="text-forest" />
                  <span>Identity Verification</span>
                </h3>
                <p style={{ margin: "0 0 12px 0", fontSize: "0.88rem", color: "var(--text-secondary)" }}>
                  To ensure authorization security, please enter the 6-digit verification code sent to your registered approver email.
                </p>

                {devCode && (
                  <div
                    style={{
                      background: "var(--brand-light)",
                      border: "1px solid var(--brand-border)",
                      padding: "14px 18px",
                      borderRadius: "var(--radius-lg)",
                      marginBottom: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 12,
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.85rem", color: "var(--brand-primary)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                        <Sparkles size={14} />
                        <span>Instant Verification Code (Demo / Simulation Mode)</span>
                      </div>
                      <div style={{ marginTop: 4, fontSize: "0.82rem", color: "var(--brand-primary)" }}>
                        Code:{" "}
                        <code
                          style={{
                            fontSize: "1.15rem",
                            fontWeight: "bold",
                            letterSpacing: 3,
                            background: "var(--bg-surface)",
                            border: "1px solid var(--brand-border)",
                            padding: "2px 10px",
                            borderRadius: 4,
                            color: "var(--brand-primary)",
                          }}
                        >
                          {devCode}
                        </code>
                        <span style={{ marginLeft: 8, color: "var(--text-muted)", fontSize: "0.78rem" }}>
                          (Simulated locally; no external email needed)
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="primary-button"
                        style={{
                          fontSize: "0.85rem",
                          padding: "7px 16px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          background: "var(--brand-primary)",
                          borderColor: "var(--brand-primary)",
                        }}
                        disabled={isVerifyingOtp || isSubmitting}
                        onClick={() => void quickVerifyAndApprove()}
                        title="One-click identity verification and batch approval"
                      >
                        <Sparkles size={14} />
                        <span>⚡ 1-Click Verify & Approve Stage</span>
                      </button>

                      <button
                        type="button"
                        className="secondary-button"
                        style={{
                          fontSize: "0.82rem",
                          padding: "6px 12px",
                          background: "var(--bg-surface)",
                        }}
                        onClick={() => {
                          setOtpCode(devCode);
                          void verifyOtp(devCode);
                        }}
                      >
                        Auto-Fill Code
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Enter 6-digit OTP"
                    value={otpCode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      setOtpCode(val);
                      if (val.length === 6) {
                        void verifyOtp(val);
                      }
                    }}
                    style={{ padding: "8px 12px", fontSize: "1.1rem", letterSpacing: 4, width: 170, textAlign: "center", border: "1px solid var(--border-strong)", borderRadius: 6 }}
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
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <RefreshCw size={13} />
                    <span>{resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Bills Breakdown with Status in Process */}
            <h3 style={{ fontSize: "0.95rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 20 }}>
              Bills in this Batch ({details.bills.length})
            </h3>
            <table className="approval-bills">
              <thead>
                <tr>
                  <th>Bill Number</th>
                  <th>Original Amount</th>
                  <th>Balance Due</th>
                  <th>Due Date</th>
                  <th>Review Status</th>
                </tr>
              </thead>
              <tbody>
                {details.bills.map((bill) => (
                  <tr key={bill.billNumber}>
                    <td><strong>{bill.billNumber}</strong></td>
                    <td>{formatCurrency(bill.amount)}</td>
                    <td><strong style={{ color: "var(--brand-primary)" }}>{formatCurrency(bill.balanceDue)}</strong></td>
                    <td>{bill.dueDate ? new Date(bill.dueDate).toLocaleDateString() : "Immediate"}</td>
                    <td>
                      <span className={`status-pill ${isOtpVerified ? "status-ready" : "status-alerted"}`}>
                        <CheckCircle size={11} />
                        {isOtpVerified ? "Ready for Verification" : "Pending OTP Verification"}
                      </span>
                    </td>
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
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border-light)" }}>
                <div style={{ marginBottom: 12 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem", fontWeight: 650, color: "var(--text-secondary)", marginBottom: 6, textTransform: "uppercase" }}>
                    <Tag size={13} /> Return reason presets:
                  </span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {RETURN_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className="return-chip"
                        onClick={() => {
                          if (comment.includes(`[${preset}]`)) {
                            setComment("");
                          } else {
                            setComment(`[${preset}]: `);
                          }
                        }}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }} htmlFor="approval-comment">
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
                    style={{ marginRight: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <UserX size={14} />
                    <span>Request reassignment</span>
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void submitAction("return")}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, borderColor: "var(--urgency-rose-border)", color: "var(--urgency-rose)" }}
                  >
                    <RotateCcw size={14} />
                    <span>Return for revision</span>
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void submitAction("complete")}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <CheckCircle size={14} />
                    <span>{isSubmitting ? "Submitting..." : "Approve & Verify Batch"}</span>
                  </button>
                </div>
              </div>
            ) : (
              <p style={{ marginTop: 16, fontSize: "0.85rem", color: "var(--text-muted)", fontStyle: "italic", display: "flex", alignItems: "center", gap: 6 }}>
                <AlertTriangle size={15} />
                <span>Complete the 6-digit email OTP verification above to unlock Approve, Return, and Reassign actions.</span>
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
                  background: "var(--bg-surface)",
                  borderRadius: "var(--radius-xl)",
                  maxWidth: 480,
                  width: "100%",
                  padding: 24,
                  boxShadow: "var(--shadow-lg)",
                }}>
                  <h3 style={{ margin: "0 0 8px 0", fontSize: "1.2rem", color: "var(--text-primary)" }}>Request Step Reassignment</h3>
                  <p style={{ margin: "0 0 16px 0", fontSize: "0.88rem", color: "var(--text-muted)" }}>
                    If you are unavailable or not the correct person for this stage, flag this batch for the Client Administrator to reassign.
                  </p>

                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                    Reason for Reassignment <span style={{ color: "var(--urgency-rose)" }}>*</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. On extended leave, out of office, or transferred to another team"
                    value={reassignReason}
                    onChange={(e) => setReassignReason(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-strong)", marginBottom: 14 }}
                  />

                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                    Suggested Replacement Email (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. colleague@example.com"
                    value={reassignEmail}
                    onChange={(e) => setReassignEmail(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border-strong)", marginBottom: 20 }}
                  />

                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
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
                      {isSubmitting ? "Submitting..." : "Submit Request"}
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
