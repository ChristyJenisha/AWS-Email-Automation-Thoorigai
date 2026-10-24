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
  Menu,
  X,
  Sun,
  Moon,
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("thoorigai-theme-v2") as "dark" | "light" | null;
      return saved || "light";
    }
    return "light";
  });
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Synchronize document attribute with active theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("thoorigai-theme-v2", next);
    }
  };

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

  // Isolate no-auth approval portal: skip app shell to avoid UI duplication
  if (isApproverRoute(pathname)) {
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
          background: "var(--bg-subtle)",
          fontFamily: "inherit",
        }}
      >
        <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "var(--brand-primary)",
              color: "var(--text-inverse)",
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
                title={item.label}
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

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <>
          <div
            className="shell-mobile-drawer-backdrop"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div
            className="shell-mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation"
          >
            <div className="shell-mobile-drawer-header">
              <Link
                className="brand"
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                style={{ padding: 0 }}
              >
                <span className="brand-mark">t</span>
                <span className="brand-name">
                  thoorigai<span>ledger</span>
                </span>
              </Link>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="shell-theme-toggle-btn"
                  title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
                  aria-label={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    border: "1px solid var(--border-light)",
                    background: "var(--bg-subtle)",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
                </button>
                <button
                  type="button"
                  className="shell-mobile-drawer-close"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close mobile navigation"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="shell-mobile-drawer-org">
              <Building2 size={14} className="shell-org-icon" />
              <span>Thoorigai Infotech</span>
              <span
                className="shell-system-status"
                style={{ marginLeft: "auto", fontSize: 10, padding: "2px 8px" }}
              >
                <span className="shell-pulse-dot" /> Live
              </span>
            </div>

            <nav className="shell-mobile-drawer-nav">
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
                    className={`shell-mobile-drawer-item ${isActive ? "active" : ""}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                    {item.badge !== undefined && (
                      <span
                        className={`shell-nav-pill shell-nav-pill--${
                          item.badgeVariant ?? "neutral"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="shell-mobile-drawer-footer">
              <div
                className="shell-dropdown-user-header"
                style={{ marginBottom: 12 }}
              >
                <strong>{currentUser?.name ?? "Admin"}</strong>
                <small>
                  {currentUser?.email || "Signed in"} ({currentUser?.role ?? "Admin"})
                </small>
              </div>
              <button
                type="button"
                className="shell-dropdown-item shell-dropdown-item--danger"
                onClick={() => {
                  setMobileMenuOpen(false);
                  signOut();
                }}
                style={{ width: "100%", justifyContent: "center" }}
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Main Content Area */}
      <div className="shell-app-main-content">
        {/* Reconnecting / Network Error Banner */}
        {error && (
          <div
            style={{
              background: "var(--urgency-amber-bg)",
              color: "var(--urgency-amber-text)",
              padding: "9px 18px",
              fontSize: 12.5,
              borderBottom: "1px solid var(--urgency-amber-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              zIndex: 30,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="shell-pulse-dot" style={{ background: "var(--urgency-amber)" }} />
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
                background: "var(--bg-surface)",
                border: "1px solid var(--urgency-amber)",
                color: "var(--urgency-amber-text)",
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
            <button
              type="button"
              className="shell-mobile-menu-btn"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu size={18} />
            </button>

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
                  color: "var(--text-secondary)",
                  padding: "4px 10px",
                  borderRadius: 6,
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--border-light)",
                }}
                title="Current Date & Time"
              >
                <Clock size={13} style={{ color: "var(--text-muted)" }} />
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

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="shell-theme-toggle-btn"
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
              aria-label={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 32,
                borderRadius: 6,
                border: "1px solid var(--border-light)",
                background: "var(--bg-subtle)",
                color: "var(--text-secondary)",
                cursor: "pointer",
                transition: "all 120ms ease",
              }}
            >
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>

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
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-light)",
                    borderRadius: "var(--radius-md)",
                    boxShadow: "var(--shadow-lg)",
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

                  {isDemoMode && (
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
                        <UserCheck size={14} style={{ color: "var(--status-info)" }} />
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
                        <UserCheck size={14} style={{ color: "var(--urgency-amber)" }} />
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
