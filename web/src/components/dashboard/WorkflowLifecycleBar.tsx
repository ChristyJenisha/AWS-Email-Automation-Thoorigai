"use client";

import React, { useState } from "react";
import { CheckCircle2, ChevronRight, Mail, ShieldCheck, CreditCard, FileCheck2, Plus, Info, HelpCircle } from "lucide-react";

type WorkflowLifecycleBarProps = {
  inFlightCount: number;
  settlementsCount: number;
  billsCount: number;
  onOpenSubmitIndividualBill: () => void;
  onOpenCreateBatch: () => void;
  onNavigateToTab: (tabId: string) => void;
};

export function WorkflowLifecycleBar({
  inFlightCount,
  settlementsCount,
  billsCount,
  onOpenSubmitIndividualBill,
  onOpenCreateBatch,
  onNavigateToTab,
}: WorkflowLifecycleBarProps) {
  const [activeStepInfo, setActiveStepInfo] = useState<number | null>(null);

  const steps = [
    {
      num: 1,
      title: "1. Create Bill / Batch",
      subtitle: "Single bill or multi-bill batch",
      badge: `${billsCount} bills`,
      tab: "bills",
      detail: "Submit an individual bill or group invoices into a batch. Each submission triggers the multi-stage approval chain.",
    },
    {
      num: 2,
      title: "2. Approver Alerted",
      subtitle: "Secure Magic Link emailed",
      badge: inFlightCount > 0 ? `${inFlightCount} active` : undefined,
      tab: "pipeline",
      detail: "The assigned approver for the active stage receives an email with an HMAC-signed magic link. No password needed.",
    },
    {
      num: 3,
      title: "3. OTP Sign-off",
      subtitle: "6-digit OTP verification",
      tab: "pipeline",
      detail: "Approver inputs their 6-digit email OTP (or 1-Click Fast Approve) and reviews line items, then approves or returns with notes.",
    },
    {
      num: 4,
      title: "4. Payment Settlement",
      subtitle: "Bank record & TDS deductions",
      badge: settlementsCount > 0 ? `${settlementsCount} ready` : undefined,
      tab: "settlements",
      detail: "Once all stages approve, finance records the settlement, allocates invoice line items, and attaches proof of payment.",
    },
    {
      num: 5,
      title: "5. Complete & Audited",
      subtitle: "Immutable log & zero balance",
      tab: "batches",
      detail: "Bill is marked PAID and every decision is stamped into the tamper-evident audit trail with actor, IP, and timestamp.",
    },
  ];

  return (
    <div className="lifecycle-roadmap-card">
      <div className="lifecycle-header">
        <div className="lifecycle-title">
          <span className="lifecycle-kicker">WORKFLOW LIFECYCLE ROADMAP</span>
          <h3>Standard Process: Bill Creation ➔ Approval ➔ Settlement</h3>
        </div>

        <div className="lifecycle-hint">
          <HelpCircle size={13} className="text-muted" />
          <span>Click any step to navigate</span>
        </div>
      </div>

      <div className="lifecycle-steps-bar">
        {steps.map((step, idx) => {
          const isActive = activeStepInfo === step.num;
          return (
            <div
              key={step.num}
              className={`lifecycle-step-node ${isActive ? "selected" : ""}`}
              onClick={() => {
                setActiveStepInfo(activeStepInfo === step.num ? null : step.num);
                onNavigateToTab(step.tab);
              }}
              role="button"
              tabIndex={0}
              title={`Click to view ${step.title} details`}
            >
              <div className="node-number">{step.num}</div>
              <div className="node-info">
                <span className="node-title">{step.title}</span>
                <span className="node-subtitle">{step.subtitle}</span>
              </div>
              {step.badge && (
                <span className={`node-badge ${step.tab === "pipeline" ? "pulse" : ""}`}>
                  {step.badge}
                </span>
              )}
              {idx < steps.length - 1 && (
                <ChevronRight size={14} className="node-separator" />
              )}
            </div>
          );
        })}
      </div>

      {activeStepInfo !== null && (
        <div className="lifecycle-step-popover">
          <Info size={14} className="text-forest" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>{steps[activeStepInfo - 1].title}:</strong>{" "}
            <span>{steps[activeStepInfo - 1].detail}</span>
          </div>
          <button
            type="button"
            className="close-popover-btn"
            onClick={() => setActiveStepInfo(null)}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

