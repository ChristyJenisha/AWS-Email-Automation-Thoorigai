"use client";

import React from "react";
import { TrendingUp, AlertTriangle, CalendarClock, CheckCircle2 } from "lucide-react";
import { Bill } from "../../types";
import { formatCurrency, getAgingStatus } from "../../lib/utils";

type MetricsGridProps = {
  bills: Bill[];
  outstanding: number;
  overdue: number;
  dueSoon: number;
  collected: number;
};

export function MetricsGrid({
  bills,
  outstanding,
  overdue,
  dueSoon,
  collected,
}: MetricsGridProps) {
  const activeBillsCount = bills.filter((b) => b.balanceDue > 0).length;
  const overdueBillsCount = bills.filter(
    (b) => getAgingStatus(b.dueDate, b.balanceDue, b.status) === "Overdue"
  ).length;

  return (
    <section className="metrics-grid" aria-label="Receivables summary">
      <article className="metric-card metric-primary">
        <div className="metric-heading">
          <span>Total outstanding</span>
          <span className="metric-icon-wrap primary">
            <TrendingUp size={16} />
          </span>
        </div>
        <strong className="metric-value">{formatCurrency(outstanding)}</strong>
        <div className="metric-foot">
          <span className="metric-legend" />
          <span>Across {activeBillsCount} bill{activeBillsCount === 1 ? "" : "s"} with balance</span>
        </div>
      </article>

      <article className="metric-card">
        <div className="metric-heading">
          <span>Overdue</span>
          <span className="metric-icon-wrap danger">
            <AlertTriangle size={16} />
          </span>
        </div>
        <strong className="metric-value">{formatCurrency(overdue)}</strong>
        <div className="metric-foot">
          <span className="metric-text danger-text">
            {overdueBillsCount} bill{overdueBillsCount === 1 ? "" : "s"} need attention
          </span>
        </div>
      </article>

      <article className="metric-card">
        <div className="metric-heading">
          <span>Due soon</span>
          <span className="metric-icon-wrap amber">
            <CalendarClock size={16} />
          </span>
        </div>
        <strong className="metric-value">{formatCurrency(dueSoon)}</strong>
        <div className="metric-foot">
          <span className="metric-text">Due within the next 7 days</span>
        </div>
      </article>

      <article className="metric-card">
        <div className="metric-heading">
          <span>Payments recorded</span>
          <span className="metric-icon-wrap green">
            <CheckCircle2 size={16} />
          </span>
        </div>
        <strong className="metric-value">{formatCurrency(collected)}</strong>
        <div className="metric-foot">
          <span className="metric-text">Payment totals, including on-account</span>
        </div>
      </article>
    </section>
  );
}

