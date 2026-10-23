"use client";

import React, { useState } from "react";
import { LogIn, Shield, User, AlertCircle, KeyRound, Mail } from "lucide-react";
import { useDataContext } from "../../lib/DataContext";
import { Button } from "../ui";

export function SignInView() {
  const { loginWithCredentials } = useDataContext();
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const [email, setEmail] = useState(() =>
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? "admin@example.test" : ""
  );
  const [password, setPassword] = useState(() =>
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? "demo123" : ""
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (loginEmail: string, loginPass?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const pass = loginPass ?? password;
      const success = await loginWithCredentials(loginEmail, pass);
      if (!success) {
        setError("Sign-in failed. Please verify credentials or check that the API service is reachable.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred during sign-in.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "85vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg, 12px)",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "28px 28px 20px",
            borderBottom: "1px solid var(--border-light)",
            textAlign: "center",
            background: "var(--bg-surface)",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: "10px",
              background: "var(--brand-primary)",
              color: "var(--text-inverse)",
              fontWeight: 800,
              fontSize: 22,
              marginBottom: 12,
            }}
          >
            t
          </div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Thoorigai<span style={{ color: "var(--brand-primary)" }}>Ledger</span>
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              marginTop: 6,
              marginBottom: 0,
            }}
          >
            Sign in to access your collection dashboard and workflows
          </p>
        </div>

        {/* Content Body */}
        <div style={{ padding: "24px 28px" }}>
          {error && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "10px 14px",
                background: "var(--urgency-rose-bg)",
                border: "1px solid var(--urgency-rose-border)",
                borderRadius: "var(--radius-md)",
                color: "var(--urgency-rose)",
                fontSize: 12.5,
                lineHeight: 1.4,
                marginBottom: 20,
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>{error}</div>
            </div>
          )}

          {/* Quick Demo Logins (Only visible when NEXT_PUBLIC_DEMO_MODE=true) */}
          {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
            <>
              <div style={{ marginBottom: 22 }}>
            <span
              style={{
                display: "block",
                fontSize: 11.5,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--text-muted)",
                marginBottom: 10,
              }}
            >
              Demo Workspace Accounts
            </span>
            <div style={{ display: "grid", gap: 8 }}>
              <button
                type="button"
                onClick={() => void handleLogin("admin@example.test", "demo123")}
                disabled={isLoading}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-strong)",
                  background: "var(--bg-surface)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 140ms ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Shield size={16} style={{ color: "var(--brand-primary)" }} />
                  <div>
                    <strong style={{ fontSize: 13, display: "block", color: "var(--text-primary)" }}>
                      Administrator (Full Access)
                    </strong>
                    <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                      admin@example.test
                    </span>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "3px 8px",
                    borderRadius: 4,
                    background: "var(--bg-subtle)",
                    color: "var(--brand-primary)",
                  }}
                >
                  Admin
                </span>
              </button>

              <button
                type="button"
                onClick={() => void handleLogin("approver@example.test", "demo123")}
                disabled={isLoading}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-light)",
                  background: "var(--bg-surface)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 140ms ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <User size={16} style={{ color: "var(--status-info)" }} />
                  <div>
                    <strong style={{ fontSize: 13, display: "block", color: "var(--text-primary)" }}>
                      Primary Approver
                    </strong>
                    <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                      approver@example.test
                    </span>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "3px 8px",
                    borderRadius: 4,
                    background: "var(--status-info-bg)",
                    color: "var(--status-info-text)",
                  }}
                >
                  Stage 1
                </span>
              </button>

              <button
                type="button"
                onClick={() => void handleLogin("backup@example.test", "demo123")}
                disabled={isLoading}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-light)",
                  background: "var(--bg-surface)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 140ms ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Shield size={16} style={{ color: "var(--urgency-amber)" }} />
                  <div>
                    <strong style={{ fontSize: 13, display: "block", color: "var(--text-primary)" }}>
                      Backup Approver
                    </strong>
                    <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                      backup@example.test
                    </span>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "3px 8px",
                    borderRadius: 4,
                    background: "var(--urgency-amber-bg)",
                    color: "var(--urgency-amber-text)",
                  }}
                >
                  Stage 2
                </span>
              </button>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              margin: "20px 0 16px",
              color: "var(--text-muted)",
              fontSize: 12,
            }}
          >
            <div style={{ flex: 1, height: 1, background: "var(--border-light)" }} />
            <span>or sign in with email</span>
            <div style={{ flex: 1, height: 1, background: "var(--border-light)" }} />
          </div>
        </>
      )}

      {/* Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleLogin(email, password);
            }}
            style={{ display: "grid", gap: 14 }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  marginBottom: 6,
                }}
              >
                Email Address
              </label>
              <div style={{ position: "relative" }}>
                <Mail
                  size={15}
                  style={{
                    position: "absolute",
                    left: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                  }}
                />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px 9px 34px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-strong)",
                    fontSize: 13,
                    fontFamily: "inherit",
                    background: "var(--bg-surface)",
                  }}
                />
              </div>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  marginBottom: 6,
                }}
              >
                Password
              </label>
              <div style={{ position: "relative" }}>
                <KeyRound
                  size={15}
                  style={{
                    position: "absolute",
                    left: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                  }}
                />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px 9px 34px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-strong)",
                    fontSize: 13,
                    fontFamily: "inherit",
                    background: "var(--bg-surface)",
                  }}
                />
              </div>
            </div>

            <Button
              variant="primary"
              type="submit"
              isLoading={isLoading}
              disabled={isLoading || !email || !password}
              style={{ width: "100%", marginTop: 6 }}
            >
              <LogIn size={15} />
              <span>Sign In to Dashboard</span>
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

