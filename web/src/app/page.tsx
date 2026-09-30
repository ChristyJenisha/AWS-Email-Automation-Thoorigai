"use client";

import { useEffect, useState, type FormEvent } from "react";

type BillStatus = "Overdue" | "Due soon" | "Open" | "Paid";
type WorkflowRecord = {
  id: string;
  name: string;
  stages: Array<{ id: string; order: number; contact?: { id?: string; name?: string }; backupContact?: { id?: string; name?: string } }>;
};
type Bill = {
  id: number | string;
  customer: string;
  invoice: string;
  amount: number;
  due: string;
  status: BillStatus;
};
type BatchRecord = {
  id: string;
  status?: string;
  bills?: Array<{
    id?: string;
    billNumber?: string;
    amount?: number | string;
    balanceDue?: number | string;
    dueDate?: string | null;
    status?: string;
  }>;
  stepInstances?: Array<{
    id: string;
    status?: string;
    stage?: {
      id?: string;
      order?: number;
      contact?: { id?: string; name?: string };
      backupContact?: { id?: string; name?: string };
    };
  }>;
};
type BillFilter = "All bills" | "Overdue" | "Due soon" | "Paid";
type AppUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
};

const startingBills: Bill[] = [
  { id: 1, customer: "Tata Precision Components", invoice: "INV-2481", amount: 124000, due: "18 Sep", status: "Overdue" },
  { id: 2, customer: "Innotech Systems", invoice: "INV-2478", amount: 92000, due: "30 Sep", status: "Due soon" },
  { id: 3, customer: "Greenfield Foods", invoice: "INV-2472", amount: 84500, due: "22 Sep", status: "Overdue" },
  { id: 4, customer: "Aurum Packaging", invoice: "INV-2469", amount: 47500, due: "02 Oct", status: "Due soon" },
  { id: 5, customer: "Bluepeak Logistics", invoice: "INV-2465", amount: 110000, due: "16 Sep", status: "Paid" },
  { id: 6, customer: "Northstar Labs", invoice: "INV-2461", amount: 68000, due: "07 Oct", status: "Open" },
];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

const toBillStatus = (status?: string, dueDate?: string | null): BillStatus => {
  if (status === "PAID") return "Paid";

  if (!dueDate) return "Open";

  const today = new Date();
  const due = new Date(`${dueDate}T00:00:00`);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "Overdue";
  if (diffDays <= 7) return "Due soon";
  return "Open";
};

const toDisplayBills = (batchData: BatchRecord[] | undefined): Bill[] => {
  if (!Array.isArray(batchData) || batchData.length === 0) {
    return startingBills;
  }

  return batchData.flatMap((batch) =>
    (batch.bills ?? []).map((bill, index) => {
      const amount = Number(bill.amount ?? bill.balanceDue ?? 0);
      const invoice = bill.billNumber ?? `INV-${String(index + 1).padStart(4, "0")}`;
      const dueDate = bill.dueDate ? new Date(bill.dueDate) : null;
      const dueText = dueDate
        ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(dueDate)
        : "TBD";

      return {
        id: bill.id ?? `${batch.id}-${invoice}`,
        customer: batch.id ? "Demo Organization" : "Customer",
        invoice,
        amount: Number.isFinite(amount) ? amount : 0,
        due: dueText,
        status: toBillStatus(bill.status, bill.dueDate ?? null),
      };
    }),
  );
};

const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const avatarSeed = (value: number | string) =>
  Number(
    String(value)
      .split("")
      .reduce((sum, char) => sum + char.charCodeAt(0), 0),
  ) % 4;

