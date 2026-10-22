"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Zap,
  Layers,
  CreditCard,
  Settings,
  History,
  RotateCcw,
  LogOut,
  Building2,
  ChevronDown,
  UserCheck,
  Clock,
} from "lucide-react";
import { useDataContext } from "../../lib/DataContext";
import { initials, isApproverRoute } from "../../lib/utils";
import { SignInView } from "../auth/SignInView";

function formatUpdatedTime(seconds: number): string {
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.floor(seconds / 60);
  if (mins === 1) return "1 minute ago";
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return "1 hour ago";
  return `${hours} hours ago`;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  const {
    currentUser,
    isLoading,
    error,
    overdueCount,
    inFlightCount,
    readyForPaymentCount,
    secondsAgo,
    isRefreshing,
    refreshData,
    loginWithCredentials,
    signOut,
  } = useDataContext();

  const [currentDateTime, setCurrentDateTime] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Live Clock Ticker
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentDateTime(
        new Intl.DateTimeFormat("en-IN", {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }).format(now)
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Close user dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Isolate no-auth approval portal and standalone legacy view: skip app shell to avoid UI duplication
  if (isApproverRoute(pathname) || pathname === "/legacy" || pathname.startsWith("/legacy")) {
    return <main>{children}</main>;
  }

  // If loading authentication state, show clean connecting state
  if (isLoading && !currentUser) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-subtle, #f8fafc)",
          fontFamily: "inherit",
        }}
      >
        <div style={{ textAlign: "center", color: "var(--text-muted, #64748b)" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "var(--brand-primary, #0f766e)",
              color: "#fff",
              fontWeight: 800,
              fontSize: 24,
              marginBottom: 16,
            }}
          >
            t
          </div>
          <p style={{ fontSize: 14, fontWeight: 500 }}>Connecting to Thoorigai Ledger...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, show SignInView
  if (!currentUser) {
    return <SignInView />;
  }

  const handleRoleSwitch = async (email: string) => {
    await loginWithCredentials(email, "demo123");
    setUserMenuOpen(false);
  };

  const navItems = [
    {
      label: "Command Center",
      href: "/",
      icon: Zap,
      badge: overdueCount > 0 ? overdueCount : undefined,
      badgeVariant: "urgent",
    },
    {
      label: "Batches Ledger",
      href: "/batches",
      icon: Layers,
      badge: inFlightCount > 0 ? inFlightCount : undefined,
      badgeVariant: "info",
    },
    {
      label: "Bills & Payments",
      href: "/payments",
      icon: CreditCard,
      badge: readyForPaymentCount > 0 ? readyForPaymentCount : undefined,
      badgeVariant: "success",
    },
    {
      label: "Settings",
      href: "/settings",
      icon: Settings,
    },
    ...(process.env.NEXT_PUBLIC_DEMO_MODE === "true"
      ? [
          {
            label: "Legacy View",
            href: "/legacy",
            icon: History,
            sublabel: "Full single-page",
          },
        ]
      : []),
  ];

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar" aria-label="Main sidebar navigation">
        <Link className="brand" href="/" aria-label="Thoorigai Ledger Home">
          <span className="brand-mark">t</span>
          <span className="brand-name">
            thoorigai<span>ledger</span>
          </span>
        </Link>

        <div className="workspace-label">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Primary navigation">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${isActive ? "active" : ""}`}
              >
                <Icon className="nav-icon" size={16} />
                <span className="nav-item-title">{item.label}</span>
                {item.badge !== undefined && (
                  <span className={`shell-nav-pill shell-nav-pill--${item.badgeVariant ?? "neutral"}`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="shell-app-main-content">
        {/* Reconnecting / Network Error Banner */}
        {error && (
          <div
            style={{
              background: "#fffbeb",
              color: "#b45309",
              padding: "9px 18px",
              fontSize: 12.5,
              borderBottom: "1px solid #fde68a",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              zIndex: 30,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="shell-pulse-dot" style={{ background: "#d97706" }} />
              <span>
                <strong>Reconnecting…</strong> Unable to sync latest updates with server. Showing cached data (updated{" "}
                {secondsAgo}s ago).
              </span>
            </div>
            <button
              type="button"
              onClick={() => void refreshData()}
              disabled={isRefreshing}
              style={{
                background: "#ffffff",
                border: "1px solid #d97706",
                color: "#b45309",
                padding: "3px 10px",
                borderRadius: 4,
                fontSize: 11.5,
                fontWeight: 600,
                cursor: isRefreshing ? "wait" : "pointer",
              }}
            >
              {isRefreshing ? "Retrying..." : "Retry Now"}
            </button>
          </div>
        )}

        {/* TopBar */}
        <header className="shell-topbar" aria-label="Application header">
          <div className="shell-topbar-left">
            <div className="shell-org-indicator">
              <Building2 size={15} className="shell-org-icon" />
              <span className="shell-org-label">ORGANIZATION:</span>
              <strong className="shell-org-name">Thoorigai Infotech</strong>
            </div>

            <div className="shell-system-status">
              <span className="shell-pulse-dot" />
              <span>System Live</span>
            </div>
          </div>

          <div className="shell-topbar-right">
            {/* Live Current Date & Time */}
            {currentDateTime && (
              <div
                className="shell-clock-indicator"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12.5,
                  color: "var(--text-secondary, #475569)",
                  padding: "4px 10px",
                  borderRadius: 6,
                  background: "var(--bg-subtle, #f1f5f9)",
                  border: "1px solid var(--border-light, #e2e8f0)",
                }}
                title="Current Date & Time"
              >
                <Clock size={13} style={{ color: "var(--text-muted, #64748b)" }} />
                <span>{currentDateTime}</span>
              </div>
            )}

            {/* Auto-Refresh Ticker & Manual Refresh Button */}
            <div className="shell-refresh-ticker">
              <span className="shell-refresh-time">
                Updated {formatUpdatedTime(secondsAgo)}
              </span>
              <button
                type="button"
                className={`shell-refresh-btn ${isRefreshing ? "is-spinning" : ""}`}
                onClick={() => void refreshData()}
                disabled={isRefreshing}
                aria-label="Refresh ledger data now"
                title="Click to refresh data now"
              >
                <RotateCcw size={13} />
                <span>Refresh</span>
              </button>
            </div>

            {/* User Dropdown */}
            <div className="shell-user-menu-wrapper" ref={userMenuRef}>
              <button
                type="button"
                className="shell-user-menu-trigger"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
              >
                <span className="shell-user-menu-avatar">{initials(currentUser?.name ?? "AU")}</span>
                <span className="shell-user-menu-name">{currentUser?.name ?? "Admin"}</span>
                <ChevronDown size={14} className="shell-user-menu-chevron" />
              </button>

              {userMenuOpen && (
                <div
                  className="shell-user-dropdown-menu"
                  role="menu"
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "calc(100% + 6px)",
                    minWidth: 230,
                    background: "var(--bg-surface, #fff)",
                    border: "1px solid var(--border-subtle, #e2e8f0)",
                    borderRadius: "var(--radius-md, 8px)",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                    padding: 6,
                    zIndex: 50,
                  }}
                >
                  <div className="shell-dropdown-user-header">
                    <strong>{currentUser?.name ?? "Admin"}</strong>
                    <small>
                      {currentUser?.email || "Signed in"} ({currentUser?.role ?? "Admin"})
                    </small>
                  </div>

                  {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
                    <>
                      <div className="shell-dropdown-divider" />
                      <div style={{ padding: "4px 10px 2px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>
                        SWITCH DEMO ROLE
                      </div>

                      <button
                        type="button"
                        className="shell-dropdown-item"
                        onClick={() => void handleRoleSwitch("admin@example.test")}
                        role="menuitem"
                        style={{
                          background: currentUser?.email === "admin@example.test" ? "var(--bg-subtle)" : "transparent",
                        }}
                      >
                        <UserCheck size={14} style={{ color: "var(--brand-primary)" }} />
                        <span>👑 Admin User</span>
                      </button>

                      <button
                        type="button"
                        className="shell-dropdown-item"
                        onClick={() => void handleRoleSwitch("approver@example.test")}
                        role="menuitem"
                        style={{
                          background: currentUser?.email === "approver@example.test" ? "var(--bg-subtle)" : "transparent",
                        }}
                      >
                        <UserCheck size={14} style={{ color: "#3b82f6" }} />
                        <span>👤 Primary Approver</span>
                      </button>

                      <button
                        type="button"
                        className="shell-dropdown-item"
                        onClick={() => void handleRoleSwitch("backup@example.test")}
                        role="menuitem"
                        style={{
                          background: currentUser?.email === "backup@example.test" ? "var(--bg-subtle)" : "transparent",
                        }}
                      >
                        <UserCheck size={14} style={{ color: "#d97706" }} />
                        <span>🛡️ Backup Approver</span>
                      </button>
                    </>
                  )}

                  <div className="shell-dropdown-divider" />

                  <button
                    type="button"
                    className="shell-dropdown-item shell-dropdown-item--danger"
                    onClick={() => {
                      setUserMenuOpen(false);
                      signOut();
                    }}
                    role="menuitem"
                  >
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content Body */}
        <div className="shell-app-page-body">{children}</div>
      </div>
    </div>
  );
}
