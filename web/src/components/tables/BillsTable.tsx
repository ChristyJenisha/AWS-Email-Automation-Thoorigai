"use client";

import React from "react";
import { Search, Check, AlertCircle, Trash2, Clock, ArrowRight } from "lucide-react";
import { Bill, BillFilter } from "../../types";
import { formatCurrency, matchesBillFilter } from "../../lib/utils";

type BillsTableProps = {
  bills: Bill[];
  visibleBills: Bill[];
  filter: BillFilter;
  setFilter: (filter: BillFilter) => void;
  search: string;
  setSearch: (search: string) => void;
  onMarkPaid?: (id: number | string) => void;
  onDeleteBill?: (id: number | string) => void;
};

const FILTER_OPTIONS: BillFilter[] = [
  "All bills",
  "Overdue",
  "Due soon",
  "Partially paid",
  "Disputed",
  "Paid",
];

export function BillsTable({
  bills,
  visibleBills,
  filter,
  setFilter,
  search,
  setSearch,
  onMarkPaid,
  onDeleteBill,
}: BillsTableProps) {
  return (
    <section className="bills-section" id="bills">
      <div className="section-heading">
        <div>
          <p className="eyebrow">YOUR RECEIVABLES</p>
          <h2>
            Recent bills <span className="section-total">{bills.length}</span>
          </h2>
        </div>
        <button
          className="text-button"
          onClick={() => {
            setFilter("All bills");
            document.getElementById("bills")?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          View all <span aria-hidden="true">→</span>
        </button>
      </div>

      <div className="table-toolbar">
        <div className="filter-tabs" role="tablist" aria-label="Filter bills">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option}
              role="tab"
              aria-selected={filter === option}
              className={`filter-tab ${filter === option ? "selected" : ""}`}
              onClick={() => setFilter(option)}
            >
              {option}
              <span>
                {option === "All bills"
                  ? bills.length
                  : bills.filter((b) => matchesBillFilter(b, option)).length}
              </span>
            </button>
          ))}
        </div>

        <label className="search-box">
          <Search size={15} className="search-icon" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search bills by invoice or customer..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search bills"
          />
        </label>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Invoice</th>
              <th>Due date</th>
              <th>Stage / Next Step</th>
              <th>Status</th>
              <th className="amount-heading">Invoice / remaining</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleBills.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "40px 16px", color: "var(--muted)" }}>
                  <AlertCircle size={24} style={{ margin: "0 auto 8px auto", display: "block", opacity: 0.5 }} />
                  No bills found matching your filter or search query.
                </td>
              </tr>
            ) : (
              visibleBills.map((bill, index) => (
                <tr key={bill.id ?? index}>
                  <td>
                    <div className="customer-cell">
                      <span className={`customer-avatar avatar-${index % 4}`}>
                        {bill.customer.slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <strong>{bill.customer}</strong>
                        {bill.isDemo && <span className="demo-tag">Demo item</span>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="invoice-code">{bill.invoice}</span>
                  </td>
                  <td>
                    <span className="due-date">{bill.due}</span>
                  </td>
                  <td>
                    {bill.stageInfo ? (
                      <span
                        className={`status-pill ${
                          bill.batchStatus === "READY_FOR_PAYMENT"
                            ? "status-ready"
                            : bill.batchStatus === "COMPLETED"
                            ? "status-connected"
                            : "status-alerted"
                        }`}
                        title={bill.currentApprover ? `Current Approver: ${bill.currentApprover}` : undefined}
                      >
                        <Clock size={11} /> {bill.stageInfo}
                      </span>
                    ) : (
                      <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td>
                    <span className={`status-pill status-${bill.status.toLowerCase().replace(/\s+/g, "-")}`}>
                      <i />
                      {bill.status}
                    </span>
                  </td>
                  <td className="amount-heading">
                    <span className="amount-primary">{formatCurrency(bill.balanceDue)}</span>
                    <span className="amount-secondary">{formatCurrency(bill.amount)}</span>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                      {bill.balanceDue <= 0 ? (
                        <span className="status-pill status-connected">
                          <Check size={11} /> Settled
                        </span>
                      ) : bill.balanceDue < bill.amount ? (
                        <span className="status-pill status-partially-paid">
                          Partial
                        </span>
                      ) : (
                        <span className="status-pill status-open">
                          Active
                        </span>
                      )}
                      {bill.batchId && (
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => {
                            document.getElementById("pipeline")?.scrollIntoView({ behavior: "smooth" });
                          }}
                          title="View in Approval Pipeline"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--brand-primary)",
                            cursor: "pointer",
                            padding: "4px 6px",
                            borderRadius: 4,
                            display: "inline-flex",
                            alignItems: "center",
                            fontSize: "11px",
                            gap: 3,
                          }}
                        >
                          <ArrowRight size={12} />
                          <span>Pipeline</span>
                        </button>
                      )}
                      {onDeleteBill && (
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => onDeleteBill(bill.id ?? bill.invoice)}
                          title="Remove this bill from receivables view"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            padding: "4px 6px",
                            borderRadius: 4,
                            display: "inline-flex",
                            alignItems: "center",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = "var(--urgency-rose)";
                            e.currentTarget.style.background = "var(--urgency-rose-bg)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = "var(--text-muted)";
                            e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

