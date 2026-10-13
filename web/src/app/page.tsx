"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

type BillStatus = "Overdue" | "Due soon" | "Open" | "Partially paid" | "Disputed" | "Paid";
type WorkflowRecord = {
  id: string;
  name: string;
  organizationId?: string;
  stages: Array<{
    id?: string;
    order: number;
    reminderIntervalHours?: number;
    maxReminders?: number;
    contact?: { id?: string; name?: string; email?: string; role?: string };
    backupContact?: { id?: string; name?: string; email?: string; role?: string };
  }>;
  _count?: { batches: number };
};
type BatchHistoryRecord = BatchRecord & {
  template?: { id: string; name: string };
  organization?: { id: string; name: string };
  createdAt?: string;
  notifications?: Array<{
    id: string;
    recipient: string;
    status: string;
    sentAt?: string | null;
    error?: string | null;
    createdAt: string;
  }>;
  auditLogs?: Array<{
    id: string;
    entityType: string;
    entityId: string;
    action: string;
    actor: string;
    detail?: Record<string, unknown> | string | number | boolean | null;
    createdAt: string;
  }>;
};
type Bill = {
  id: number | string;
  customer: string;
  invoice: string;
  amount: number;
  balanceDue: number;
  due: string;
  dueDate?: string | null;
  status: BillStatus;
  isDemo: boolean;
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
    lastComment?: string | null;
    alertedAt?: string | null;
    nextReminderAt?: string | null;
    reminderCount?: number;
    stage?: {
      id?: string;
      order?: number;
      contact?: { id?: string; name?: string; email?: string; role?: string };
      backupContact?: { id?: string; name?: string; email?: string; role?: string };
    };
  }>;
};
type BillFilter = "All bills" | "Overdue" | "Due soon" | "Partially paid" | "Disputed" | "Paid";
type AppUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
};
type ContactRecord = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
};
type BatchBillDraft = { billNumber: string; amount: string; dueDate: string };
type PaymentLineDraft = { billId: string; billNumber: string; balanceDue: number; amount: string; deductionAmount: string; deductionType: string };
type PaymentRecord = {
  id: string;
  amount: number | string;
  unallocatedAmount: number | string;
  reference?: string | null;
  paidAt?: string;
  proofKey?: string | null;
};

const emptyBatchBill = (): BatchBillDraft => ({ billNumber: "", amount: "", dueDate: "" });

const startingBills: Bill[] = [];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
const formatExactCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

const getAgingStatus = (dueDate?: string | null, balanceDue = 0, fallback?: BillStatus): BillStatus | null => {
  if (balanceDue <= 0) return null;
  if (!dueDate) return fallback === "Overdue" || fallback === "Due soon" ? fallback : "Open";

  const dateOnly = dueDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return fallback === "Overdue" || fallback === "Due soon" ? fallback : "Open";
  }
  const now = new Date();
  const todayOnly = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const daysUntilDue = Math.round((Date.parse(`${dateOnly}T00:00:00Z`) - Date.parse(`${todayOnly}T00:00:00Z`)) / 86400000);
  if (daysUntilDue < 0) return "Overdue";
  if (daysUntilDue <= 7) return "Due soon";
  return "Open";
};

const toBillStatus = (status?: string, dueDate?: string | null, balanceDue = 0): BillStatus => {
  if (status === "PAID" || balanceDue <= 0) return "Paid";
  if (status === "DISPUTED") return "Disputed";
  if (status === "PARTIALLY_PAID") return "Partially paid";
  return getAgingStatus(dueDate, balanceDue) ?? "Paid";
};

