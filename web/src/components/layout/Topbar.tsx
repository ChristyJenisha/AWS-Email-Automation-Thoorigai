"use client";

import React from "react";
import { CheckCircle2, AlertCircle, RefreshCw, ChevronRight, Clock, X } from "lucide-react";

type TopbarProps = {
  currentDateTime: string;
  apiStatus: "loading" | "connected" | "offline";
  activeTabTitle?: string;
  notice?: string;
  onClearNotice?: () => void;
};

export function Topbar({
  currentDateTime,
  apiStatus,
  activeTabTitle = "Overview",
  notice,
  onClearNotice,
}: TopbarProps) {
  return (
    <header className="topbar">
      <div className="breadcrumb">
        <span>Workspace</span>
        <ChevronRight size={13} className="breadcrumb-chevron" />
        <span className="breadcrumb-active">{activeTabTitle}</span>
      </div>

      <div className="topbar-right">
        {notice && (
          <div className="topbar-notice" onClick={onClearNotice} title="Click to dismiss">
            <span className="notice-dot" />
            <span className="notice-text">{notice}</span>
            <button
              type="button"
              className="notice-dismiss-btn"
              onClick={(e) => {
                e.stopPropagation();
                onClearNotice?.();
              }}
              aria-label="Dismiss notice"
            >
              <X size={12} />
            </button>
          </div>
        )}

        <span className={`sync-state ${apiStatus}`}>
          {apiStatus === "connected" && <CheckCircle2 size={13} className="sync-icon live" />}
          {apiStatus === "loading" && <RefreshCw size={13} className="sync-icon rotating" />}
          {apiStatus === "offline" && <AlertCircle size={13} className="sync-icon offline" />}
          <span>{apiStatus === "connected" ? "Live API" : apiStatus === "offline" ? "API Offline" : "Connecting..."}</span>
        </span>

        <span className="topbar-date">
          <Clock size={12} className="topbar-clock-icon" />
          <span>{currentDateTime || "Loading date..."}</span>
        </span>
      </div>
    </header>
  );
}

