"use client";

import React from "react";
import { Crown, UserCheck, ShieldCheck, LogOut, Sparkles } from "lucide-react";
import { AppUser } from "../../types";
import { initials } from "../../lib/utils";

type RoleSwitcherProps = {
  currentUser: AppUser | null;
  onLoginAs: (email: string, password?: string) => Promise<string | null>;
  onSignOut: () => void;
};

export function RoleSwitcher({
  currentUser,
  onLoginAs,
  onSignOut,
}: RoleSwitcherProps) {
  const currentRole = currentUser?.role?.toLowerCase() || "";
  const currentEmail = currentUser?.email || "";

  return (
    <section className="role-switcher-bar" aria-label="Role preview switcher">
      <div className="role-switcher-left">
        <span className="role-switcher-label">
          <Sparkles size={13} className="role-switcher-sparkle" />
          <span>ACT AS ROLE:</span>
        </span>

        {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
          <div className="role-switcher-buttons" role="group" aria-label="Switch demo role">
            <button
              className={`role-btn ${currentRole === "admin" ? "active" : ""}`}
              type="button"
              onClick={() => void onLoginAs("admin@example.test", "demo123")}
            >
              <Crown size={14} className="role-icon" />
              <span>Admin</span>
            </button>

            <button
              className={`role-btn ${currentEmail === "approver@example.test" ? "active" : ""}`}
              type="button"
              onClick={() => void onLoginAs("approver@example.test", "demo123")}
            >
              <UserCheck size={14} className="role-icon" />
              <span>Primary Approver (Stage 1)</span>
            </button>

            <button
              className={`role-btn ${currentEmail === "backup@example.test" ? "active" : ""}`}
              type="button"
              onClick={() => void onLoginAs("backup@example.test", "demo123")}
            >
              <ShieldCheck size={14} className="role-icon" />
              <span>Backup Approver (Stage 2)</span>
            </button>
          </div>
        )}
      </div>

      <div className="role-switcher-active">
        <div className="role-active-user-badge">
          <span className="role-user-avatar">
            {currentUser ? initials(currentUser.name) : "AD"}
          </span>
          <div className="role-active-meta">
            <span className="role-active-label">Active:</span>
            <strong className="role-active-value">
              {currentUser ? `${currentUser.name} (${currentUser.role})` : "Admin user (Admin)"}
            </strong>
          </div>
        </div>
        {currentUser && (
          <button
            type="button"
            className="role-signout-btn"
            onClick={onSignOut}
            title="Sign out of current user"
          >
            <LogOut size={13} />
            <span>Sign out</span>
          </button>
        )}
      </div>
    </section>
  );
}