export default function Home() {
  const [bills, setBills] = useState(startingBills);
  const [filter, setFilter] = useState<BillFilter>("All bills");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState({ customer: "", invoice: "", amount: "", due: "" });
  const [liveWorkflow, setLiveWorkflow] = useState<WorkflowRecord | null>(null);
  const [liveBatch, setLiveBatch] = useState<BatchRecord | null>(null);
  const [liveBatchCount, setLiveBatchCount] = useState<number | null>(null);
  const [apiStatus, setApiStatus] = useState<"loading" | "connected" | "offline">("loading");
  const [approvalComment, setApprovalComment] = useState("");
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  async function loginAs(email: string, password: string) {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const response = await fetch(`${apiBase}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      setNotice("Sign-in failed. Use a demo user.");
      return;
    }

    const payload = (await response.json()) as { token: string; user: AppUser };
    setCurrentUser(payload.user);
    setAuthToken(payload.token);
    localStorage.setItem("thoorigai-token", payload.token);
    localStorage.setItem("thoorigai-user", JSON.stringify(payload.user));
    setNotice(`Signed in as ${payload.user.name}.`);
  }

  useEffect(() => {
    const savedToken = window.localStorage.getItem("thoorigai-token");
    const savedUser = window.localStorage.getItem("thoorigai-user");

    if (savedToken && savedUser) {
      try {
        setAuthToken(savedToken);
        setCurrentUser(JSON.parse(savedUser) as AppUser);
      } catch {
        window.localStorage.removeItem("thoorigai-token");
        window.localStorage.removeItem("thoorigai-user");
      }
    } else {
      void loginAs("approver@example.test", "demo123");
    }

    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    let isMounted = true;

    Promise.all([
      fetch(`${apiBase}/workflows?organizationId=demo-org`, { cache: "no-store" }),
      fetch(`${apiBase}/batches?organizationId=demo-org`, { cache: "no-store" }),
    ])
      .then(async ([workflowResponse, batchResponse]) => {
        if (!workflowResponse.ok || !batchResponse.ok) {
          throw new Error("API request failed");
        }
        const workflowData = (await workflowResponse.json()) as WorkflowRecord[];
        const batchData = (await batchResponse.json()) as BatchRecord[];
        if (!isMounted) return;

        const derivedBills = toDisplayBills(batchData);
        setBills(derivedBills);
        setLiveWorkflow(Array.isArray(workflowData) && workflowData[0] ? workflowData[0] : null);
        setLiveBatch(Array.isArray(batchData) && batchData[0] ? batchData[0] : null);
        setLiveBatchCount(Array.isArray(batchData) ? batchData.length : 0);
        setApiStatus("connected");
      })
      .catch(() => {
        if (!isMounted) return;
        setBills(startingBills);
        setLiveWorkflow(null);
        setLiveBatch(null);
        setLiveBatchCount(null);
        setApiStatus("offline");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const outstanding = bills
    .filter((bill) => bill.status !== "Paid")
    .reduce((sum, bill) => sum + bill.amount, 0);
  const overdue = bills
    .filter((bill) => bill.status === "Overdue")
    .reduce((sum, bill) => sum + bill.amount, 0);
  const dueSoon = bills
    .filter((bill) => bill.status === "Due soon")
    .reduce((sum, bill) => sum + bill.amount, 0);
  const collected = bills
    .filter((bill) => bill.status === "Paid")
    .reduce((sum, bill) => sum + bill.amount, 0);
  const visibleBills = bills.filter((bill) => {
    const matchesFilter = filter === "All bills" || bill.status === filter;
    const matchesSearch = `${bill.customer} ${bill.invoice}`
      .toLowerCase()
      .includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  function markPaid(id: number | string) {
    setBills((current) =>
      current.map((bill) => (bill.id === id ? { ...bill, status: "Paid" } : bill)),
    );
    setNotice("Payment recorded in this demo session.");
  }

  async function submitApproval(action: "complete" | "return") {
    const step = liveBatch?.stepInstances?.find((item) => item.status === "ALERTED");
    if (!step) {
      setNotice("No active approval step is available right now.");
      return;
    }

    setIsSubmittingApproval(true);
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const actor = currentUser?.id ?? step.stage?.contact?.id ?? step.stage?.backupContact?.id ?? "demo-approver";

    const response = await fetch(`${apiBase}/workflows/steps/${step.id}/${action}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({
        actor,
        comment: action === "return" ? approvalComment.trim() || "Please provide the missing review details." : undefined,
      }),
    });

    setIsSubmittingApproval(false);

    if (!response.ok) {
      setNotice(`Approval action failed (${response.status}).`);
      return;
    }

    setApprovalComment("");
    setNotice(action === "complete" ? "Approval recorded and the next stage has been advanced." : "The step was returned for update.");

    const batchResponse = await fetch(`${apiBase}/batches?organizationId=demo-org`, { cache: "no-store" });
    if (batchResponse.ok) {
      const freshBatch = (await batchResponse.json()) as BatchRecord[];
      const derivedBills = toDisplayBills(freshBatch);
      setBills(derivedBills);
      setLiveBatch(Array.isArray(freshBatch) && freshBatch[0] ? freshBatch[0] : null);
    }
  }

  function addBill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(draft.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;

    const dueDate = new Date(`${draft.due}T00:00:00`);
    const displayDue = new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
    }).format(dueDate);
    setBills((current) => [
      {
        id: Date.now(),
        customer: draft.customer.trim(),
        invoice: draft.invoice.trim(),
        amount,
        due: displayDue,
        status: "Open",
      },
      ...current,
    ]);
    setDraft({ customer: "", invoice: "", amount: "", due: "" });
    setDialogOpen(false);
    setNotice("Bill added to this demo session.");
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="Thoorigai Ledger home">
          <span className="brand-mark">t</span>
          <span className="brand-name">thoorigai<span>ledger</span></span>
        </a>

        <div className="workspace-label">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Main navigation">
          <a className="nav-item active" href="#overview"><span className="nav-glyph">◫</span>Overview</a>
          <a className="nav-item" href="#bills"><span className="nav-glyph">▤</span>Bills<span className="nav-count">{bills.length}</span></a>
        </nav>

        <div className="sidebar-bottom">
          <div className="demo-note"><span className="demo-dot" />Demo workspace</div>
          <div className="profile-row">
            <span className="profile-avatar">AD</span>
            <span className="profile-copy"><strong>Admin user</strong><small>Thoorigai Infotech</small></span>
            <span className="profile-more" aria-hidden="true">···</span>
          </div>
        </div>
      </aside>

      <section className="main-panel" id="overview">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> Overview</div>
          <div className="topbar-right"><span className="sync-state"><span />Demo data</span><span className="topbar-date">Tuesday, 29 September 2026</span></div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">COLLECTIONS AT A GLANCE</p>
              <h1>Good morning, Admin<span>.</span></h1>
              <p className="welcome-subtitle">Here is where your receivables stand today.</p>
            </div>
            <button className="primary-button" onClick={() => setDialogOpen(true)}><span aria-hidden="true">＋</span> Add a bill</button>
          </section>

          <div className="demo-banner">
            <span className="banner-mark">i</span>
            <span>
              <strong>
                {apiStatus === "connected" && "Live API connected"}
                {apiStatus === "offline" && "Demo workspace · API offline"}
                {apiStatus === "loading" && "Checking live API..."}
              </strong>
              &nbsp;
              {apiStatus === "connected" && liveWorkflow
                ? `${liveWorkflow.name} · ${liveBatchCount ?? 0} live batch(es)`
                : "Changes are temporary and will reset when this page reloads."}
            </span>
          </div>

          {apiStatus === "connected" && liveBatch && (
            <section className="workflow-panel" aria-live="polite">
              <div className="workflow-header">
                <div>
                  <p className="eyebrow">WORKFLOW ACTION</p>
                  <h3>Approval in progress</h3>
                </div>
                <span className="status-pill status-alerted"><i />{liveBatch.stepInstances?.find((item) => item.status === "ALERTED")?.status ?? "ALERTED"}</span>
              </div>

              <div className="workflow-details" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <strong>{liveBatch.stepInstances?.find((item) => item.status === "ALERTED")?.stage?.contact?.name ?? "Demo Approver"}</strong>
                  <span>Stage {liveBatch.stepInstances?.find((item) => item.status === "ALERTED")?.stage?.order ?? 1} is awaiting action.</span>
                </div>
                <div className="approval-buttons" style={{ marginLeft: "auto" }}>
                  <button className="secondary-button" type="button" onClick={() => void loginAs("approver@example.test", "demo123")}>Approver</button>
                  <button className="secondary-button" type="button" onClick={() => void loginAs("backup@example.test", "demo123")}>Backup</button>
                  {currentUser && (
                    <button className="secondary-button" type="button" onClick={() => {
                      setCurrentUser(null);
                      setAuthToken(null);
                      window.localStorage.removeItem("thoorigai-token");
                      window.localStorage.removeItem("thoorigai-user");
                      setNotice("Signed out.");
                    }}>
                      Sign out
                    </button>
                  )}
                </div>
              </div>

              <div className="workflow-details" style={{ marginTop: 12 }}>
                <strong>{currentUser ? `${currentUser.name} · ${currentUser.role}` : "No active demo user"}</strong>
                <span>{currentUser ? `Signed in to ${currentUser.organizationId}` : "Select a demo user to complete approval actions."}</span>
              </div>

              <div className="workflow-actions">
                <textarea
                  value={approvalComment}
                  onChange={(event) => setApprovalComment(event.target.value)}
                  placeholder="Add a return reason when sending this step back for revision"
                  rows={3}
                />
                <div className="approval-buttons">
                  <button className="primary-button" disabled={isSubmittingApproval || !currentUser} onClick={() => void submitApproval("complete")}>Approve step</button>
                  <button className="secondary-button" disabled={isSubmittingApproval || !currentUser} onClick={() => void submitApproval("return")}>Return for correction</button>
                </div>
              </div>
            </section>
          )}

          <section className="metrics-grid" aria-label="Receivables summary">
            <article className="metric-card metric-primary">
              <div className="metric-heading"><span>Total outstanding</span><span className="metric-icon">↗</span></div>
              <strong className="metric-value">{formatCurrency(outstanding)}</strong>
              <div className="metric-foot"><span className="metric-legend" />Across {bills.filter((bill) => bill.status !== "Paid").length} unpaid bills</div>
            </article>
            <article className="metric-card">
              <div className="metric-heading"><span>Overdue</span><span className="metric-icon danger-icon">!</span></div>
              <strong className="metric-value">{formatCurrency(overdue)}</strong>
              <div className="metric-foot"><span className="metric-text danger-text">{bills.filter((bill) => bill.status === "Overdue").length} bills need attention</span></div>
            </article>
            <article className="metric-card">
              <div className="metric-heading"><span>Due soon</span><span className="metric-icon amber-icon">◷</span></div>
              <strong className="metric-value">{formatCurrency(dueSoon)}</strong>
              <div className="metric-foot"><span className="metric-text">Due within the next 7 days</span></div>
            </article>
            <article className="metric-card">
              <div className="metric-heading"><span>Collected</span><span className="metric-icon green-icon">✓</span></div>
              <strong className="metric-value">{formatCurrency(collected)}</strong>
              <div className="metric-foot"><span className="metric-text">Paid bills in this sample</span></div>
            </article>
          </section>

          <section className="collection-strip" aria-label="Collection trend">
            <div className="collection-copy"><div className="section-kicker">COLLECTION PULSE</div><strong>Steady progress, one follow-up at a time.</strong><span>Sample collections across the last six months</span></div>
            <div className="trend-chart" aria-label="Monthly sample collections: April through September">
              {[34, 48, 39, 67, 56, 82].map((height, index) => (
                <div className="trend-month" key={index}>
                  <span className={`trend-bar ${index === 5 ? "trend-current" : ""}`} style={{ height: `${height}%` }} />
                  <small>{["Apr", "May", "Jun", "Jul", "Aug", "Sep"][index]}</small>
                </div>
              ))}
            </div>
            <div className="trend-total"><small>THIS MONTH</small><strong>{formatCurrency(collected)}</strong><span><i /> Demo figures</span></div>
          </section>

          <section className="bills-section" id="bills">
            <div className="section-heading">
              <div><p className="eyebrow">YOUR RECEIVABLES</p><h2>Recent bills <span className="section-total">{bills.length}</span></h2></div>
              <button className="text-button" onClick={() => { setFilter("All bills"); document.getElementById("bills")?.scrollIntoView({ behavior: "smooth" }); }}>View all <span aria-hidden="true">→</span></button>
            </div>

            <div className="table-toolbar">
              <div className="filter-tabs" role="tablist" aria-label="Filter bills">
                {(["All bills", "Overdue", "Due soon", "Paid"] as BillFilter[]).map((option) => (
                  <button key={option} role="tab" aria-selected={filter === option} className={`filter-tab ${filter === option ? "selected" : ""}`} onClick={() => setFilter(option)}>{option}<span>{option === "All bills" ? bills.length : bills.filter((bill) => bill.status === option).length}</span></button>
                ))}
              </div>
              <label className="search-box"><span aria-hidden="true">⌕</span><input type="search" placeholder="Search bills" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search bills" /><kbd>⌘ K</kbd></label>
            </div>

            <div className="table-wrap">
              <table>
                <thead><tr><th>Customer</th><th>Invoice</th><th>Due date</th><th>Status</th><th className="amount-heading">Amount</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {visibleBills.map((bill, index) => (
                    <tr key={bill.id} style={{ animationDelay: `${index * 45}ms` }}>
                      <td><div className="customer-cell"><span className={`customer-avatar avatar-${avatarSeed(bill.id)}`}>{initials(bill.customer)}</span><strong>{bill.customer}</strong></div></td>
                      <td className="invoice-cell">{bill.invoice}</td>
                      <td className="due-cell">{bill.due}</td>
                      <td><span className={`status-pill status-${bill.status.toLowerCase().replace(" ", "-")}`}><i />{bill.status}</span></td>
                      <td className="amount-cell">{formatCurrency(bill.amount)}</td>
                      <td className="action-cell">{bill.status !== "Paid" && <button className="row-action" onClick={() => markPaid(bill.id)} aria-label={`Mark ${bill.invoice} as paid`}>Mark paid</button>}</td>
                    </tr>
                  ))}
                  {visibleBills.length === 0 && <tr><td className="empty-state" colSpan={6}>No bills match this view.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="table-footer"><span>Showing {visibleBills.length} of {bills.length} bills</span><span>Amounts shown in INR <b>·</b> Demo data</span></div>
          </section>
          <footer className="page-footer"><span>THOORIGAI LEDGER <i>·</i> COLLECTIONS WORKSPACE</span><span>Built for a clearer view of every rupee.</span></footer>
        </div>
      </section>

      {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notification">×</button></div>}

      {dialogOpen && <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialogOpen(false); }}>
        <section className="bill-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
          <div className="dialog-heading"><div><p className="eyebrow">DEMO WORKSPACE</p><h2 id="dialog-title">Add a bill</h2></div><button className="dialog-close" onClick={() => setDialogOpen(false)} aria-label="Close dialog">×</button></div>
          <p className="dialog-description">Add a sample receivable to this temporary dashboard.</p>
          <form onSubmit={addBill}>
            <label>Customer name<input required autoFocus value={draft.customer} onChange={(event) => setDraft({ ...draft, customer: event.target.value })} placeholder="e.g. Acme Industries" /></label>
            <div className="form-two-columns"><label>Invoice number<input required value={draft.invoice} onChange={(event) => setDraft({ ...draft, invoice: event.target.value })} placeholder="e.g. INV-2482" /></label><label>Amount (INR)<input required min="1" type="number" inputMode="numeric" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} placeholder="0" /></label></div>
            <label>Due date<input required type="date" value={draft.due} onChange={(event) => setDraft({ ...draft, due: event.target.value })} /></label>
            <div className="dialog-actions"><button className="secondary-button" type="button" onClick={() => setDialogOpen(false)}>Cancel</button><button className="primary-button" type="submit">Add to demo</button></div>
          </form>
        </section>
      </div>}
    </main>
  );
}
