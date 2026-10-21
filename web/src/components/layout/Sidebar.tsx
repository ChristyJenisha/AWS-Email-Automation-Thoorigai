"use client";

import React from "react";
import {
  LayoutDashboard,
  FileSpreadsheet,
  Clock,
  Shield,
  MoreHorizontal,
  GitBranch,
  CreditCard,
} from "lucide-react";
import { AppUser } from "../../types";
import { initials } from "../../lib/utils";

type SidebarProps = {
  activeTab: string;
  billsCount: number;
  batchesCount: number;
  inFlightCount?: number;
  settlementsCount?: number;
  currentUser: AppUser | null;
  onNavigate: (tabId: string) => void;
};

export function Sidebar({
  activeTab,
  billsCount,
  batchesCount,
  inFlightCount = 0,
  settlementsCount = 0,
  currentUser,
  onNavigate,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <a
        className="brand"
        href="#overview"
        onClick={(e) => {
          e.preventDefault();
          onNavigate("overview");
        }}
        aria-label="Thoorigai Ledger home"
      >
        <span className="brand-mark">t</span>
        <span className="brand-name">
          thoorigai<span>ledger</span>
        </span>
      </a>

      <div className="workspace-label">WORKSPACE</div>
      <nav className="primary-nav" aria-label="Main navigation">
        <button
          type="button"
          className={`nav-item ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => onNavigate("overview")}
        >
          <LayoutDashboard className="nav-icon" size={16} />
          <span>Overview</span>
        </button>
        <button
          type="button"
          className={`nav-item ${activeTab === "pipeline" ? "active" : ""}`}
          onClick={() => onNavigate("pipeline")}
        >
          <GitBranch className="nav-icon" size={16} />
          <span>Pipeline</span>
          {inFlightCount > 0 && <span className="nav-count nav-count-pulse">{inFlightCount}</span>}
        </button>
        <button
          type="button"
          className={`nav-item ${activeTab === "settlements" ? "active" : ""}`}
          onClick={() => onNavigate("settlements")}
        >
          <CreditCard className="nav-icon" size={16} />
          <span>Settlements</span>
          {settlementsCount > 0 && <span className="nav-count nav-count-alert">{settlementsCount}</span>}
        </button>
        <button
          type="button"
          className={`nav-item ${activeTab === "bills" ? "active" : ""}`}
          onClick={() => onNavigate("bills")}
        >
          <FileSpreadsheet className="nav-icon" size={16} />
          <span>Bills</span>
          <span className="nav-count">{billsCount}</span>
        </button>
        <button
          type="button"
          className={`nav-item ${activeTab === "batches" ? "active" : ""}`}
          onClick={() => onNavigate("batches")}
        >
          <Clock className="nav-icon" size={16} />
          <span>Batches</span>
          <span className="nav-count">{batchesCount}</span>
        </button>
      </nav>

      <div className="sidebar-bottom">
        <div className="demo-note">
          <Shield size={12} className="demo-dot-icon" />
          <span>Secure multi-stage workspace</span>
        </div>
        <div className="profile-row">
          <span className="profile-avatar">
            {currentUser ? initials(currentUser.name) : "AD"}
          </span>
          <span className="profile-copy">
            <strong>{currentUser?.name ?? "Admin user"}</strong>
            <small>{currentUser?.role ?? "Admin"} · Thoorigai</small>
          </span>
          <MoreHorizontal size={14} className="profile-more" aria-hidden="true" />
        </div>
      </div>
    </aside>
  );
}