const toDisplayBills = (batchData: BatchRecord[] | undefined): Bill[] => {
  if (!Array.isArray(batchData) || batchData.length === 0) {
    return startingBills;
  }

  return batchData.flatMap((batch) =>
    (batch.bills ?? []).map((bill, index) => {
      const amount = Number(bill.amount ?? bill.balanceDue ?? 0);
      const balanceDue = Number(bill.balanceDue ?? bill.amount ?? 0);
      const invoice = bill.billNumber ?? `INV-${String(index + 1).padStart(4, "0")}`;
      const dueDate = bill.dueDate ? new Date(bill.dueDate) : null;
      const dueText = dueDate
        ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(dueDate)
        : "TBD";

      return {
        id: bill.id ?? `${batch.id}-${invoice}`,
        customer: batch.stepInstances?.[0]?.stage?.contact?.name ?? (batch.id ? "Demo Organization" : "Customer"),
        invoice,
        amount: Number.isFinite(amount) ? amount : 0,
        balanceDue: Number.isFinite(balanceDue) ? balanceDue : 0,
        due: dueText,
        dueDate: bill.dueDate ?? null,
        status: toBillStatus(bill.status, bill.dueDate ?? null, balanceDue),
        isDemo: false,
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

function getApiBase(): string {
  if (typeof window !== "undefined") {
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    if (envUrl && !envUrl.includes("localhost")) {
      return envUrl;
    }
    if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      return `${window.location.protocol}//${window.location.hostname}:3001`;
    }
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
}

export default function Home() {
  const [bills, setBills] = useState(startingBills);
  const [filter, setFilter] = useState<BillFilter>("All bills");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [contactsDialogOpen, setContactsDialogOpen] = useState(false);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [contactDraft, setContactDraft] = useState({ name: "", email: "", role: "Approver" });
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [batchBills, setBatchBills] = useState<BatchBillDraft[]>([emptyBatchBill()]);
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const [paymentEntryOpen, setPaymentEntryOpen] = useState(false);
  const [paymentBatch, setPaymentBatch] = useState<BatchRecord | null>(null);
  const [paymentLines, setPaymentLines] = useState<PaymentLineDraft[]>([]);
  const [paymentRecords, setPaymentRecords] = useState<Record<string, PaymentRecord[]>>({});
  const [proofLinks, setProofLinks] = useState<Record<string, string>>({});
  const localProofUrls = useRef(new Set<string>());
  const [isUploadingProofFor, setIsUploadingProofFor] = useState<string | null>(null);
  const [onAccountPaymentId, setOnAccountPaymentId] = useState<string | null>(null);
  const [isOnAccountEntry, setIsOnAccountEntry] = useState(false);
  const [onAccountAmount, setOnAccountAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState({ customer: "", invoice: "", amount: "", due: "" });
  const [liveWorkflow, setLiveWorkflow] = useState<WorkflowRecord | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([]);
  const [workflowsDialogOpen, setWorkflowsDialogOpen] = useState(false);
  const [isSavingWorkflow, setIsSavingWorkflow] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState("");
  const [newWorkflowStages, setNewWorkflowStages] = useState<Array<{ contactId: string; backupContactId: string; reminderIntervalHours: number; maxReminders: number }>>([
    { contactId: "", backupContactId: "", reminderIntervalHours: 24, maxReminders: 3 },
  ]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [batchHistoryDialogOpen, setBatchHistoryDialogOpen] = useState(false);
  const [selectedBatchHistory, setSelectedBatchHistory] = useState<BatchHistoryRecord | null>(null);
  const [isLoadingBatchHistory, setIsLoadingBatchHistory] = useState(false);
  const [historyTab, setHistoryTab] = useState<"stages" | "bills" | "audit" | "notifications">("stages");
  const [batchFilter, setBatchFilter] = useState<"ALL" | "IN_PROGRESS" | "READY_FOR_PAYMENT" | "COMPLETED">("ALL");
  const [liveBatches, setLiveBatches] = useState<BatchRecord[]>([]);
  const [currentDateTime, setCurrentDateTime] = useState<string>("");
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [reassignTarget, setReassignTarget] = useState<{ batchId: string; stepId: string; currentContactName?: string } | null>(null);
  const [reassignNewContactId, setReassignNewContactId] = useState("");
  const [reassignReason, setReassignReason] = useState("");
  const [isSubmittingReassign, setIsSubmittingReassign] = useState(false);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentDateTime(
        new Intl.DateTimeFormat("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }).format(now)
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);
  const [liveBatchCount, setLiveBatchCount] = useState<number | null>(null);
  const [apiStatus, setApiStatus] = useState<"loading" | "connected" | "offline">("loading");
  const [approvalComment, setApprovalComment] = useState("");
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  async function loginAs(email: string, password: string): Promise<string | null> {
    const apiBase = getApiBase();
    const response = await fetch(`${apiBase}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      setNotice("Sign-in failed. Use a demo user.");
      return null;
    }

    const payload = (await response.json()) as { token: string; user: AppUser };
    setCurrentUser(payload.user);
    setAuthToken(payload.token);
    localStorage.setItem("thoorigai-token", payload.token);
    localStorage.setItem("thoorigai-user", JSON.stringify(payload.user));
    setNotice(`Signed in as ${payload.user.name}.`);
    return payload.token;
  }

  async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
    let token = authToken || (typeof window !== "undefined" ? localStorage.getItem("thoorigai-token") : null);
    if (!token) {
      const email = currentUser?.email || "admin@example.test";
      token = await loginAs(email, "demo123");
    }

    const headers = new Headers(init.headers);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    let response = await fetch(url, { ...init, headers });
    if (response.status === 401) {
      const email = currentUser?.email || "admin@example.test";
      const freshToken = await loginAs(email, "demo123");
      if (freshToken) {
        headers.set("Authorization", `Bearer ${freshToken}`);
        response = await fetch(url, { ...init, headers });
      }
    }
    return response;
  }

  async function fetchContacts(tokenOverride?: string): Promise<ContactRecord[]> {
    const token = tokenOverride || authToken;
    if (!token || !currentUser) return [];
    const apiBase = getApiBase();
    try {
      const response = await fetch(`${apiBase}/contacts?organizationId=${encodeURIComponent(currentUser.organizationId)}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return [];
      const data = (await response.json()) as ContactRecord[];
      setContacts(data);
      return data;
    } catch {
      return [];
    }
  }

  async function openContactsDialog() {
    if (!currentUser || !authToken) return;
    try {
      await fetchContacts();
      setContactsDialogOpen(true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load contacts.");
    }
  }

  async function saveContact(contact: ContactRecord) {
    if (!currentUser || !authToken) return;
    setIsSavingContact(true);
    const apiBase = getApiBase();
    try {
      const response = await fetch(`${apiBase}/contacts/${contact.id}?organizationId=${encodeURIComponent(currentUser.organizationId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ email: contact.email, role: contact.role, isActive: contact.isActive }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { message?: string };
        throw new Error(result.message || "Unable to update this contact.");
      }
      const updated = (await response.json()) as ContactRecord;
      setContacts((current) => current.map((item) => item.id === updated.id ? updated : item));
      if (authToken) void loadWorkflows(authToken);
      setNotice("Contact updated.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update this contact.");
    } finally {
      setIsSavingContact(false);
    }
  }

  async function createContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentUser || !authToken) return;
    setIsSavingContact(true);
    const apiBase = getApiBase();
    try {
      const response = await fetch(`${apiBase}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ organizationId: currentUser.organizationId, ...contactDraft }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { message?: string };
        throw new Error(result.message || "Unable to add this contact.");
      }
      const created = (await response.json()) as ContactRecord;
      setContacts((current) => [...current, created].sort((left, right) => left.name.localeCompare(right.name)));
      setContactDraft({ name: "", email: "", role: "Approver" });
      setNotice("Contact added.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to add this contact.");
    } finally {
      setIsSavingContact(false);
    }
  }

  async function fetchPaymentsForBatch(batchId: string, token: string): Promise<PaymentRecord[]> {
    const apiBase = getApiBase();
    const response = await fetch(`${apiBase}/payments/batch/${encodeURIComponent(batchId)}`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return [];
    return (await response.json()) as PaymentRecord[];
  }

  async function refreshPaymentRecords(batches: BatchRecord[], token: string) {
    const entries = await Promise.all(
      batches.map(async (batch) => [
        batch.id,
        await fetchPaymentsForBatch(batch.id, token),
      ] as const),
    );
    setPaymentRecords(Object.fromEntries(entries));
  }

  async function attachPaymentProof(paymentId: string, file: File) {
    if (!authToken || !currentUser) return;
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      setNotice("Choose a PDF, JPG, or PNG file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setNotice("Payment proof must be 10 MB or smaller.");
      return;
    }

    const apiBase = getApiBase();
    setIsUploadingProofFor(paymentId);
    try {
      const response = await fetch(`${apiBase}/payments/${encodeURIComponent(paymentId)}/proof-file`, {
        method: "PUT",
        headers: { "Content-Type": file.type, Authorization: `Bearer ${authToken}` },
        body: file,
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string | string[] };
        const message = Array.isArray(payload.message) ? payload.message.join(" ") : payload.message;
        throw new Error(message || "Could not upload the payment proof.");
      }

      await refreshPaymentRecords(liveBatches, authToken);
      setProofLinks((current) => {
        const next = { ...current };
        if (next[paymentId]?.startsWith("blob:")) URL.revokeObjectURL(next[paymentId]);
        delete next[paymentId];
        return next;
      });
      setNotice("Payment proof uploaded and attached.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Payment proof upload failed.");
    } finally {
      setIsUploadingProofFor(null);
    }
  }

  async function createPaymentProofViewLink(paymentId: string) {
    if (!authToken) return;
    const apiBase = getApiBase();
    try {
      const response = await fetch(`${apiBase}/payments/${encodeURIComponent(paymentId)}/proof-download-url`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string | string[] };
        const message = Array.isArray(payload.message) ? payload.message.join(" ") : payload.message;
        throw new Error(message || "Could not create a secure proof link.");
      }
      const result = (await response.json()) as { url?: string; local?: boolean };
      let url = result.url;
      if (result.local) {
        const fileResponse = await fetch(`${apiBase}/payments/${encodeURIComponent(paymentId)}/proof-file`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!fileResponse.ok) throw new Error("Could not load the local payment proof.");
        url = URL.createObjectURL(await fileResponse.blob());
        localProofUrls.current.add(url);
      }
      if (!url) throw new Error("The payment proof link was not returned.");
      setProofLinks((current) => {
        if (current[paymentId]?.startsWith("blob:")) {
          URL.revokeObjectURL(current[paymentId]);
          localProofUrls.current.delete(current[paymentId]);
        }
        return { ...current, [paymentId]: url! };
      });
      setNotice(result.local ? "Local payment proof is ready to open." : "Secure payment proof link is ready. Open it within five minutes.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not open the payment proof.");
    }
  }

  useEffect(() => {
    const apiBase = getApiBase();
    let isMounted = true;
    const fetchDashboard = (token: string) => {
      const headers = { Authorization: `Bearer ${token}` };
      return Promise.all([
        fetch(`${apiBase}/workflows?organizationId=demo-org`, { cache: "no-store", headers }),
        fetch(`${apiBase}/batches?organizationId=demo-org`, { cache: "no-store", headers }),
        fetch(`${apiBase}/contacts?organizationId=demo-org`, { cache: "no-store", headers }),
      ]);
    };

    const loadDashboard = async () => {
      let token: string | null = null;
      const savedToken = window.localStorage.getItem("thoorigai-token");
      const savedUser = window.localStorage.getItem("thoorigai-user");

      if (savedToken && savedUser) {
        try {
          const user = JSON.parse(savedUser) as AppUser;
          token = savedToken;
          setAuthToken(savedToken);
          setCurrentUser(user);
        } catch {
          window.localStorage.removeItem("thoorigai-token");
          window.localStorage.removeItem("thoorigai-user");
        }
      }

      if (!token) token = await loginAs("admin@example.test", "demo123");
      if (!token) throw new Error("Authentication failed");

      let [workflowResponse, batchResponse, contactsResponse] = await fetchDashboard(token);
      if (workflowResponse.status === 401 || batchResponse.status === 401) {
        window.localStorage.removeItem("thoorigai-token");
        window.localStorage.removeItem("thoorigai-user");
        token = await loginAs("admin@example.test", "demo123");
        if (!token) throw new Error("Authentication failed");
        [workflowResponse, batchResponse, contactsResponse] = await fetchDashboard(token);
      }

      if (!workflowResponse.ok || !batchResponse.ok) throw new Error("API request failed");
      const workflowData = (await workflowResponse.json()) as WorkflowRecord[];
      const batchData = (await batchResponse.json()) as BatchRecord[];
      const paymentEntries = await Promise.all(
        batchData.map(async (batch) => [
          batch.id,
          await fetchPaymentsForBatch(batch.id, token!),
        ] as const),
      );
      if (!isMounted) return;

      const derivedBills = toDisplayBills(batchData);
      setBills(derivedBills);
      if (contactsResponse && contactsResponse.ok) {
        const contactsData = (await contactsResponse.json()) as ContactRecord[];
        setContacts(contactsData);
      }
      const safeWorkflows = Array.isArray(workflowData) ? workflowData : [];
      setWorkflows(safeWorkflows);
      setLiveWorkflow(safeWorkflows[0] ?? null);
      if (safeWorkflows[0]) setSelectedTemplateId(safeWorkflows[0].id);
      setLiveBatches(batchData);
      setPaymentRecords(Object.fromEntries(paymentEntries));
      setLiveBatchCount(Array.isArray(batchData) ? batchData.length : 0);
      setApiStatus("connected");
    };

    void loadDashboard().catch(() => {
      if (!isMounted) return;
      setBills(startingBills);
      setLiveWorkflow(null);
      setLiveBatches([]);
      setPaymentRecords({});
      setLiveBatchCount(null);
      setApiStatus("offline");
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => () => {
    for (const url of localProofUrls.current) URL.revokeObjectURL(url);
    localProofUrls.current.clear();
  }, []);

  const outstanding = bills.reduce((sum, bill) => sum + bill.balanceDue, 0);
  const overdue = bills
    .filter((bill) => getAgingStatus(bill.dueDate, bill.balanceDue, bill.status) === "Overdue")
    .reduce((sum, bill) => sum + bill.balanceDue, 0);
  const dueSoon = bills
    .filter((bill) => getAgingStatus(bill.dueDate, bill.balanceDue, bill.status) === "Due soon")
    .reduce((sum, bill) => sum + bill.balanceDue, 0);
  const recordedPayments = Object.values(paymentRecords).flat();
  const recordedPaymentValue = recordedPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const demoPaidAmount = bills
    .filter((bill) => bill.isDemo && bill.status === "Paid")
    .reduce((sum, bill) => sum + bill.amount, 0);
  const collected = recordedPaymentValue + demoPaidAmount;
  const currentMonth = new Date();
  const collectedThisMonth = recordedPayments
    .filter((payment) => {
      if (!payment.paidAt) return false;
      const paidAt = new Date(payment.paidAt);
      return paidAt.getFullYear() === currentMonth.getFullYear() && paidAt.getMonth() === currentMonth.getMonth();
    })
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const matchesBillFilter = (bill: Bill, option: BillFilter) => {
    if (option === "All bills") return true;
    if (option === "Overdue" || option === "Due soon") {
      return getAgingStatus(bill.dueDate, bill.balanceDue, bill.status) === option;
    }
    return bill.status === option;
  };
  const visibleBills = bills.filter((bill) => {
    const matchesFilter = matchesBillFilter(bill, filter);
    const matchesSearch = `${bill.customer} ${bill.invoice}`
      .toLowerCase()
      .includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });
  const pendingApprovalBatches = liveBatches.flatMap((batch) => {
    if (batch.status !== "IN_PROGRESS") return [];
    const step = batch.stepInstances?.find((item) => item.status === "ALERTED");
    return step ? [{ batch, step }] : [];
  });

  function markPaid(id: number | string) {
    setBills((current) =>
      current.map((bill) => (bill.id === id ? { ...bill, balanceDue: 0, status: "Paid" } : bill)),
    );
    setNotice("Payment recorded in this demo session.");
  }

  async function submitApproval(action: "complete" | "return", stepInstanceId: string) {
    const activeItem = pendingApprovalBatches.find((item) => item.step.id === stepInstanceId);
    const step = activeItem?.step;
    if (!step) {
      setNotice("This approval step is no longer pending. Refresh the page and try again.");
      return;
    }

    setIsSubmittingApproval(true);
    const apiBase = getApiBase();
    const actor = currentUser?.id ?? step.stage?.contact?.id ?? step.stage?.backupContact?.id ?? "demo-approver";

    const response = await authFetch(`${apiBase}/workflows/steps/${step.id}/${action}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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

    const organizationId = currentUser?.organizationId ?? "demo-org";
    const batchResponse = await fetch(`${apiBase}/batches?organizationId=${encodeURIComponent(organizationId)}`, {
      cache: "no-store",
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    });
    if (batchResponse.ok) {
      const freshBatch = (await batchResponse.json()) as BatchRecord[];
      const derivedBills = toDisplayBills(freshBatch);
      setBills(derivedBills);
      setLiveBatches(freshBatch);
      setLiveBatchCount(freshBatch.length);
      if (authToken) await refreshPaymentRecords(freshBatch, authToken);
    }
  }

  async function openApprovalLink(stepId: string) {
    if (!authToken) return;
    const apiBase = getApiBase();
    try {
      const response = await fetch(`${apiBase}/workflows/steps/${encodeURIComponent(stepId)}/approval-link`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!response.ok) throw new Error("Could not generate approval link.");
      const data = (await response.json()) as { url: string; token?: string; approverEmail: string };
      let targetUrl = data.url;
      try {
        const parsed = new URL(data.url);
        targetUrl = `${window.location.origin}${parsed.pathname}${parsed.search}`;
      } catch {
        targetUrl = data.url;
      }
      window.open(targetUrl, "_blank");
      setNotice(`Opened approval link for ${data.approverEmail} in a new tab.`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not open approval link.");
    }
  }

  async function submitConfirmOnBehalf(batchId: string, stepInstanceId: string) {
    if (!authToken || !currentUser) return;
    setIsSubmittingApproval(true);
    const apiBase = getApiBase();
    try {
      const response = await fetch(`${apiBase}/batches/${encodeURIComponent(batchId)}/steps/${encodeURIComponent(stepInstanceId)}/confirm-on-behalf`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ note: approvalComment.trim() || undefined }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message || "Could not confirm on behalf of approver.");
      }
      setApprovalComment("");
      setNotice("Step confirmed on behalf of approver (offline/manual confirmation logged).");

      const organizationId = currentUser.organizationId ?? "demo-org";
      const batchResponse = await fetch(`${apiBase}/batches?organizationId=${encodeURIComponent(organizationId)}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (batchResponse.ok) {
        const freshBatch = (await batchResponse.json()) as BatchRecord[];
        setBills(toDisplayBills(freshBatch));
        setLiveBatches(freshBatch);
        setLiveBatchCount(freshBatch.length);
        await refreshPaymentRecords(freshBatch, authToken);
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Confirmation failed.");
    } finally {
      setIsSubmittingApproval(false);
    }
  }

  async function submitReassignStep() {
    if (!authToken || !currentUser || !reassignTarget || !reassignNewContactId) return;
    setIsSubmittingReassign(true);
    const apiBase = getApiBase();
    try {
      const response = await fetch(
        `${apiBase}/batches/${encodeURIComponent(reassignTarget.batchId)}/steps/${encodeURIComponent(reassignTarget.stepId)}/reassign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({
            newContactId: reassignNewContactId,
            reason: reassignReason.trim() || undefined,
          }),
        }
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message || "Failed to reassign step.");
      }
      setNotice("Step successfully reassigned! The new approver has been notified.");
      setReassignModalOpen(false);
      setReassignTarget(null);
      setReassignReason("");
      setReassignNewContactId("");

      const organizationId = currentUser.organizationId ?? "demo-org";
      const batchResponse = await fetch(`${apiBase}/batches?organizationId=${encodeURIComponent(organizationId)}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (batchResponse.ok) {
        const freshBatch = (await batchResponse.json()) as BatchRecord[];
        setBills(toDisplayBills(freshBatch));
        setLiveBatches(freshBatch);
        setLiveBatchCount(freshBatch.length);
        await refreshPaymentRecords(freshBatch, authToken);
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Reassignment failed.");
    } finally {
      setIsSubmittingReassign(false);
    }
  }

  async function loadWorkflows(tokenOverride?: string) {
    const token = tokenOverride || authToken;
    if (!token || !currentUser) return;
    const apiBase = getApiBase();
    try {
      const response = await fetch(`${apiBase}/workflows?organizationId=${encodeURIComponent(currentUser.organizationId)}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = (await response.json()) as WorkflowRecord[];
        setWorkflows(data);
        if (data[0] && !selectedTemplateId) {
          setSelectedTemplateId(data[0].id);
          setLiveWorkflow(data[0]);
        }
      }
    } catch {
      // non-fatal
    }
  }

  async function openWorkflowsDialog() {
    if (!currentUser || !authToken) return;
    try {
      await loadWorkflows();
      if (contacts.length === 0) {
        const apiBase = getApiBase();
        const res = await fetch(`${apiBase}/contacts?organizationId=${encodeURIComponent(currentUser.organizationId)}`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (res.ok) setContacts((await res.json()) as ContactRecord[]);
      }
      setWorkflowsDialogOpen(true);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not load workflows");
    }
  }

  async function createWorkflow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authToken || !currentUser) return;
    if (!newWorkflowName.trim()) {
      setNotice("Workflow template name is required.");
      return;
    }
    if (newWorkflowStages.some((stage) => !stage.contactId)) {
      setNotice("Please select a primary approver contact for every stage.");
      return;
    }

    setIsSavingWorkflow(true);
    const apiBase = getApiBase();
    try {
      const response = await fetch(`${apiBase}/workflows`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          organizationId: currentUser.organizationId,
          name: newWorkflowName.trim(),
          stages: newWorkflowStages.map((s) => ({
            contactId: s.contactId,
            ...(s.backupContactId ? { backupContactId: s.backupContactId } : {}),
            reminderIntervalHours: Number(s.reminderIntervalHours) || 24,
            maxReminders: Number(s.maxReminders) || 3,
          })),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string | string[] };
        const msg = Array.isArray(payload.message) ? payload.message.join(" ") : payload.message;
        throw new Error(msg || "Could not create workflow template.");
      }

      const createdWf = (await response.json().catch(() => ({}))) as WorkflowRecord;
      await loadWorkflows();
      if (createdWf?.id) {
        setSelectedTemplateId(createdWf.id);
        setLiveWorkflow(createdWf);
      }
      setNewWorkflowName("");
      setNewWorkflowStages([{ contactId: "", backupContactId: "", reminderIntervalHours: 24, maxReminders: 3 }]);
      setNotice(`Workflow "${createdWf?.name || "Template"}" created and selected for new batches.`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Workflow creation failed.");
    } finally {
      setIsSavingWorkflow(false);
    }
  }

  async function deleteWorkflow(id: string) {
    if (!authToken || !currentUser) return;
    const apiBase = getApiBase();
    try {
      const response = await fetch(`${apiBase}/workflows/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message || "Could not delete workflow template.");
      }
      await loadWorkflows();
      setNotice("Workflow template deleted.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  async function deleteBatch(batchId: string) {
    if (!currentUser || currentUser.role.toLowerCase() !== "admin") {
      setNotice("Only administrators can delete batches.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this batch and its bills?")) {
      return;
    }
    const apiBase = getApiBase();
    try {
      const response = await authFetch(`${apiBase}/batches/${encodeURIComponent(batchId)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message || "Failed to delete batch.");
      }
      const orgId = currentUser.organizationId || "demo-org";
      const bResp = await authFetch(`${apiBase}/batches?organizationId=${encodeURIComponent(orgId)}`, {
        cache: "no-store",
      });
      if (bResp.ok) {
        const updated = (await bResp.json()) as BatchRecord[];
        setBills(toDisplayBills(updated));
        setLiveBatches(updated);
        setLiveBatchCount(updated.length);
      }
      setNotice("Batch and its bills deleted successfully.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  async function openBatchHistory(batchId: string) {
    if (!authToken || !currentUser) return;
    setIsLoadingBatchHistory(true);
    setSelectedBatchHistory(null);
    setHistoryTab("stages");
    setBatchHistoryDialogOpen(true);
    const apiBase = getApiBase();
    try {
      const response = await fetch(`${apiBase}/batches/${encodeURIComponent(batchId)}/history`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!response.ok) {
        throw new Error("Unable to load batch audit trail and history.");
      }
      const data = (await response.json()) as BatchHistoryRecord;
      setSelectedBatchHistory(data);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "History fetch failed.");
    } finally {
      setIsLoadingBatchHistory(false);
    }
  }

  async function createBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authToken || !currentUser || !liveWorkflow) {
      setNotice("Sign in and load a workflow before creating a batch.");
      return;
    }

    setIsCreatingBatch(true);
    const apiBase = getApiBase();
    try {
      const response = await authFetch(`${apiBase}/batches`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organizationId: currentUser.organizationId,
          templateId: selectedTemplateId || liveWorkflow.id,
          bills: batchBills.map((bill) => ({
            billNumber: bill.billNumber.trim(),
            amount: Number(bill.amount),
            ...(bill.dueDate ? { dueDate: bill.dueDate } : {}),
          })),
        }),
      });

      if (!response.ok) {
        const errorPayload = (await response.json()) as { message?: string | string[] };
        const message = Array.isArray(errorPayload.message) ? errorPayload.message.join(" ") : errorPayload.message;
        throw new Error(message || "Batch creation failed.");
      }

      const batchResponse = await fetch(`${apiBase}/batches?organizationId=${encodeURIComponent(currentUser.organizationId)}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (batchResponse.ok) {
        const batches = (await batchResponse.json()) as BatchRecord[];
        setBills(toDisplayBills(batches));
        setLiveBatches(batches);
        setLiveBatchCount(batches.length);
      }

      setBatchBills([emptyBatchBill()]);
      setBatchDialogOpen(false);
      setNotice("Batch created. The initial approver notification was attempted.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Batch creation failed.");
    } finally {
      setIsCreatingBatch(false);
    }
  }

  function openPaymentEntry(batch: BatchRecord) {
    const bills = batch.bills?.filter((bill): bill is typeof bill & { id: string } => Boolean(bill.id)) ?? [];
    if (bills.length === 0) {
      setNotice("This batch has no bills available for allocation.");
      return;
    }
    setPaymentBatch(batch);
    setOnAccountPaymentId(null);
    setIsOnAccountEntry(false);
    setOnAccountAmount("");
    setPaymentLines(bills.filter((bill) => Number(bill.balanceDue ?? bill.amount ?? 0) > 0).map((bill) => ({
      billId: bill.id,
      billNumber: bill.billNumber ?? bill.id,
      balanceDue: Number(bill.balanceDue ?? bill.amount ?? 0),
      amount: "",
      deductionAmount: "",
      deductionType: "",
    })));
    setPaymentReference("");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentEntryOpen(true);
  }

  function openOnAccountEntry(batch: BatchRecord) {
    setPaymentBatch(batch);
    setOnAccountPaymentId(null);
    setIsOnAccountEntry(true);
    setOnAccountAmount("");
    setPaymentLines([]);
    setPaymentReference("");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentEntryOpen(true);
  }

  function openOnAccountAllocation(batch: BatchRecord, payment: PaymentRecord) {
    const bills = batch.bills?.filter((bill): bill is typeof bill & { id: string } => Boolean(bill.id)) ?? [];
    setPaymentBatch(batch);
    setOnAccountPaymentId(payment.id);
    setIsOnAccountEntry(false);
    setOnAccountAmount("");
    setPaymentLines(bills.filter((bill) => Number(bill.balanceDue ?? bill.amount ?? 0) > 0).map((bill) => ({
      billId: bill.id,
      billNumber: bill.billNumber ?? bill.id,
      balanceDue: Number(bill.balanceDue ?? bill.amount ?? 0),
      amount: "",
      deductionAmount: "",
      deductionType: "",
    })));
    setPaymentReference(payment.reference ?? "");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentEntryOpen(true);
  }

  async function createPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authToken || !currentUser || !paymentBatch) return;

    const allocations = paymentLines
      .map((line) => ({
        billId: line.billId,
        amount: Number(line.amount || 0),
        deductionAmount: Number(line.deductionAmount || 0),
        deductionType: line.deductionType,
        balanceDue: line.balanceDue,
      }))
      .filter((line) => line.amount > 0 || line.deductionAmount > 0);
    if (isOnAccountEntry && (!Number.isFinite(Number(onAccountAmount)) || Number(onAccountAmount) <= 0)) {
      setNotice("Enter a positive amount to record on account.");
      return;
    }
    if (!isOnAccountEntry && allocations.length === 0) {
      setNotice("Enter an amount or deduction for at least one bill.");
      return;
    }
    if (allocations.some((line) => line.deductionAmount > 0 && !line.deductionType)) {
      setNotice("Choose a deduction type for each deduction.");
      return;
    }
    if (allocations.some((line) => Math.round((line.amount + line.deductionAmount) * 100) > Math.round(line.balanceDue * 100))) {
      setNotice("Cash plus deduction cannot exceed a bill's remaining balance.");
      return;
    }

    const allocatedTotalCents = allocations.reduce(
      (sum, line) => sum + Math.round(line.amount * 100) + Math.round(line.deductionAmount * 100),
      0,
    );
    const paymentTotalCents = isOnAccountEntry ? Math.round(Number(onAccountAmount) * 100) : allocatedTotalCents;
    setIsSavingPayment(true);
    const apiBase = getApiBase();
    try {
      const allocationPayload = allocations.map((line) => ({
        billId: line.billId,
        amount: line.amount,
        ...(line.deductionAmount > 0 ? { deductionAmount: line.deductionAmount, deductionType: line.deductionType } : {}),
      }));
      const response = await fetch(onAccountPaymentId ? `${apiBase}/payments/${onAccountPaymentId}/allocations` : `${apiBase}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(onAccountPaymentId
          ? { allocations: allocationPayload }
          : {
              batchId: paymentBatch.id,
              amount: paymentTotalCents / 100,
              paidAt: paymentDate,
              reference: paymentReference.trim() || undefined,
              ...(isOnAccountEntry ? {} : { allocations: allocationPayload }),
            }),
      });
      if (!response.ok) {
        const errorPayload = (await response.json()) as { message?: string | string[] };
        const message = Array.isArray(errorPayload.message) ? errorPayload.message.join(" ") : errorPayload.message;
        throw new Error(message || "Payment could not be recorded.");
      }

      const batchResponse = await fetch(`${apiBase}/batches?organizationId=${encodeURIComponent(currentUser.organizationId)}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (batchResponse.ok) {
        const batches = (await batchResponse.json()) as BatchRecord[];
        setBills(toDisplayBills(batches));
        setLiveBatches(batches);
        setLiveBatchCount(batches.length);
        await refreshPaymentRecords(batches, authToken);
      }
      setPaymentEntryOpen(false);
      setPaymentBatch(null);
      setOnAccountPaymentId(null);
      setIsOnAccountEntry(false);
      setOnAccountAmount("");
      setNotice(isOnAccountEntry ? "Payment recorded on account." : onAccountPaymentId ? "On-account funds allocated." : "Payment and bill allocations recorded.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Payment could not be recorded.");
    } finally {
      setIsSavingPayment(false);
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
        balanceDue: amount,
        due: displayDue,
        dueDate: draft.due,
        status: toBillStatus("PENDING", draft.due, amount),
        isDemo: true,
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
          <a className="nav-item" href="#batches"><span className="nav-glyph">◷</span>Batches<span className="nav-count">{liveBatches.length}</span></a>
        </nav>

        <div className="sidebar-bottom">
          <div className="demo-note"><span className="demo-dot" />Demo workspace</div>
          <div className="profile-row">
            <span className="profile-avatar">{currentUser ? initials(currentUser.name) : "AD"}</span>
            <span className="profile-copy"><strong>{currentUser?.name ?? "Admin user"}</strong><small>{currentUser?.role ?? "Admin"} · Thoorigai</small></span>
            <span className="profile-more" aria-hidden="true">···</span>
          </div>
        </div>
      </aside>

      <section className="main-panel" id="overview">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> Overview</div>
          <div className="topbar-right"><span className="sync-state"><span />Live API</span><span className="topbar-date">{currentDateTime || "Loading date..."}</span></div>
        </header>

        <div className="page-content">
          <section className="demo-user-bar" aria-label="Demo role switcher" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "#f0f5ee", borderRadius: 6, border: "1px solid #dce8db", marginBottom: 22, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--forest)", letterSpacing: "0.5px" }}>ACT AS ROLE:</span>
            <button
              className="secondary-button"
              type="button"
              style={{
                height: 34,
                padding: "0 14px",
                fontSize: 12,
                fontWeight: currentUser?.role?.toLowerCase() === "admin" ? 700 : 500,
                borderColor: currentUser?.role?.toLowerCase() === "admin" ? "var(--forest)" : "#dce4de",
                background: currentUser?.role?.toLowerCase() === "admin" ? "#e4ede5" : "#fff",
                color: currentUser?.role?.toLowerCase() === "admin" ? "var(--forest)" : "#56655c",
              }}
              onClick={() => void loginAs("admin@example.test", "demo123")}
            >
              👑 Admin
            </button>
            <button
              className="secondary-button"
              type="button"
              style={{
                height: 34,
                padding: "0 14px",
                fontSize: 12,
                fontWeight: currentUser?.email === "approver@example.test" ? 700 : 500,
                borderColor: currentUser?.email === "approver@example.test" ? "var(--forest)" : "#dce4de",
                background: currentUser?.email === "approver@example.test" ? "#e4ede5" : "#fff",
                color: currentUser?.email === "approver@example.test" ? "var(--forest)" : "#56655c",
              }}
              onClick={() => void loginAs("approver@example.test", "demo123")}
            >
              👤 Primary Approver (Stage 1)
            </button>
            <button
              className="secondary-button"
              type="button"
              style={{
                height: 34,
                padding: "0 14px",
                fontSize: 12,
                fontWeight: currentUser?.email === "backup@example.test" ? 700 : 500,
                borderColor: currentUser?.email === "backup@example.test" ? "var(--forest)" : "#dce4de",
                background: currentUser?.email === "backup@example.test" ? "#e4ede5" : "#fff",
                color: currentUser?.email === "backup@example.test" ? "var(--forest)" : "#56655c",
              }}
              onClick={() => void loginAs("backup@example.test", "demo123")}
            >
              🛡️ Backup Approver (Stage 2)
            </button>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, fontSize: 12 }}>
              <span style={{ color: "var(--muted)" }}>Signed in:</span>
              <strong style={{ color: "var(--forest)" }}>
                {currentUser ? `${currentUser.name} (${currentUser.role})` : "Admin user (Admin)"}
              </strong>
            </div>
          </section>

          <section className="welcome-row">
            <div>
              <p className="eyebrow">COLLECTIONS AT A GLANCE</p>
              <h1>Good morning, {currentUser ? currentUser.name.split(" ")[0] : "Admin"}<span>.</span></h1>
              <p className="welcome-subtitle">Here is where your receivables stand today.</p>
            </div>
            <div className="welcome-actions">
              <button className="secondary-button" onClick={() => setDialogOpen(true)}>Add demo bill</button>
              {currentUser?.role?.toLowerCase() === "admin" && (
                <>
                  <button className="secondary-button" onClick={() => void openWorkflowsDialog()}>Workflows ({workflows.length})</button>
                  <button className="secondary-button" onClick={() => void openContactsDialog()}>Contacts ({contacts.length})</button>
                </>
              )}
              <button className="secondary-button" onClick={() => { document.getElementById("batches")?.scrollIntoView({ behavior: "smooth" }); }}>Batches ({liveBatches.length})</button>
              <button className="primary-button" disabled={apiStatus !== "connected" || (!liveWorkflow && workflows.length === 0)} onClick={() => setBatchDialogOpen(true)}>
                <span aria-hidden="true">＋</span> Create batch
              </button>
            </div>
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

          {apiStatus === "connected" && pendingApprovalBatches.map(({ batch, step }) => {
            const isAssignedApprover = !currentUser ||
              step.stage?.contact?.id === currentUser.id ||
              step.stage?.backupContact?.id === currentUser.id;
            return (
              <section className="workflow-panel" aria-live="polite" key={step.id}>
                <div className="workflow-header">
                  <div>
                    <p className="eyebrow">WORKFLOW ACTION · BATCH {batch.id.slice(0, 8)}</p>
                    <h3>Approval in progress</h3>
                  </div>
                  <span className="status-pill status-alerted"><i />{step.status}</span>
                </div>

                <div className="workflow-details" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <strong>{step.stage?.contact?.name ?? "Assigned approver"} ({step.stage?.contact?.email})</strong>
                    <span>
                      Stage {step.stage?.order ?? 1} is awaiting action for {(batch.bills ?? []).map((bill) => bill.billNumber).filter(Boolean).join(", ") || "this batch"}.
                      {step.stage?.backupContact && ` · Backup: ${step.stage.backupContact.name}`}
                    </span>
                    {step.lastComment && (
                      <div style={{ marginTop: 6, fontSize: "0.85rem", color: step.lastComment.includes("Reassignment") ? "#be123c" : "#0369a1", background: step.lastComment.includes("Reassignment") ? "#fff1f2" : "#f0f9ff", padding: "4px 8px", borderRadius: 4, display: "inline-block" }}>
                        💬 {step.lastComment}
                      </div>
                    )}
                  </div>
                  <div className="approval-buttons" style={{ marginLeft: "auto" }}>
                    <button className="secondary-button" type="button" onClick={() => void loginAs("approver@example.test", "demo123")}>Approver</button>
                    <button className="secondary-button" type="button" onClick={() => void loginAs("backup@example.test", "demo123")}>Backup</button>
                    <button className="secondary-button" type="button" onClick={() => void loginAs("admin@example.test", "demo123")}>Admin</button>
                    {currentUser && (
                      <button className="secondary-button" type="button" onClick={() => {
                        setCurrentUser(null);
                        setAuthToken(null);
                        window.localStorage.removeItem("thoorigai-token");
                        window.localStorage.removeItem("thoorigai-user");
                        setNotice("Signed out.");
                      }}>Sign out</button>
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
                    disabled={!isAssignedApprover}
                  />
                  <div className="approval-buttons">
                    <button className="primary-button" disabled={isSubmittingApproval || !currentUser || !isAssignedApprover} onClick={() => void submitApproval("complete", step.id)}>Approve step</button>
                    <button className="secondary-button" disabled={isSubmittingApproval || !currentUser || !isAssignedApprover} onClick={() => void submitApproval("return", step.id)}>Return for correction</button>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => void openApprovalLink(step.id)}
                      title="Open signed magic link in email approver view"
                    >
                      Open Magic Link ↗
                    </button>
                    {currentUser?.role.toLowerCase() === "admin" && (
                      <>
                        <button
                          className="secondary-button"
                          type="button"
                          disabled={isSubmittingApproval}
                          onClick={() => {
                            setReassignTarget({ batchId: batch.id, stepId: step.id, currentContactName: step.stage?.contact?.name });
                            setReassignNewContactId(contacts.find((c) => c.id !== step.stage?.contact?.id)?.id || "");
                            setReassignReason("");
                            setReassignModalOpen(true);
                          }}
                          title="Reassign this workflow step to another active contact"
                        >
                          🔄 Reassign Approver
                        </button>
                        <button
                          className="secondary-button"
                          type="button"
                          disabled={isSubmittingApproval}
                          onClick={() => void submitConfirmOnBehalf(batch.id, step.id)}
                          title="Record manual/phone confirmation on behalf of approver (audit logged)"
                        >
                          Confirm on behalf (offline)
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </section>
            );
          })}

          {apiStatus === "connected" && liveBatches.some((batch) => batch.status === "READY_FOR_PAYMENT") && (
            <section className="payment-review" aria-labelledby="payment-review-title">
              <div className="workflow-header">
                <div>
                  <p className="eyebrow">PAYMENT REVIEW</p>
                  <h3 id="payment-review-title">Ready for payment</h3>
                </div>
              </div>
              <div className="payment-review-list">
                {liveBatches.filter((batch) => batch.status === "READY_FOR_PAYMENT").map((batch) => (
                  <div className="payment-review-batch" key={batch.id}>
                    <div><strong>Batch {batch.id.slice(0, 8)}</strong><span>{batch.bills?.length ?? 0} bill(s) ready</span></div>
                    <div className="payment-review-list">
                      {(batch.bills ?? []).map((bill) => (
                        <div className="payment-review-row" key={bill.id ?? bill.billNumber}>
                          <strong>{bill.billNumber}</strong>
                          <span>{formatExactCurrency(Number(bill.balanceDue ?? bill.amount ?? 0))} remaining</span>
                          <span className={`status-pill status-${bill.status?.toLowerCase() ?? "pending"}`}><i />{bill.status ?? "PENDING"}</span>
                        </div>
                      ))}
                    </div>
                    {paymentRecords[batch.id]?.filter((payment) => Number(payment.unallocatedAmount) > 0).map((payment) => (
                      <div className="on-account-row" key={payment.id}>
                        <div><strong>On-account balance</strong><span>{formatExactCurrency(Number(payment.unallocatedAmount))} not yet allocated</span></div>
                        <button className="secondary-button" type="button" onClick={() => openOnAccountAllocation(batch, payment)}>Allocate to bills</button>
                      </div>
                    ))}
                    <div className="payment-review-actions">
                      <button className="secondary-button" type="button" onClick={() => openOnAccountEntry(batch)}>Record on account</button>
                      <button className="primary-button" type="button" onClick={() => openPaymentEntry(batch)}>Record payment</button>
                      {currentUser?.role?.toLowerCase() === "admin" && (
                        <button
                          className="secondary-button"
                          type="button"
                          style={{ borderColor: "#fecaca", color: "#be123c", background: "#fff1f2" }}
                          onClick={() => void deleteBatch(batch.id)}
                          title="Delete this batch and its bills"
                        >
                          🗑️ Delete batch
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {apiStatus === "connected" && liveBatches.some((batch) => (paymentRecords[batch.id]?.length ?? 0) > 0) && (
            <section className="payment-review" aria-labelledby="payment-history-title">
              <div className="workflow-header">
                <div>
                  <p className="eyebrow">PAYMENT HISTORY</p>
                  <h3 id="payment-history-title">Recorded payments</h3>
                </div>
              </div>
              <div className="payment-review-list">
                {liveBatches.filter((batch) => (paymentRecords[batch.id]?.length ?? 0) > 0).map((batch) => (
                  <div className="payment-review-batch" key={batch.id}>
                    <div><strong>Batch {batch.id.slice(0, 8)}</strong><span>{batch.status ?? ""}</span></div>
                    {paymentRecords[batch.id].map((payment) => (
                      <div className="payment-history-row" key={payment.id}>
                        <div className="payment-history-details">
                          <strong>{formatExactCurrency(Number(payment.amount))}</strong>
                          <span>{payment.reference || "No payment reference"}{payment.paidAt ? ` · ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(payment.paidAt))}` : ""}</span>
                          {Number(payment.unallocatedAmount) > 0 && <span>{formatExactCurrency(Number(payment.unallocatedAmount))} remains unallocated</span>}
                        </div>
                        {payment.proofKey && (
                          <>
                            <button className="secondary-button" type="button" onClick={() => void createPaymentProofViewLink(payment.id)}>
                              {proofLinks[payment.id] ? "Refresh link" : "Get view link"}
                            </button>
                            {proofLinks[payment.id] && <a className="secondary-button" href={proofLinks[payment.id]} target="_blank" rel="noreferrer">Open proof</a>}
                          </>
                        )}
                        <label className="secondary-button payment-proof-upload">
                          {isUploadingProofFor === payment.id ? "Uploading..." : payment.proofKey ? "Replace proof" : "Attach proof"}
                          <input
                            className="sr-only"
                            type="file"
                            accept="application/pdf,image/jpeg,image/png"
                            disabled={isUploadingProofFor !== null}
                            onChange={(event) => {
                              const file = event.currentTarget.files?.[0];
                              event.currentTarget.value = "";
                              if (file) void attachPaymentProof(payment.id, file);
                            }}
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="metrics-grid" aria-label="Receivables summary">
            <article className="metric-card metric-primary">
              <div className="metric-heading"><span>Total outstanding</span><span className="metric-icon">↗</span></div>
              <strong className="metric-value">{formatCurrency(outstanding)}</strong>
              <div className="metric-foot"><span className="metric-legend" />Across {bills.filter((bill) => bill.balanceDue > 0).length} bills with a balance</div>
            </article>
            <article className="metric-card">
              <div className="metric-heading"><span>Overdue</span><span className="metric-icon danger-icon">!</span></div>
              <strong className="metric-value">{formatCurrency(overdue)}</strong>
              <div className="metric-foot"><span className="metric-text danger-text">{bills.filter((bill) => getAgingStatus(bill.dueDate, bill.balanceDue, bill.status) === "Overdue").length} bills need attention</span></div>
            </article>
            <article className="metric-card">
              <div className="metric-heading"><span>Due soon</span><span className="metric-icon amber-icon">◷</span></div>
              <strong className="metric-value">{formatCurrency(dueSoon)}</strong>
              <div className="metric-foot"><span className="metric-text">Due within the next 7 days</span></div>
            </article>
            <article className="metric-card">
              <div className="metric-heading"><span>Payments recorded</span><span className="metric-icon green-icon">✓</span></div>
              <strong className="metric-value">{formatCurrency(collected)}</strong>
              <div className="metric-foot"><span className="metric-text">Payment totals, including on-account entries</span></div>
            </article>
          </section>

          <section className="collection-strip" aria-label="Collection trend">
            <div className="collection-copy"><div className="section-kicker">COLLECTION PULSE</div><strong>Steady progress, one follow-up at a time.</strong><span>Illustrative monthly trend</span></div>
            <div className="trend-chart" aria-label="Monthly sample collections: April through September">
              {[34, 48, 39, 67, 56, 82].map((height, index) => (
                <div className="trend-month" key={index}>
                  <span className={`trend-bar ${index === 5 ? "trend-current" : ""}`} style={{ height: `${height}%` }} />
                  <small>{["Apr", "May", "Jun", "Jul", "Aug", "Sep"][index]}</small>
                </div>
              ))}
            </div>
            <div className="trend-total"><small>THIS MONTH</small><strong>{formatCurrency(collectedThisMonth)}</strong><span><i /> Payment value recorded</span></div>
          </section>

          <section className="bills-section" id="bills">
            <div className="section-heading">
              <div><p className="eyebrow">YOUR RECEIVABLES</p><h2>Recent bills <span className="section-total">{bills.length}</span></h2></div>
              <button className="text-button" onClick={() => { setFilter("All bills"); document.getElementById("bills")?.scrollIntoView({ behavior: "smooth" }); }}>View all <span aria-hidden="true">→</span></button>
            </div>

            <div className="table-toolbar">
              <div className="filter-tabs" role="tablist" aria-label="Filter bills">
                {(["All bills", "Overdue", "Due soon", "Partially paid", "Disputed", "Paid"] as BillFilter[]).map((option) => (
                  <button key={option} role="tab" aria-selected={filter === option} className={`filter-tab ${filter === option ? "selected" : ""}`} onClick={() => setFilter(option)}>{option}<span>{option === "All bills" ? bills.length : bills.filter((bill) => matchesBillFilter(bill, option)).length}</span></button>
                ))}
              </div>
              <label className="search-box"><span aria-hidden="true">⌕</span><input type="search" placeholder="Search bills" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search bills" /><kbd>⌘ K</kbd></label>
            </div>

            <div className="table-wrap">
              <table>
                <thead><tr><th>Customer</th><th>Invoice</th><th>Due date</th><th>Status</th><th className="amount-heading">Invoice / remaining</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {visibleBills.map((bill, index) => (
                    <tr key={bill.id} style={{ animationDelay: `${index * 45}ms` }}>
                      <td><div className="customer-cell"><span className={`customer-avatar avatar-${avatarSeed(bill.id)}`}>{initials(bill.customer)}</span><strong>{bill.customer}</strong></div></td>
                      <td className="invoice-cell">{bill.invoice}</td>
                      <td className="due-cell">{bill.due}</td>
                      <td><span className={`status-pill status-${bill.status.toLowerCase().replace(" ", "-")}`}><i />{bill.status}</span></td>
                      <td className="amount-cell">{formatCurrency(bill.amount)}<small>{formatCurrency(bill.balanceDue)} remaining</small></td>
                      <td className="action-cell">{bill.isDemo && bill.status !== "Paid" && <button className="row-action" onClick={() => markPaid(bill.id)} aria-label={`Mark ${bill.invoice} as paid`}>Mark paid</button>}</td>
                    </tr>
                  ))}
                  {visibleBills.length === 0 && <tr><td className="empty-state" colSpan={6}>No bills yet. Click &quot;Create batch&quot; above to start your live approval flow.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="table-footer"><span>Showing {visibleBills.length} of {bills.length} bills</span><span>Amounts shown in INR <b>·</b> Demo data</span></div>
          </section>
          <section className="bills-section batches-section" id="batches">
            <div className="section-heading">
              <div>
                <p className="eyebrow">WORKFLOW & AUDIT TRAIL</p>
                <h2>Approval batches <span className="section-total">{liveBatches.length}</span></h2>
              </div>
            </div>

            <div className="table-toolbar">
              <div className="filter-tabs" role="tablist" aria-label="Filter batches">
                {(["ALL", "IN_PROGRESS", "READY_FOR_PAYMENT", "COMPLETED"] as const).map((opt) => {
                  const label = opt === "ALL" ? "All batches" : opt === "IN_PROGRESS" ? "In progress" : opt === "READY_FOR_PAYMENT" ? "Ready for payment" : "Completed";
                  const count = opt === "ALL" ? liveBatches.length : liveBatches.filter((b) => b.status === opt).length;
                  return (
                    <button
                      key={opt}
                      role="tab"
                      aria-selected={batchFilter === opt}
                      className={`filter-tab ${batchFilter === opt ? "selected" : ""}`}
                      onClick={() => setBatchFilter(opt)}
                    >
                      {label}
                      <span>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Batch ID</th>
                    <th>Workflow</th>
                    <th>Status</th>
                    <th>Bills count</th>
                    <th className="amount-heading">Total amount</th>
                    <th style={{ textAlign: "right" }}>Audit trail</th>
                  </tr>
                </thead>
                <tbody>
                  {liveBatches
                    .filter((batch) => batchFilter === "ALL" || batch.status === batchFilter)
                    .map((batch) => {
                      const totalBatchAmount = (batch.bills ?? []).reduce(
                        (sum, bill) => sum + Number(bill.amount ?? 0),
                        0,
                      );
                      const totalRemaining = (batch.bills ?? []).reduce(
                        (sum, bill) => sum + Number(bill.balanceDue ?? 0),
                        0,
                      );
                      const activeStep = batch.stepInstances?.find((s) => s.status === "ALERTED");
                      return (
                        <tr key={batch.id}>
                          <td><strong>Batch {batch.id.slice(0, 8)}</strong></td>
                          <td>
                            <span>Stage {activeStep?.stage?.order ?? batch.stepInstances?.length ?? 1} · {activeStep?.stage?.contact?.name ?? "Completed"}</span>
                          </td>
                          <td>
                            <span className={`status-pill status-${batch.status?.toLowerCase().replace(/_/g, "-") ?? "in-progress"}`}>
                              <i />
                              {batch.status ?? "IN_PROGRESS"}
                            </span>
                          </td>
                          <td>{(batch.bills ?? []).length} bill(s)</td>
                          <td className="amount-cell">
                            {formatCurrency(totalBatchAmount)}
                            <small>{formatCurrency(totalRemaining)} remaining</small>
                          </td>
                          <td className="action-cell" style={{ textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: 8, alignItems: "center", justifyContent: "flex-end" }}>
                              <button
                                className="secondary-button"
                                type="button"
                                onClick={() => void openBatchHistory(batch.id)}
                              >
                                Audit trail & details →
                              </button>
                              {currentUser?.role?.toLowerCase() === "admin" && (
                                <button
                                  className="secondary-button"
                                  type="button"
                                  style={{ borderColor: "#fecaca", color: "#be123c", background: "#fff1f2", padding: "0 10px", fontSize: 11 }}
                                  onClick={() => void deleteBatch(batch.id)}
                                  title="Delete this batch and all its bills"
                                >
                                  🗑️ Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  {liveBatches.length === 0 && (
                    <tr>
                      <td className="empty-state" colSpan={6}>No batches created yet. Create a batch above to start the approval flow.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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

      {batchDialogOpen && <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isCreatingBatch) setBatchDialogOpen(false); }}>
        <section className="bill-dialog batch-dialog" role="dialog" aria-modal="true" aria-labelledby="batch-dialog-title">
          <div className="dialog-heading">
            <div>
              <p className="eyebrow">{liveWorkflow?.name ?? "WORKFLOW"}</p>
              <h2 id="batch-dialog-title">Create approval batch</h2>
              {(() => {
                const stageContactId = liveWorkflow?.stages?.[0]?.contact?.id;
                const freshContact = contacts.find((c) => c.id === stageContactId) ?? liveWorkflow?.stages?.[0]?.contact;
                const contactName = freshContact?.name ?? "Demo Approver";
                const contactEmail = freshContact?.email ?? "christyjenisha12@gmail.com";
                return (
                  <div style={{ marginTop: 8, padding: "8px 12px", background: "#f0f7f2", borderRadius: 6, border: "1px solid #d2e7d7", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, color: "#486252" }}>📧 Magic Link will be sent to:</span>
                    <strong style={{ fontSize: 13, color: "var(--forest)" }}>{contactName} ({contactEmail})</strong>
                  </div>
                );
              })()}
            </div>
            <button className="dialog-close" type="button" onClick={() => setBatchDialogOpen(false)} disabled={isCreatingBatch} aria-label="Close dialog">×</button>
          </div>
          <p className="dialog-description">Add one or more bills. The first approver will be notified after the batch is saved.</p>
          <form onSubmit={createBatch}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label style={{ color: "#536159", fontSize: 11, fontWeight: 650 }}>
                  Select Workflow & Approver Chain
                </label>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    style={{ fontSize: 11, color: "var(--forest)", textDecoration: "underline", cursor: "pointer", background: "none", border: "none", padding: 0 }}
                    onClick={() => { setBatchDialogOpen(false); void openWorkflowsDialog(); }}
                  >
                    ⚙️ Manage Workflows
                  </button>
                  <button
                    type="button"
                    style={{ fontSize: 11, color: "var(--forest)", textDecoration: "underline", cursor: "pointer", background: "none", border: "none", padding: 0 }}
                    onClick={() => { setBatchDialogOpen(false); void openContactsDialog(); }}
                  >
                    👤 Add Contact
                  </button>
                </div>
              </div>
              <select
                value={selectedTemplateId}
                onChange={(e) => {
                  setSelectedTemplateId(e.target.value);
                  const found = workflows.find((w) => w.id === e.target.value);
                  if (found) setLiveWorkflow(found);
                }}
                style={{ width: "100%", height: 39, padding: "0 10px", border: "1px solid #dce4de", borderRadius: 4, background: "#fff", fontSize: 12, fontWeight: 500 }}
              >
                {workflows.map((wf) => {
                  const approverContact = contacts.find((c) => c.id === wf.stages?.[0]?.contact?.id) ?? wf.stages?.[0]?.contact;
                  return (
                    <option key={wf.id} value={wf.id}>
                      {wf.name} ({wf.stages?.length ?? 1} stage{(wf.stages?.length ?? 1) > 1 ? "s" : ""}) → 1st: {approverContact?.name ?? "Approver"} ({approverContact?.email ?? "Email"})
                    </option>
                  );
                })}
              </select>
              {liveWorkflow && (
                <div style={{ marginTop: 10, padding: "10px 12px", background: "#f8faf8", border: "1px solid #dce8db", borderRadius: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--forest)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>ACTIVE APPROVAL PIPELINE:</span>
                    <span style={{ fontWeight: 500, color: "#617367" }}>{liveWorkflow.name}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                    {liveWorkflow.stages?.map((stg, sIdx) => {
                      const freshC = contacts.find((c) => c.id === stg.contact?.id) ?? stg.contact;
                      const freshBackup = contacts.find((c) => c.id === stg.backupContact?.id) ?? stg.backupContact;
                      return (
                        <div key={stg.id || sIdx} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span className="stage-chip" style={{ background: sIdx === 0 ? "#e7f4eb" : "#f1f3f1", borderColor: sIdx === 0 ? "var(--forest)" : "#d5ded7" }}>
                            <strong>#{stg.order}</strong> {freshC?.name || "Approver"}
                            {freshBackup && <small style={{ color: "var(--muted)" }}> (Backup: {freshBackup.name})</small>}
                            <small style={{ color: "var(--green)" }}> {stg.reminderIntervalHours ?? 24}h</small>
                          </span>
                          {sIdx < (liveWorkflow.stages?.length ?? 0) - 1 && <span style={{ color: "var(--muted)", fontWeight: 700 }}>→</span>}
                        </div>
                      );
                    })}
                  </div>
                  {(() => {
                    const stage1 = liveWorkflow.stages?.[0];
                    const primaryContact = contacts.find((c) => c.id === stage1?.contact?.id) ?? stage1?.contact;
                    return (
                      <div style={{ fontSize: 12, color: "#324838", background: "#ebf6ee", padding: "6px 10px", borderRadius: 4, display: "flex", alignItems: "center", gap: 6 }}>
                        <span>📧</span>
                        <span>Magic link notification will be sent to: <strong>{primaryContact?.name ?? "Approver"} ({primaryContact?.email ?? "Email"})</strong></span>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
            {batchBills.map((bill, index) => (
              <div className="batch-bill-row" key={index}>
                <label>Bill number<input required value={bill.billNumber} onChange={(event) => setBatchBills((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, billNumber: event.target.value } : item))} placeholder="INV-2026-001" /></label>
                <label>Amount (INR)<input required min="0.01" step="0.01" type="number" inputMode="decimal" value={bill.amount} onChange={(event) => setBatchBills((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, amount: event.target.value } : item))} placeholder="0.00" /></label>
                <label>Due date<input type="date" value={bill.dueDate} onChange={(event) => setBatchBills((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, dueDate: event.target.value } : item))} /></label>
                <button className="remove-bill-button" type="button" disabled={batchBills.length === 1 || isCreatingBatch} onClick={() => setBatchBills((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove bill ${index + 1}`}>×</button>
              </div>
            ))}
            <button className="text-button add-bill-row" type="button" disabled={isCreatingBatch} onClick={() => setBatchBills((current) => [...current, emptyBatchBill()])}>＋ Add another bill</button>
            <div className="dialog-actions">
              <button className="secondary-button" type="button" disabled={isCreatingBatch} onClick={() => setBatchDialogOpen(false)}>Cancel</button>
              <button className="primary-button" type="submit" disabled={isCreatingBatch}>{isCreatingBatch ? "Creating..." : "Create batch"}</button>
            </div>
          </form>
        </section>
      </div>}

      {contactsDialogOpen && <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSavingContact) setContactsDialogOpen(false); }}>
        <section className="bill-dialog contacts-dialog" role="dialog" aria-modal="true" aria-labelledby="contacts-dialog-title">
          <div className="dialog-heading">
            <div><p className="eyebrow">{currentUser?.organizationId}</p><h2 id="contacts-dialog-title">Approver contacts</h2></div>
            <button className="dialog-close" type="button" onClick={() => setContactsDialogOpen(false)} disabled={isSavingContact} aria-label="Close dialog">×</button>
          </div>
          <div className="contacts-list">
            {contacts.map((contact) => (
              <div className="contact-row" key={contact.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
                  <strong>{contact.name}</strong>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ fontSize: 11, padding: "2px 10px", height: 26, background: "#f0f7f2", borderColor: "#cce5d4", color: "var(--forest)", fontWeight: 600 }}
                    onClick={() => {
                      setContactsDialogOpen(false);
                      setNewWorkflowStages([
                        { contactId: contact.id, backupContactId: "", reminderIntervalHours: 24, maxReminders: 3 },
                      ]);
                      setNewWorkflowName(`${contact.name.split(" ")[0]}'s Approval Flow`);
                      setWorkflowsDialogOpen(true);
                    }}
                    title={`Create a workflow template using ${contact.name}`}
                  >
                    ⚡ Build Workflow with {contact.name.split(" ")[0]}
                  </button>
                </div>
                <label>Email<input type="email" required value={contact.email} onChange={(event) => setContacts((current) => current.map((item) => item.id === contact.id ? { ...item, email: event.target.value } : item))} /></label>
                <div className="contact-edit-footer">
                  <label>Role<input value={contact.role} onChange={(event) => setContacts((current) => current.map((item) => item.id === contact.id ? { ...item, role: event.target.value } : item))} /></label>
                  <label className="contact-active"><input type="checkbox" checked={contact.isActive} onChange={(event) => setContacts((current) => current.map((item) => item.id === contact.id ? { ...item, isActive: event.target.checked } : item))} /> Active</label>
                  <button className="secondary-button" type="button" disabled={isSavingContact} onClick={() => void saveContact(contact)}>Save</button>
                </div>
              </div>
            ))}
          </div>
          <form className="contact-create-form" onSubmit={createContact}>
            <p className="section-kicker">ADD CONTACT</p>
            <div className="contact-new-fields">
              <label>Name<input required maxLength={120} value={contactDraft.name} onChange={(event) => setContactDraft({ ...contactDraft, name: event.target.value })} /></label>
              <label>Email<input type="email" required value={contactDraft.email} onChange={(event) => setContactDraft({ ...contactDraft, email: event.target.value })} /></label>
              <label>Role<input required maxLength={80} value={contactDraft.role} onChange={(event) => setContactDraft({ ...contactDraft, role: event.target.value })} /></label>
            </div>
            <div className="dialog-actions">
              <button className="secondary-button" type="button" disabled={isSavingContact} onClick={() => setContactsDialogOpen(false)}>Close</button>
              <button className="primary-button" type="submit" disabled={isSavingContact}>{isSavingContact ? "Saving..." : "Add contact"}</button>
            </div>
          </form>
        </section>
      </div>}

      {paymentEntryOpen && <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSavingPayment) setPaymentEntryOpen(false); }}>
        <section className="bill-dialog payment-dialog" role="dialog" aria-modal="true" aria-labelledby="payment-dialog-title">
          <div className="dialog-heading">
            <div><p className="eyebrow">BATCH {paymentBatch?.id}</p><h2 id="payment-dialog-title">{onAccountPaymentId ? "Allocate on-account payment" : isOnAccountEntry ? "Record on-account payment" : "Allocate payment"}</h2></div>
            <button className="dialog-close" type="button" disabled={isSavingPayment} onClick={() => setPaymentEntryOpen(false)} aria-label="Close dialog">×</button>
          </div>
          <p className="dialog-description">{isOnAccountEntry ? "Record the received amount now and assign it to bills later." : onAccountPaymentId ? "Apply the remaining on-account balance to bills. Cash plus deductions cannot exceed that balance." : "Allocate cash by bill. Deductions also reduce bill balances and count toward the settlement total."}</p>
          <form onSubmit={createPayment}>
            {isOnAccountEntry ? (
              <label className="on-account-amount">Amount received<input type="number" min="0.01" step="0.01" required inputMode="decimal" value={onAccountAmount} onChange={(event) => setOnAccountAmount(event.target.value)} placeholder="0.00" /></label>
            ) : (
              <>
                {onAccountPaymentId && <div className="on-account-available">Available to allocate <strong>{formatExactCurrency(Number(paymentRecords[paymentBatch?.id ?? ""]?.find((payment) => payment.id === onAccountPaymentId)?.unallocatedAmount ?? 0))}</strong></div>}
                <div className="payment-allocation-list">
                  {paymentLines.map((line, index) => (
                    <div className="payment-allocation-row" key={line.billId}>
                      <div className="payment-bill-summary"><strong>{line.billNumber}</strong><span>{formatExactCurrency(line.balanceDue)} remaining</span></div>
                      <label>Cash applied<input type="number" min="0" max={line.balanceDue} step="0.01" inputMode="decimal" value={line.amount} onChange={(event) => setPaymentLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, amount: event.target.value } : item))} placeholder="0.00" /></label>
                      <label>Deduction<input type="number" min="0" max={line.balanceDue} step="0.01" inputMode="decimal" value={line.deductionAmount} onChange={(event) => setPaymentLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, deductionAmount: event.target.value } : item))} placeholder="0.00" /></label>
                      <label>Type<select value={line.deductionType} onChange={(event) => setPaymentLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, deductionType: event.target.value } : item))}>
                        <option value="">None</option><option value="TDS">TDS</option><option value="RETENTION">Retention</option><option value="PENALTY">Penalty</option><option value="OTHER">Other</option>
                      </select></label>
                    </div>
                  ))}
                </div>
              </>
            )}
            {!onAccountPaymentId && <div className="payment-metadata">
              <label>Payment date<input type="date" required value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} /></label>
              <label>Reference / UTR<input maxLength={200} value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Optional" /></label>
            </div>}
            {!isOnAccountEntry && <div className="payment-total"><span>{onAccountPaymentId ? "Amount allocated" : "Settlement total"}</span><strong>{formatExactCurrency(paymentLines.reduce((sum, line) => sum + Number(line.amount || 0) + Number(line.deductionAmount || 0), 0))}</strong></div>}
            <div className="dialog-actions">
              <button className="secondary-button" type="button" disabled={isSavingPayment} onClick={() => setPaymentEntryOpen(false)}>Cancel</button>
              <button className="primary-button" type="submit" disabled={isSavingPayment}>{isSavingPayment ? "Saving..." : isOnAccountEntry ? "Record on account" : onAccountPaymentId ? "Allocate funds" : "Save allocations"}</button>
            </div>
          </form>
        </section>
      </div>}

      {workflowsDialogOpen && (
        <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !isSavingWorkflow) setWorkflowsDialogOpen(false); }}>
          <section className="bill-dialog workflows-dialog" role="dialog" aria-modal="true" aria-labelledby="wf-dialog-title">
            <div className="dialog-heading">
              <div>
                <p className="eyebrow">ADMINISTRATION</p>
                <h2 id="wf-dialog-title">Workflow Templates</h2>
              </div>
              <button className="dialog-close" type="button" disabled={isSavingWorkflow} onClick={() => setWorkflowsDialogOpen(false)} aria-label="Close dialog">×</button>
            </div>
            <p className="dialog-description">Configure sequential multi-stage approval templates with primary approvers, backup contacts, and reminder rules.</p>

            <div className="workflow-templates-list">
              {workflows.map((wf) => (
                <div className="workflow-template-card" key={wf.id}>
                  <div className="workflow-template-head">
                    <div>
                      <strong>{wf.name}</strong>
                      <span style={{ marginLeft: 8, fontSize: 11, color: "var(--muted)" }}>({wf.stages.length} stage{wf.stages.length === 1 ? "" : "s"})</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button
                        className="primary-button"
                        type="button"
                        style={{ fontSize: 11, padding: "3px 10px", height: 28 }}
                        onClick={() => {
                          setSelectedTemplateId(wf.id);
                          setLiveWorkflow(wf);
                          setWorkflowsDialogOpen(false);
                          setBatchDialogOpen(true);
                        }}
                        title="Create a new approval batch using this workflow"
                      >
                        ＋ Create Batch with this Workflow
                      </button>
                      {(!wf._count || wf._count.batches === 0) && (
                        <button
                          className="secondary-button"
                          type="button"
                          style={{ fontSize: 11, padding: "3px 8px", height: 28, color: "var(--red)", borderColor: "#eec8c5" }}
                          onClick={() => void deleteWorkflow(wf.id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="workflow-stages-preview">
                    {wf.stages.map((stg, sIndex) => (
                      <span key={stg.id || sIndex} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span className="stage-chip">
                          <strong>#{stg.order}</strong> {stg.contact?.name || "Approver"}
                          {stg.backupContact && <small style={{ color: "var(--muted)" }}>({stg.backupContact.name})</small>}
                          <small style={{ color: "var(--green)" }}>{stg.reminderIntervalHours ?? 24}h</small>
                        </span>
                        {sIndex < wf.stages.length - 1 && <span className="stage-chip-arrow">→</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {workflows.length === 0 && <p className="empty-state">No workflow templates found.</p>}
            </div>

            <form className="contact-create-form" onSubmit={createWorkflow}>
              <p className="section-kicker">CREATE NEW WORKFLOW TEMPLATE</p>
              <label style={{ display: "grid", gap: 5, fontSize: 11, fontWeight: 600, color: "#536159", marginBottom: 12 }}>
                Template Name
                <input
                  required
                  placeholder="e.g. Standard 2-Stage Approval, Fast-Track Flow"
                  value={newWorkflowName}
                  onChange={(e) => setNewWorkflowName(e.target.value)}
                  style={{ height: 38, padding: "0 10px", border: "1px solid #dce4de", borderRadius: 4 }}
                />
              </label>

              <div className="section-kicker" style={{ marginTop: 14 }}>SEQUENTIAL APPROVAL STAGES</div>
              <div className="stage-builder-list">
                {newWorkflowStages.map((stage, idx) => (
                  <div className="stage-builder-row" key={idx}>
                    <div className="stage-num-badge">{idx + 1}</div>
                    <label>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                        <span>Primary Approver</span>
                        <button
                          type="button"
                          style={{ fontSize: 11, color: "var(--forest)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}
                          onClick={() => {
                            setWorkflowsDialogOpen(false);
                            void openContactsDialog();
                          }}
                        >
                          ＋ New Contact
                        </button>
                      </div>
                      <select
                        required
                        value={stage.contactId}
                        onChange={(e) =>
                          setNewWorkflowStages((curr) =>
                            curr.map((item, itemIdx) => (itemIdx === idx ? { ...item, contactId: e.target.value } : item)),
                          )
                        }
                      >
                        <option value="">Select contact...</option>
                        {contacts.filter((c) => c.isActive).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.email})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Backup Approver (Optional)
                      <select
                        value={stage.backupContactId}
                        onChange={(e) =>
                          setNewWorkflowStages((curr) =>
                            curr.map((item, itemIdx) => (itemIdx === idx ? { ...item, backupContactId: e.target.value } : item)),
                          )
                        }
                      >
                        <option value="">None</option>
                        {contacts
                          .filter((c) => c.isActive && c.id !== stage.contactId)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.email})
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Interval (Hours)
                      <input
                        type="number"
                        min="1"
                        max="720"
                        value={stage.reminderIntervalHours}
                        onChange={(e) =>
                          setNewWorkflowStages((curr) =>
                            curr.map((item, itemIdx) => (itemIdx === idx ? { ...item, reminderIntervalHours: Number(e.target.value) } : item)),
                          )
                        }
                      />
                    </label>
                    <label>
                      Max Tries
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={stage.maxReminders}
                        onChange={(e) =>
                          setNewWorkflowStages((curr) =>
                            curr.map((item, itemIdx) => (itemIdx === idx ? { ...item, maxReminders: Number(e.target.value) } : item)),
                          )
                        }
                      />
                    </label>
                    <button
                      className="remove-bill-button"
                      type="button"
                      disabled={newWorkflowStages.length === 1}
                      onClick={() => setNewWorkflowStages((curr) => curr.filter((_, itemIdx) => itemIdx !== idx))}
                      aria-label="Remove stage"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <button
                className="text-button"
                type="button"
                onClick={() =>
                  setNewWorkflowStages((curr) => [
                    ...curr,
                    { contactId: "", backupContactId: "", reminderIntervalHours: 24, maxReminders: 3 },
                  ])
                }
                style={{ marginBottom: 16 }}
              >
                ＋ Add next approval stage
              </button>

              <div className="dialog-actions">
                <button className="secondary-button" type="button" disabled={isSavingWorkflow} onClick={() => setWorkflowsDialogOpen(false)}>Cancel</button>
                <button className="primary-button" type="submit" disabled={isSavingWorkflow}>{isSavingWorkflow ? "Saving..." : "Save Template"}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {batchHistoryDialogOpen && (
        <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setBatchHistoryDialogOpen(false); }}>
          <section className="bill-dialog batch-history-dialog" role="dialog" aria-modal="true" aria-labelledby="history-dialog-title">
            <div className="dialog-heading">
              <div>
                <p className="eyebrow">AUDIT TRAIL & LIFECYCLE</p>
                <h2 id="history-dialog-title">Batch {selectedBatchHistory?.id.slice(0, 8)} Details</h2>
              </div>
              <button className="dialog-close" type="button" onClick={() => setBatchHistoryDialogOpen(false)} aria-label="Close dialog">×</button>
            </div>

            {isLoadingBatchHistory ? (
              <p className="approval-loading">Loading batch audit records and history...</p>
            ) : selectedBatchHistory ? (
              <>
                <div className="history-overview-grid">
                  <div className="history-overview-box">
                    <small>Status</small>
                    <strong>
                      <span className={`status-pill status-${selectedBatchHistory.status?.toLowerCase().replace(/_/g, "-") ?? "in-progress"}`}>
                        <i />
                        {selectedBatchHistory.status}
                      </span>
                    </strong>
                  </div>
                  <div className="history-overview-box">
                    <small>Template</small>
                    <strong>{selectedBatchHistory.template?.name || "Standard Workflow"}</strong>
                  </div>
                  <div className="history-overview-box">
                    <small>Bills Total</small>
                    <strong>
                      {formatCurrency(
                        (selectedBatchHistory.bills ?? []).reduce((sum, b) => sum + Number(b.amount ?? 0), 0),
                      )}
                    </strong>
                  </div>
                  <div className="history-overview-box">
                    <small>Created</small>
                    <strong>
                      {selectedBatchHistory.createdAt
                        ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(selectedBatchHistory.createdAt))
                        : "Recent"}
                    </strong>
                  </div>
                </div>

                <div className="history-tabs">
                  <button className={`history-tab ${historyTab === "stages" ? "active" : ""}`} onClick={() => setHistoryTab("stages")}>
                    Stages ({selectedBatchHistory.stepInstances?.length ?? 0})
                  </button>
                  <button className={`history-tab ${historyTab === "bills" ? "active" : ""}`} onClick={() => setHistoryTab("bills")}>
                    Bills ({selectedBatchHistory.bills?.length ?? 0})
                  </button>
                  <button className={`history-tab ${historyTab === "audit" ? "active" : ""}`} onClick={() => setHistoryTab("audit")}>
                    Audit Trail ({selectedBatchHistory.auditLogs?.length ?? 0})
                  </button>
                  <button className={`history-tab ${historyTab === "notifications" ? "active" : ""}`} onClick={() => setHistoryTab("notifications")}>
                    Email Log ({selectedBatchHistory.notifications?.length ?? 0})
                  </button>
                </div>

                {historyTab === "stages" && (
                  <div className="timeline-stages">
                    {(selectedBatchHistory.stepInstances ?? []).map((step) => {
                      const isDone = step.status === "COMPLETED";
                      const isAlerted = step.status === "ALERTED";
                      const isReturned = step.status === "RETURNED";
                      return (
                        <div
                          key={step.id}
                          className={`timeline-stage-card ${isDone ? "completed" : isAlerted ? "alerted" : isReturned ? "returned" : ""}`}
                        >
                          <div className="timeline-stage-header">
                            <div>
                              <strong>Stage {step.stage?.order}: {step.stage?.contact?.name ?? "Approver"}</strong>
                              <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>
                                ({step.stage?.contact?.email})
                              </span>
                            </div>
                            <span className={`status-pill status-${step.status?.toLowerCase() ?? "pending"}`}>
                              <i />
                              {step.status}
                            </span>
                          </div>
                          {step.stage?.backupContact && (
                            <div style={{ fontSize: 11, color: "var(--muted)" }}>
                              Backup Approver: {step.stage.backupContact.name} ({step.stage.backupContact.email})
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {historyTab === "bills" && (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Bill Number</th>
                          <th>Due Date</th>
                          <th>Status</th>
                          <th className="amount-heading">Amount / Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedBatchHistory.bills ?? []).map((bill) => (
                          <tr key={bill.id ?? bill.billNumber}>
                            <td><strong>{bill.billNumber}</strong></td>
                            <td>{bill.dueDate ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(bill.dueDate)) : "—"}</td>
                            <td><span className={`status-pill status-${bill.status?.toLowerCase() ?? "pending"}`}><i />{bill.status}</span></td>
                            <td className="amount-cell">
                              {formatCurrency(Number(bill.amount ?? 0))}
                              <small>{formatCurrency(Number(bill.balanceDue ?? 0))} remaining</small>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {historyTab === "audit" && (
                  <div className="audit-list">
                    {(selectedBatchHistory.auditLogs ?? []).map((log) => (
                      <div className="audit-entry" key={log.id}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span className="status-pill status-ready-for-payment">{log.action}</span>
                            <span className="audit-entry-actor">{log.actor}</span>
                          </div>
                          {log.detail && (
                            <div className="audit-entry-detail">
                              {typeof log.detail === "object" ? JSON.stringify(log.detail) : String(log.detail)}
                            </div>
                          )}
                        </div>
                        <div className="audit-entry-time">
                          {new Intl.DateTimeFormat("en-IN", {
                            dateStyle: "short",
                            timeStyle: "medium",
                          }).format(new Date(log.createdAt))}
                        </div>
                      </div>
                    ))}
                    {(selectedBatchHistory.auditLogs?.length ?? 0) === 0 && (
                      <p className="empty-state">No audit logs recorded for this batch yet.</p>
                    )}
                  </div>
                )}

                {historyTab === "notifications" && (
                  <div className="notif-list">
                    {(selectedBatchHistory.notifications ?? []).map((notif) => (
                      <div className="notif-item" key={notif.id}>
                        <div>
                          <strong>{notif.recipient}</strong>
                          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                            {notif.sentAt ? `Sent at ${new Intl.DateTimeFormat("en-IN", { dateStyle: "short", timeStyle: "medium" }).format(new Date(notif.sentAt))}` : "Pending delivery"}
                            {notif.error && <span style={{ color: "var(--red)", marginLeft: 6 }}>Error: {notif.error}</span>}
                          </div>
                        </div>
                        <span className={`status-pill status-${notif.status.toLowerCase()}`}>
                          <i />
                          {notif.status}
                        </span>
                      </div>
                    ))}
                    {(selectedBatchHistory.notifications?.length ?? 0) === 0 && (
                      <p className="empty-state">No email notifications recorded for this batch yet.</p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="approval-error">Batch details could not be found.</p>
            )}

            <div className="dialog-actions" style={{ marginTop: 20 }}>
              <button className="primary-button" type="button" onClick={() => setBatchHistoryDialogOpen(false)}>Close</button>
            </div>
          </section>
        </div>
      )}
          {reassignModalOpen && reassignTarget && (
        <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setReassignModalOpen(false); }}>
          <section className="bill-dialog" role="dialog" aria-modal="true" aria-labelledby="reassign-dialog-title" style={{ maxWidth: 480 }}>
            <div className="dialog-heading">
              <div>
                <p className="eyebrow">ADMIN ACTION · STAGE REASSIGNMENT</p>
                <h2 id="reassign-dialog-title">Reassign Workflow Step</h2>
              </div>
              <button className="dialog-close" type="button" onClick={() => setReassignModalOpen(false)} aria-label="Close dialog">×</button>
            </div>
            <p style={{ fontSize: "0.88rem", color: "#64748b", margin: "0 0 16px 0" }}>
              Reassign active step for Batch <strong>{reassignTarget.batchId.slice(0, 8)}</strong> from {reassignTarget.currentContactName || "current approver"} to another active organization contact.
            </p>

            <form onSubmit={(e) => { e.preventDefault(); void submitReassignStep(); }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#334155" }}>
                    Select Replacement Approver <span style={{ color: "#e11d48" }}>*</span>
                  </label>
                  <button
                    type="button"
                    className="text-button"
                    style={{ fontSize: "0.8rem" }}
                    onClick={() => {
                      setReassignModalOpen(false);
                      setContactsDialogOpen(true);
                    }}
                  >
                    ＋ New Contact
                  </button>
                </div>
                <select
                  value={reassignNewContactId}
                  onChange={(e) => setReassignNewContactId(e.target.value)}
                  required
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: "0.95rem" }}
                >
                  <option value="">-- Choose active contact --</option>
                  {contacts.filter((c) => c.isActive).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.email} ({c.role})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  Reason Note (Optional, audit logged)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Primary approver on leave; reassigned per email request"
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1" }}
                />
              </div>

              <div className="dialog-actions">
                <button className="secondary-button" type="button" disabled={isSubmittingReassign} onClick={() => setReassignModalOpen(false)}>
                  Cancel
                </button>
                <button className="primary-button" type="submit" disabled={isSubmittingReassign || !reassignNewContactId}>
                  {isSubmittingReassign ? "Reassigning..." : "Confirm Reassignment"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

    </main>
  );
}
