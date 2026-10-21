"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Plus,
  Users,
  Workflow as WorkflowIcon,
  Layers,
  Info,
  LayoutGrid,
  GitBranch,
  CreditCard,
  FileSpreadsheet,
  History,
  ChevronDown,
  Settings,
  FileText,
} from "lucide-react";

// Types
import {
  AppUser,
  BatchBillDraft,
  BatchHistoryRecord,
  BatchRecord,
  Bill,
  BillFilter,
  ContactRecord,
  PaymentLineDraft,
  PaymentRecord,
  WorkflowRecord,
} from "../types";

// Utils
import {
  emptyBatchBill,
  formatCurrency,
  formatExactCurrency,
  getAgingStatus,
  matchesBillFilter,
  toDisplayBills,
  toBillStatus,
} from "../lib/utils";

// API
import {
  getApiBase,
  loginApi,
  authFetch,
  fetchDashboardData,
  fetchPaymentsForBatch,
  fetchBatchHistory,
} from "../lib/api";

// Layout & Dashboard Components
import { Sidebar } from "../components/layout/Sidebar";
import { Topbar } from "../components/layout/Topbar";
import { RoleSwitcher } from "../components/layout/RoleSwitcher";
import { MetricsGrid } from "../components/dashboard/MetricsGrid";
import { CollectionPulse } from "../components/dashboard/CollectionPulse";
import { CurrentlyWithBoard } from "../components/dashboard/CurrentlyWithBoard";
import { CompactPipelineSection } from "../components/dashboard/CompactPipelineSection";
import { SettlementsHub } from "../components/dashboard/SettlementsHub";

// Tables
import { BillsTable } from "../components/tables/BillsTable";
import { BatchesTable } from "../components/tables/BatchesTable";

// Modals
import { AddDemoBillModal } from "../components/modals/AddDemoBillModal";
import { CreateBatchModal } from "../components/modals/CreateBatchModal";
import { SubmitIndividualBillModal } from "../components/modals/SubmitIndividualBillModal";
import { WorkflowNextStepsModal } from "../components/modals/WorkflowNextStepsModal";
import { WorkflowLifecycleBar } from "../components/dashboard/WorkflowLifecycleBar";
import { ContactsModal } from "../components/modals/ContactsModal";
import { PaymentEntryModal } from "../components/modals/PaymentEntryModal";
import { WorkflowBuilderModal } from "../components/modals/WorkflowBuilderModal";
import { BatchHistoryDrawer } from "../components/modals/BatchHistoryDrawer";
import { ReassignApproverModal } from "../components/modals/ReassignApproverModal";

export default function Home() {
  // Navigation & Data
  const [activeNavTab, setActiveNavTab] = useState("overview");
  const [viewFilter, setViewFilter] = useState<"all" | "pipeline" | "settlements" | "bills" | "batches">("all");
  const [bills, setBills] = useState<Bill[]>([]);
  const [filter, setFilter] = useState<BillFilter>("All bills");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [currentDateTime, setCurrentDateTime] = useState("");
  const [apiStatus, setApiStatus] = useState<"loading" | "connected" | "offline">("loading");

  // Auth & Roles
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Workflows & Batches
  const [liveBatches, setLiveBatches] = useState<BatchRecord[]>([]);
  const [liveWorkflow, setLiveWorkflow] = useState<WorkflowRecord | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([]);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [batchFilter, setBatchFilter] = useState<"ALL" | "IN_PROGRESS" | "READY_FOR_PAYMENT" | "COMPLETED">("ALL");

  // Approval Action State
  const [approvalComment, setApprovalComment] = useState("");
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);

  // Dialog Visibility States
  const [dialogOpen, setDialogOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [individualBillModalOpen, setIndividualBillModalOpen] = useState(false);
  const [nextStepsModalOpen, setNextStepsModalOpen] = useState(false);
  const [lastSubmittedBatch, setLastSubmittedBatch] = useState<BatchRecord | null>(null);
  const [lastSubmittedBillNumber, setLastSubmittedBillNumber] = useState("");
  const [lastSubmittedAmount, setLastSubmittedAmount] = useState<number>(0);
  const [isSubmittingSingleBill, setIsSubmittingSingleBill] = useState(false);
  const [contactsDialogOpen, setContactsDialogOpen] = useState(false);
  const [workflowsDialogOpen, setWorkflowsDialogOpen] = useState(false);
  const [batchHistoryDialogOpen, setBatchHistoryDialogOpen] = useState(false);
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [paymentEntryOpen, setPaymentEntryOpen] = useState(false);

  // Dropdown States
  const [submissionMenuOpen, setSubmissionMenuOpen] = useState(false);
  const [manageMenuOpen, setManageMenuOpen] = useState(false);
  const submissionMenuRef = useRef<HTMLDivElement>(null);
  const manageMenuRef = useRef<HTMLDivElement>(null);

  // Form Drafts
  const [draft, setDraft] = useState({ customer: "", invoice: "", amount: "", due: "" });
  const [batchBills, setBatchBills] = useState<BatchBillDraft[]>([emptyBatchBill()]);
  const [contactDraft, setContactDraft] = useState({ name: "", email: "", role: "Approver" });
  const [newWorkflowName, setNewWorkflowName] = useState("");
  const [newWorkflowStages, setNewWorkflowStages] = useState<
    Array<{ contactId: string; backupContactId: string; reminderIntervalHours: number; maxReminders: number }>
  >([{ contactId: "", backupContactId: "", reminderIntervalHours: 24, maxReminders: 3 }]);

  // Payment & Proof State
  const [paymentBatch, setPaymentBatch] = useState<BatchRecord | null>(null);
  const [paymentLines, setPaymentLines] = useState<PaymentLineDraft[]>([]);
  const [paymentRecords, setPaymentRecords] = useState<Record<string, PaymentRecord[]>>({});
  const [proofLinks, setProofLinks] = useState<Record<string, string>>({});
  const [isUploadingProofFor, setIsUploadingProofFor] = useState<string | null>(null);
  const [onAccountPaymentId, setOnAccountPaymentId] = useState<string | null>(null);
  const [isOnAccountEntry, setIsOnAccountEntry] = useState(false);
  const [onAccountAmount, setOnAccountAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));

  // Loading States
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [isSavingWorkflow, setIsSavingWorkflow] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [isLoadingBatchHistory, setIsLoadingBatchHistory] = useState(false);
  const [isSubmittingReassign, setIsSubmittingReassign] = useState(false);

  // Reassignment Target
  const [reassignTarget, setReassignTarget] = useState<{
    batchId: string;
    stepId: string;
    currentContactName?: string;
  } | null>(null);
  const [reassignNewContactId, setReassignNewContactId] = useState("");
  const [reassignReason, setReassignReason] = useState("");

  // Batch History Detail
  const [selectedBatchHistory, setSelectedBatchHistory] = useState<BatchHistoryRecord | null>(null);
  const [historyTab, setHistoryTab] = useState<"stages" | "bills" | "audit" | "notifications">("stages");

  const localProofUrls = useRef(new Set<string>());

  // Real-time clock in IST
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

  // Revoke object URLs on unmount
  useEffect(() => () => {
    for (const url of localProofUrls.current) URL.revokeObjectURL(url);
    localProofUrls.current.clear();
  }, []);

  // Close dropdown menus on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (submissionMenuRef.current && !submissionMenuRef.current.contains(e.target as Node)) {
        setSubmissionMenuOpen(false);
      }
      if (manageMenuRef.current && !manageMenuRef.current.contains(e.target as Node)) {
        setManageMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Authenticated login helper
  async function loginAs(email: string, password = "demo123"): Promise<string | null> {
    const result = await loginApi(email, password);
    if (!result) {
      setNotice("Sign-in failed. Please use a seeded demo user.");
      return null;
    }
    setCurrentUser(result.user);
    setAuthToken(result.token);
    window.localStorage.setItem("thoorigai-token", result.token);
    window.localStorage.setItem("thoorigai-user", JSON.stringify(result.user));
    setNotice(`Signed in as ${result.user.name} (${result.user.role}).`);
    return result.token;
  }

  function handleSignOut() {
    setCurrentUser(null);
    setAuthToken(null);
    window.localStorage.removeItem("thoorigai-token");
    window.localStorage.removeItem("thoorigai-user");
    setNotice("Signed out of current session.");
  }

  // Load Dashboard Data
  useEffect(() => {
    let isMounted = true;

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

      let [workflowRes, batchRes, contactsRes] = await fetchDashboardData(token);
      if (workflowRes.status === 401 || batchRes.status === 401) {
        window.localStorage.removeItem("thoorigai-token");
        window.localStorage.removeItem("thoorigai-user");
        token = await loginAs("admin@example.test", "demo123");
        if (!token) throw new Error("Authentication failed");
        [workflowRes, batchRes, contactsRes] = await fetchDashboardData(token);
      }

      if (!workflowRes.ok || !batchRes.ok) throw new Error("API request failed");
      const workflowData = (await workflowRes.json()) as WorkflowRecord[];
      const batchData = (await batchRes.json()) as BatchRecord[];

      const paymentEntries = await Promise.all(
        batchData.map(async (batch) => [
          batch.id,
          await fetchPaymentsForBatch(batch.id, token!),
        ] as const)
      );

      if (!isMounted) return;

      const derivedBills = toDisplayBills(batchData);
      setBills(derivedBills);

      if (contactsRes && contactsRes.ok) {
        const contactsData = (await contactsRes.json()) as ContactRecord[];
        setContacts(contactsData);
      }

      const safeWorkflows = Array.isArray(workflowData) ? workflowData : [];
      setWorkflows(safeWorkflows);
      setLiveWorkflow(safeWorkflows[0] ?? null);
      if (safeWorkflows[0]) setSelectedTemplateId(safeWorkflows[0].id);

      setLiveBatches(batchData);
      setPaymentRecords(Object.fromEntries(paymentEntries));
      setApiStatus("connected");
    };

    void loadDashboard().catch(() => {
      if (!isMounted) return;
      setBills([]);
      setLiveWorkflow(null);
      setLiveBatches([]);
      setPaymentRecords({});
      setApiStatus("offline");
    });

    return () => {
      isMounted = false;
    };
  }, []);

  async function refreshPaymentRecords(batches: BatchRecord[], token: string) {
    const entries = await Promise.all(
      batches.map(async (b) => [b.id, await fetchPaymentsForBatch(b.id, token)] as const)
    );
    setPaymentRecords(Object.fromEntries(entries));
  }

  // Workflows & Contacts Fetchers
  async function loadWorkflows(tokenOverride?: string) {
    const token = tokenOverride || authToken;
    if (!token || !currentUser) return;
    const apiBase = getApiBase();
    try {
      const response = await fetch(
        `${apiBase}/workflows?organizationId=${encodeURIComponent(currentUser.organizationId)}`,
        { cache: "no-store", headers: { Authorization: `Bearer ${token}` } }
      );
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
      await Promise.all([loadWorkflows(), fetchContacts()]);
      setWorkflowsDialogOpen(true);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not load workflows");
    }
  }

  async function fetchContacts(tokenOverride?: string): Promise<ContactRecord[]> {
    const token = tokenOverride || authToken;
    if (!token || !currentUser) return [];
    const apiBase = getApiBase();
    try {
      const response = await fetch(
        `${apiBase}/contacts?organizationId=${encodeURIComponent(currentUser.organizationId)}`,
        { cache: "no-store", headers: { Authorization: `Bearer ${token}` } }
      );
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
      const response = await fetch(
        `${apiBase}/contacts/${contact.id}?organizationId=${encodeURIComponent(currentUser.organizationId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({
            name: contact.name.trim(),
            email: contact.email.trim(),
            role: contact.role.trim(),
            isActive: contact.isActive,
          }),
        }
      );
      if (!response.ok) {
        const result = (await response.json()) as { message?: string };
        throw new Error(result.message || "Unable to update this contact.");
      }
      const updated = (await response.json()) as ContactRecord;
      setContacts((curr) => curr.map((c) => (c.id === updated.id ? updated : c)));
      if (authToken) void loadWorkflows(authToken);
      setNotice(`Contact "${updated.name}" updated successfully.`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unable to update this contact.";
      setNotice(msg);
      throw error;
    } finally {
      setIsSavingContact(false);
    }
  }

  async function deleteContact(contact: ContactRecord) {
    if (!currentUser || !authToken) return;
    const confirmMessage = `Are you sure you want to permanently delete contact "${contact.name || contact.email}"?`;
    if (!window.confirm(confirmMessage)) return;

    setIsSavingContact(true);
    const apiBase = getApiBase();
    try {
      const response = await fetch(
        `${apiBase}/contacts/${contact.id}?organizationId=${encodeURIComponent(currentUser.organizationId)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      if (!response.ok) {
        const result = (await response.json()) as { message?: string };
        throw new Error(result.message || "Unable to delete this contact.");
      }
      setContacts((curr) => curr.filter((c) => c.id !== contact.id));
      if (authToken) void loadWorkflows(authToken);
      setNotice(`Contact "${contact.name || contact.email}" deleted successfully.`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unable to delete this contact.";
      setNotice(msg);
      throw error;
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
      setContacts((curr) => [...curr, created].sort((a, b) => a.name.localeCompare(b.name)));
      setContactDraft({ name: "", email: "", role: "Approver" });
      setNotice("Contact added.");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unable to add this contact.";
      setNotice(msg);
      throw error;
    } finally {
      setIsSavingContact(false);
    }
  }

  // Workflows CRUD
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

  // Approval Actions (Approve & Return for Correction)
  const pendingApprovalBatches = liveBatches.flatMap((batch) => {
    if (batch.status !== "IN_PROGRESS") return [];
    const step = batch.stepInstances?.find((item) => item.status === "ALERTED");
    return step ? [{ batch, step }] : [];
  });

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

    const response = await authFetch(
      `${apiBase}/workflows/steps/${step.id}/${action}`,
      authToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actor,
          comment: action === "return" ? approvalComment.trim() || "Please provide the missing review details." : undefined,
        }),
      }
    );

    setIsSubmittingApproval(false);

    if (!response.ok) {
      setNotice(`Approval action failed (${response.status}).`);
      return;
    }

    setApprovalComment("");
    setNotice(
      action === "complete"
        ? "Approval recorded and the next stage has been advanced."
        : "The step was returned for correction. Notification dispatched."
    );

    const organizationId = currentUser?.organizationId ?? "demo-org";
    const batchResponse = await fetch(`${apiBase}/batches?organizationId=${encodeURIComponent(organizationId)}`, {
      cache: "no-store",
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    });
    if (batchResponse.ok) {
      const freshBatch = (await batchResponse.json()) as BatchRecord[];
      setBills(toDisplayBills(freshBatch));
      setLiveBatches(freshBatch);
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
      setNotice(`Opened signed magic link for ${data.approverEmail} in a new tab.`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not open approval link.");
    }
  }

  async function submitConfirmOnBehalf(batchId: string, stepInstanceId: string) {
    if (!authToken || !currentUser) return;
    setIsSubmittingApproval(true);
    const apiBase = getApiBase();
    try {
      const response = await fetch(
        `${apiBase}/batches/${encodeURIComponent(batchId)}/steps/${encodeURIComponent(stepInstanceId)}/confirm-on-behalf`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ note: approvalComment.trim() || undefined }),
        }
      );
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
        await refreshPaymentRecords(freshBatch, authToken);
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Confirmation failed.");
    } finally {
      setIsSubmittingApproval(false);
    }
  }

  // Reassignment
  async function submitReassignStep(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
        await refreshPaymentRecords(freshBatch, authToken);
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Reassignment failed.");
    } finally {
      setIsSubmittingReassign(false);
    }
  }

  // Individual Bill Operations (Direct Single Bill Approval without Batch)
  async function submitIndividualBill(data: { billNumber: string; amount: number; dueDate?: string }) {
    let currentToken = authToken;
    if (!currentToken && typeof window !== "undefined") {
      currentToken = window.localStorage.getItem("thoorigai-token");
    }
    if (!currentToken) {
      currentToken = await loginAs("admin@example.test", "demo123");
    }

    if (!currentToken || !liveWorkflow) {
      setNotice("Sign in and select a workflow before submitting a bill.");
      return;
    }

    setIsSubmittingSingleBill(true);
    const apiBase = getApiBase();
    const orgId = currentUser?.organizationId || "demo-org";
    try {
      const response = await authFetch(`${apiBase}/bills/submit`, currentToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          templateId: selectedTemplateId || liveWorkflow.id,
          billNumber: data.billNumber.trim(),
          amount: data.amount,
          ...(data.dueDate ? { dueDate: data.dueDate } : {}),
        }),
      });

      if (!response.ok) {
        // Fallback to /batches if needed
        const fallback = await authFetch(`${apiBase}/batches`, currentToken, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: orgId,
            templateId: selectedTemplateId || liveWorkflow.id,
            bills: [{ billNumber: data.billNumber.trim(), amount: data.amount, ...(data.dueDate ? { dueDate: data.dueDate } : {}) }],
          }),
        });
        if (!fallback.ok) {
          const err = (await fallback.json().catch(() => ({}))) as { message?: string | string[] };
          const msg = Array.isArray(err.message) ? err.message.join(" ") : err.message;
          throw new Error(msg || "Failed to submit individual bill.");
        }
      }

      const batchResponse = await fetch(`${apiBase}/batches?organizationId=${encodeURIComponent(orgId)}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      let createdBatch: BatchRecord | null = null;
      if (batchResponse.ok) {
        const batches = (await batchResponse.json()) as BatchRecord[];
        setBills(toDisplayBills(batches));
        setLiveBatches(batches);
        createdBatch = batches.find((b) => b.bills?.some((bl) => bl.billNumber === data.billNumber.trim())) ?? batches[0];
      }

      setIndividualBillModalOpen(false);
      setLastSubmittedBatch(createdBatch);
      setLastSubmittedBillNumber(data.billNumber);
      setLastSubmittedAmount(data.amount);
      setNextStepsModalOpen(true);
      setNotice(`Bill ${data.billNumber} submitted for approval. Magic link sent to approver.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Bill submission failed.");
    } finally {
      setIsSubmittingSingleBill(false);
    }
  }

  // Batch Operations
  async function createBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let currentToken = authToken;
    if (!currentToken && typeof window !== "undefined") {
      currentToken = window.localStorage.getItem("thoorigai-token");
    }
    if (!currentToken) {
      currentToken = await loginAs("admin@example.test", "demo123");
    }

    if (!currentToken || !liveWorkflow) {
      setNotice("Sign in and select a workflow before creating a batch.");
      return;
    }

    setIsCreatingBatch(true);
    const apiBase = getApiBase();
    const orgId = currentUser?.organizationId || "demo-org";
    try {
      const response = await authFetch(`${apiBase}/batches`, currentToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
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

      const batchResponse = await fetch(`${apiBase}/batches?organizationId=${encodeURIComponent(orgId)}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      let createdBatch: BatchRecord | null = null;
      if (batchResponse.ok) {
        const batches = (await batchResponse.json()) as BatchRecord[];
        setBills(toDisplayBills(batches));
        setLiveBatches(batches);
        createdBatch = batches[0] ?? null;
      }

      const totalBatchAmount = batchBills.reduce((s, b) => s + Number(b.amount || 0), 0);
      setBatchBills([emptyBatchBill()]);
      setBatchDialogOpen(false);
      setLastSubmittedBatch(createdBatch);
      setLastSubmittedBillNumber("");
      setLastSubmittedAmount(totalBatchAmount);
      setNextStepsModalOpen(true);
      setNotice("Batch created successfully. The initial approver notification was dispatched.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Batch creation failed.");
    } finally {
      setIsCreatingBatch(false);
    }
  }

  async function deleteBatch(batchId: string) {
    if (!currentUser || currentUser.role.toLowerCase() !== "admin") {
      setNotice("Only administrators can delete batches. Click 'Admin' under ACT AS ROLE at the top of the screen to switch to Admin.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this batch and its bills?")) {
      return;
    }
    const apiBase = getApiBase();
    try {
      const response = await authFetch(`${apiBase}/batches/${encodeURIComponent(batchId)}`, authToken, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message || "Failed to delete batch.");
      }
      const orgId = currentUser.organizationId || "demo-org";
      const bResp = await authFetch(`${apiBase}/batches?organizationId=${encodeURIComponent(orgId)}`, authToken, {
        cache: "no-store",
      });
      if (bResp.ok) {
        const updated = (await bResp.json()) as BatchRecord[];
        setBills(toDisplayBills(updated));
        setLiveBatches(updated);
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
    try {
      const data = await fetchBatchHistory(batchId, authToken);
      setSelectedBatchHistory(data);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "History fetch failed.");
    } finally {
      setIsLoadingBatchHistory(false);
    }
  }

  // Payments & Proofs
  function openPaymentEntry(batch: BatchRecord) {
    const bBills = batch.bills?.filter((bill): bill is typeof bill & { id: string } => Boolean(bill.id)) ?? [];
    if (bBills.length === 0) {
      setNotice("This batch has no bills available for allocation.");
      return;
    }
    setPaymentBatch(batch);
    setOnAccountPaymentId(null);
    setIsOnAccountEntry(false);
    setOnAccountAmount("");
    setPaymentLines(
      bBills
        .filter((bill) => Number(bill.balanceDue ?? bill.amount ?? 0) > 0)
        .map((bill) => ({
          billId: bill.id,
          billNumber: bill.billNumber ?? bill.id,
          balanceDue: Number(bill.balanceDue ?? bill.amount ?? 0),
          amount: "",
          deductionAmount: "",
          deductionType: "",
        }))
    );
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
    const bBills = batch.bills?.filter((bill): bill is typeof bill & { id: string } => Boolean(bill.id)) ?? [];
    setPaymentBatch(batch);
    setOnAccountPaymentId(payment.id);
    setIsOnAccountEntry(false);
    setOnAccountAmount("");
    setPaymentLines(
      bBills
        .filter((bill) => Number(bill.balanceDue ?? bill.amount ?? 0) > 0)
        .map((bill) => ({
          billId: bill.id,
          billNumber: bill.billNumber ?? bill.id,
          balanceDue: Number(bill.balanceDue ?? bill.amount ?? 0),
          amount: "",
          deductionAmount: "",
          deductionType: "",
        }))
    );
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
    if (
      allocations.some(
        (line) => Math.round((line.amount + line.deductionAmount) * 100) > Math.round(line.balanceDue * 100)
      )
    ) {
      setNotice("Cash plus deduction cannot exceed a bill's remaining balance.");
      return;
    }

    const allocatedTotalCents = allocations.reduce(
      (sum, line) => sum + Math.round(line.amount * 100) + Math.round(line.deductionAmount * 100),
      0
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

      const response = await fetch(
        onAccountPaymentId ? `${apiBase}/payments/${onAccountPaymentId}/allocations` : `${apiBase}/payments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
          body: JSON.stringify(
            onAccountPaymentId
              ? { allocations: allocationPayload }
              : {
                  batchId: paymentBatch.id,
                  amount: paymentTotalCents / 100,
                  paidAt: paymentDate,
                  reference: paymentReference.trim() || undefined,
                  ...(isOnAccountEntry ? {} : { allocations: allocationPayload }),
                }
          ),
        }
      );

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
        await refreshPaymentRecords(batches, authToken);
      }

      setPaymentEntryOpen(false);
      setPaymentBatch(null);
      setOnAccountPaymentId(null);
      setIsOnAccountEntry(false);
      setOnAccountAmount("");
      setNotice(
        isOnAccountEntry
          ? "Payment recorded on account."
          : onAccountPaymentId
          ? "On-account funds allocated."
          : "Payment and bill allocations recorded."
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Payment could not be recorded.");
    } finally {
      setIsSavingPayment(false);
    }
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
      setNotice(
        result.local
          ? "Local payment proof is ready to open."
          : "Secure payment proof link is ready. Open it within five minutes."
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not open the payment proof.");
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

  function markPaid(id: number | string) {
    setBills((current) =>
      current.map((bill) => (bill.id === id ? { ...bill, balanceDue: 0, status: "Paid" } : bill))
    );
    setNotice("Payment recorded in this demo session.");
  }

  function deleteBill(id: number | string) {
    if (!window.confirm("Are you sure you want to remove this bill from your receivables view?")) {
      return;
    }
    setBills((current) => current.filter((bill) => bill.id !== id && bill.invoice !== id));
    setNotice("Bill removed from your receivables view.");
  }

  // Metrics Calculations
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
      const pDate = new Date(payment.paidAt);
      return pDate.getFullYear() === currentMonth.getFullYear() && pDate.getMonth() === currentMonth.getMonth();
    })
    .reduce((sum, payment) => sum + Number(payment.amount), 0);

  const visibleBills = bills.filter((bill) => {
    const matchesF = matchesBillFilter(bill, filter);
    const matchesS = `${bill.customer} ${bill.invoice}`.toLowerCase().includes(search.toLowerCase());
    return matchesF && matchesS;
  });

  const inFlightCount = liveBatches.filter((b) => b.status === "IN_PROGRESS").length;
  const settlementsCount = liveBatches.filter((b) => b.status === "READY_FOR_PAYMENT").length;

  const handleNav = (tabId: string) => {
    setActiveNavTab(tabId);
    if (tabId === "overview") setViewFilter("all");
    else if (tabId === "pipeline") setViewFilter("pipeline");
    else if (tabId === "settlements") setViewFilter("settlements");
    else if (tabId === "bills") setViewFilter("bills");
    else if (tabId === "batches") setViewFilter("batches");

    const element = document.getElementById(tabId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <main className="app-shell">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeNavTab}
        billsCount={bills.length}
        batchesCount={liveBatches.length}
        inFlightCount={inFlightCount}
        settlementsCount={settlementsCount}
        currentUser={currentUser}
        onNavigate={handleNav}
      />

      <section className="main-panel" id="overview">
        {/* Top Header */}
        <Topbar
          currentDateTime={currentDateTime}
          apiStatus={apiStatus}
          activeTabTitle="Overview"
          notice={notice}
          onClearNotice={() => setNotice("")}
        />

        <div className="page-content">
          {/* Act as Demo Role Switcher */}
          <RoleSwitcher
            currentUser={currentUser}
            onLoginAs={loginAs}
            onSignOut={handleSignOut}
          />

          {/* Welcome & Action Controls */}
          <section className="welcome-row">
            <div>
              <p className="eyebrow">COLLECTIONS AT A GLANCE</p>
              <h1>
                Good morning, {currentUser ? currentUser.name.split(" ")[0] : "Admin"}
                <span>.</span>
              </h1>
              <p className="welcome-subtitle">Here is where your receivables and approval batches stand today.</p>
            </div>

            <div className="welcome-actions">
              {/* Dropdown 1: + New Submission */}
              <div className="action-dropdown-wrap" ref={submissionMenuRef}>
                <button
                  type="button"
                  className="dropdown-trigger-btn primary"
                  disabled={apiStatus !== "connected" || (!liveWorkflow && workflows.length === 0)}
                  onClick={() => {
                    setSubmissionMenuOpen(!submissionMenuOpen);
                    setManageMenuOpen(false);
                  }}
                  aria-expanded={submissionMenuOpen}
                  aria-haspopup="true"
                >
                  <Plus size={15} />
                  <span>New Submission</span>
                  <ChevronDown size={14} className={`dropdown-chevron ${submissionMenuOpen ? "open" : ""}`} />
                </button>

                {submissionMenuOpen && (
                  <div className="dropdown-menu-panel" role="menu">
                    <div className="dropdown-menu-header">
                      <span>CHOOSE SUBMISSION TYPE</span>
                    </div>

                    <button
                      type="button"
                      className="dropdown-menu-item highlighted"
                      role="menuitem"
                      onClick={() => {
                        setSubmissionMenuOpen(false);
                        setIndividualBillModalOpen(true);
                      }}
                    >
                      <div className="menu-item-icon green">
                        <FileText size={16} />
                      </div>
                      <div className="menu-item-copy">
                        <strong>Submit Individual Bill</strong>
                        <small>Direct single invoice approval without batching</small>
                      </div>
                    </button>

                    <button
                      type="button"
                      className="dropdown-menu-item"
                      role="menuitem"
                      onClick={() => {
                        setSubmissionMenuOpen(false);
                        setBatchDialogOpen(true);
                      }}
                    >
                      <div className="menu-item-icon blue">
                        <Layers size={16} />
                      </div>
                      <div className="menu-item-copy">
                        <strong>Create Multi-Bill Batch</strong>
                        <small>Group multiple invoices into one approval batch</small>
                      </div>
                    </button>

                    <div className="dropdown-menu-divider" />

                    <button
                      type="button"
                      className="dropdown-menu-item"
                      role="menuitem"
                      onClick={() => {
                        setSubmissionMenuOpen(false);
                        setDialogOpen(true);
                      }}
                    >
                      <div className="menu-item-icon slate">
                        <Plus size={16} />
                      </div>
                      <div className="menu-item-copy">
                        <strong>Add Demo Bill (Simulation)</strong>
                        <small>Add local receivable to temporary sandbox</small>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Dropdown 2: Manage System */}
              <div className="action-dropdown-wrap" ref={manageMenuRef}>
                <button
                  type="button"
                  className="dropdown-trigger-btn secondary"
                  onClick={() => {
                    setManageMenuOpen(!manageMenuOpen);
                    setSubmissionMenuOpen(false);
                  }}
                  aria-expanded={manageMenuOpen}
                  aria-haspopup="true"
                >
                  <Settings size={14} />
                  <span>Manage</span>
                  <ChevronDown size={14} className={`dropdown-chevron ${manageMenuOpen ? "open" : ""}`} />
                </button>

                {manageMenuOpen && (
                  <div className="dropdown-menu-panel" role="menu">
                    <div className="dropdown-menu-header">
                      <span>CONFIGURATION & LOGS</span>
                    </div>

                    {currentUser?.role?.toLowerCase() === "admin" && (
                      <>
                        <button
                          type="button"
                          className="dropdown-menu-item"
                          role="menuitem"
                          onClick={() => {
                            setManageMenuOpen(false);
                            void openWorkflowsDialog();
                          }}
                        >
                          <div className="menu-item-icon green">
                            <WorkflowIcon size={15} />
                          </div>
                          <div className="menu-item-copy">
                            <strong>Workflows ({workflows.length})</strong>
                            <small>Configure multi-stage approval templates</small>
                          </div>
                        </button>

                        <button
                          type="button"
                          className="dropdown-menu-item"
                          role="menuitem"
                          onClick={() => {
                            setManageMenuOpen(false);
                            void openContactsDialog();
                          }}
                        >
                          <div className="menu-item-icon blue">
                            <Users size={15} />
                          </div>
                          <div className="menu-item-copy">
                            <strong>Contacts & Approvers ({contacts.length})</strong>
                            <small>Manage approver emails, roles, and backups</small>
                          </div>
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      className="dropdown-menu-item"
                      role="menuitem"
                      onClick={() => {
                        setManageMenuOpen(false);
                        handleNav("batches");
                      }}
                    >
                      <div className="menu-item-icon slate">
                        <History size={15} />
                      </div>
                      <div className="menu-item-copy">
                        <strong>Audit Batches ({liveBatches.length})</strong>
                        <small>Inspect timeline, logs, and notification audit</small>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Role-Aware Status & Permission Banner */}
          <div className="demo-banner">
            <span className="banner-mark">
              <Info size={13} />
            </span>
            <span>
              <strong>
                {currentUser?.role?.toLowerCase() === "admin"
                  ? "👑 Administrator Workspace"
                  : `👤 Approver Workspace · ${currentUser?.name ?? "Approver"} (${currentUser?.email ?? ""})`}
              </strong>
              &nbsp;·&nbsp;
              {apiStatus === "connected" && liveWorkflow
                ? `${liveWorkflow.name} · ${inFlightCount} active pipeline batch(es) · ${settlementsCount} ready for payment`
                : apiStatus === "offline"
                ? "API offline · Demo simulation mode"
                : "Connecting to API..."}
            </span>
          </div>

          {/* Interactive Standard Workflow Lifecycle Roadmap */}
          <WorkflowLifecycleBar
            inFlightCount={inFlightCount}
            settlementsCount={settlementsCount}
            billsCount={bills.length}
            onOpenSubmitIndividualBill={() => setIndividualBillModalOpen(true)}
            onOpenCreateBatch={() => setBatchDialogOpen(true)}
            onNavigateToTab={handleNav}
          />

          {/* Executive Workflow View Switcher */}
          <div className="view-mode-tabs" role="tablist" aria-label="Workflow view switcher">
            <button
              type="button"
              role="tab"
              aria-selected={viewFilter === "all"}
              className={`view-mode-btn ${viewFilter === "all" ? "active" : ""}`}
              onClick={() => handleNav("overview")}
            >
              <LayoutGrid size={14} />
              <span>All Workspace</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewFilter === "pipeline"}
              className={`view-mode-btn ${viewFilter === "pipeline" ? "active" : ""}`}
              onClick={() => handleNav("pipeline")}
            >
              <GitBranch size={14} />
              <span>Approval Pipeline</span>
              {inFlightCount > 0 && <span className="view-badge badge-alert">{inFlightCount} active</span>}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewFilter === "settlements"}
              className={`view-mode-btn ${viewFilter === "settlements" ? "active" : ""}`}
              onClick={() => handleNav("settlements")}
            >
              <CreditCard size={14} />
              <span>Settlement Center</span>
              {settlementsCount > 0 && <span className="view-badge badge-ready">{settlementsCount} ready</span>}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewFilter === "bills"}
              className={`view-mode-btn ${viewFilter === "bills" ? "active" : ""}`}
              onClick={() => handleNav("bills")}
            >
              <FileSpreadsheet size={14} />
              <span>Receivables Ledger</span>
              <span className="view-badge">{bills.length} bills</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewFilter === "batches"}
              className={`view-mode-btn ${viewFilter === "batches" ? "active" : ""}`}
              onClick={() => handleNav("batches")}
            >
              <History size={14} />
              <span>Audit Batches</span>
              <span className="view-badge">{liveBatches.length} batches</span>
            </button>
          </div>

          {/* 1. Executive Summary KPIs (Shown in Overview & Receivables View) */}
          {(viewFilter === "all" || viewFilter === "bills") && (
            <MetricsGrid
              bills={bills}
              outstanding={outstanding}
              overdue={overdue}
              dueSoon={dueSoon}
              collected={collected}
            />
          )}

          {/* 2. Overview: Clean In-Flight Approvals Summary */}
          {apiStatus === "connected" && viewFilter === "all" && (
            <CompactPipelineSection
              liveBatches={liveBatches}
              currentUser={currentUser}
              onOpenApprovalLink={openApprovalLink}
              onNavigateToPipeline={() => handleNav("pipeline")}
              onOpenBatchHistory={openBatchHistory}
            />
          )}

          {/* 3. Dedicated View: Interactive Multi-Stage Approval Pipeline */}
          {apiStatus === "connected" && viewFilter === "pipeline" && (
            <div id="pipeline">
              <CurrentlyWithBoard
                liveBatches={liveBatches}
                currentUser={currentUser}
                contacts={contacts}
                isSubmittingApproval={isSubmittingApproval}
                approvalComment={approvalComment}
                setApprovalComment={setApprovalComment}
                onSubmitApproval={submitApproval}
                onOpenApprovalLink={openApprovalLink}
                onSubmitConfirmOnBehalf={submitConfirmOnBehalf}
                onOpenReassignModal={(bId, sId, cName) => {
                  setReassignTarget({ batchId: bId, stepId: sId, currentContactName: cName });
                  setReassignNewContactId(contacts.find((c) => c.name !== cName)?.id || "");
                  setReassignReason("");
                  setReassignModalOpen(true);
                }}
                onLoginAs={loginAs}
                onOpenBatchHistory={openBatchHistory}
                onDeleteBatch={deleteBatch}
              />
            </div>
          )}

          {/* 4. Dedicated View: Unified Settlements & Payments Hub */}
          {apiStatus === "connected" && viewFilter === "settlements" && (
            <div id="settlements">
              <SettlementsHub
                liveBatches={liveBatches}
                paymentRecords={paymentRecords}
                proofLinks={proofLinks}
                isUploadingProofFor={isUploadingProofFor}
                currentUser={currentUser}
                onOpenPaymentEntry={openPaymentEntry}
                onOpenOnAccountEntry={openOnAccountEntry}
                onOpenOnAccountAllocation={openOnAccountAllocation}
                onDeleteBatch={deleteBatch}
                onCreatePaymentProofViewLink={createPaymentProofViewLink}
                onAttachPaymentProof={attachPaymentProof}
              />
            </div>
          )}

          {/* 4. Trend Chart (Shown in dedicated Receivables Ledger View) */}
          {viewFilter === "bills" && (
            <CollectionPulse collectedThisMonth={collectedThisMonth} />
          )}

          {/* 5. Receivables Ledger Table (Shown in Overview & Receivables View) */}
          {(viewFilter === "all" || viewFilter === "bills") && (
            <div id="bills">
              <BillsTable
                bills={bills}
                visibleBills={visibleBills}
                filter={filter}
                setFilter={setFilter}
                search={search}
                setSearch={setSearch}
                onMarkPaid={markPaid}
                onDeleteBill={deleteBill}
              />
            </div>
          )}

          {/* 6. Approval Batches & Audit Trail (Dedicated View for Audit Trail & Batches) */}
          {viewFilter === "batches" && (
            <div id="batches">
              <BatchesTable
                liveBatches={liveBatches}
                batchFilter={batchFilter}
                setBatchFilter={setBatchFilter}
                currentUser={currentUser}
                onOpenBatchHistory={openBatchHistory}
                onDeleteBatch={deleteBatch}
              />
            </div>
          )}
        </div>
      </section>

      {/* MODALS */}
      <AddDemoBillModal
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        draft={draft}
        setDraft={setDraft}
        onAddBill={addBill}
      />

      <CreateBatchModal
        isOpen={batchDialogOpen}
        onClose={() => setBatchDialogOpen(false)}
        workflows={workflows}
        liveWorkflow={liveWorkflow}
        contacts={contacts}
        selectedTemplateId={selectedTemplateId}
        setSelectedTemplateId={setSelectedTemplateId}
        setLiveWorkflow={setLiveWorkflow}
        batchBills={batchBills}
        setBatchBills={setBatchBills}
        isCreatingBatch={isCreatingBatch}
        onCreateBatch={createBatch}
        onOpenWorkflowsDialog={openWorkflowsDialog}
        onOpenContactsDialog={openContactsDialog}
      />

      <SubmitIndividualBillModal
        isOpen={individualBillModalOpen}
        onClose={() => setIndividualBillModalOpen(false)}
        workflows={workflows}
        liveWorkflow={liveWorkflow}
        contacts={contacts}
        selectedTemplateId={selectedTemplateId}
        setSelectedTemplateId={setSelectedTemplateId}
        setLiveWorkflow={setLiveWorkflow}
        isSubmitting={isSubmittingSingleBill}
        onSubmitBill={submitIndividualBill}
        onOpenWorkflowsDialog={openWorkflowsDialog}
        onOpenContactsDialog={openContactsDialog}
      />

      <WorkflowNextStepsModal
        isOpen={nextStepsModalOpen}
        onClose={() => setNextStepsModalOpen(false)}
        batch={lastSubmittedBatch}
        billNumber={lastSubmittedBillNumber}
        amount={lastSubmittedAmount}
        workflowName={liveWorkflow?.name}
        onOpenMagicLink={openApprovalLink}
        onViewInPipeline={(_bId) => {
          setViewFilter("pipeline");
          document.getElementById("pipeline")?.scrollIntoView({ behavior: "smooth" });
        }}
      />

      <ContactsModal
        isOpen={contactsDialogOpen}
        onClose={() => setContactsDialogOpen(false)}
        contacts={contacts}
        setContacts={setContacts}
        currentUser={currentUser}
        contactDraft={contactDraft}
        setContactDraft={setContactDraft}
        isSavingContact={isSavingContact}
        onSaveContact={saveContact}
        onDeleteContact={deleteContact}
        onCreateContact={createContact}
        onBuildWorkflowWithContact={(contact) => {
          setContactsDialogOpen(false);
          setNewWorkflowStages([
            { contactId: contact.id, backupContactId: "", reminderIntervalHours: 24, maxReminders: 3 },
          ]);
          setNewWorkflowName(`${contact.name.split(" ")[0]}'s Approval Flow`);
          setWorkflowsDialogOpen(true);
        }}
        onSwitchToAdmin={() => void loginAs("admin@example.test", "demo123")}
      />

      <PaymentEntryModal
        isOpen={paymentEntryOpen}
        onClose={() => setPaymentEntryOpen(false)}
        paymentBatch={paymentBatch}
        onAccountPaymentId={onAccountPaymentId}
        isOnAccountEntry={isOnAccountEntry}
        onAccountAmount={onAccountAmount}
        setOnAccountAmount={setOnAccountAmount}
        paymentLines={paymentLines}
        setPaymentLines={setPaymentLines}
        paymentDate={paymentDate}
        setPaymentDate={setPaymentDate}
        paymentReference={paymentReference}
        setPaymentReference={setPaymentReference}
        paymentRecords={paymentRecords}
        isSavingPayment={isSavingPayment}
        onCreatePayment={createPayment}
      />

      <WorkflowBuilderModal
        isOpen={workflowsDialogOpen}
        onClose={() => setWorkflowsDialogOpen(false)}
        workflows={workflows}
        contacts={contacts}
        newWorkflowName={newWorkflowName}
        setNewWorkflowName={setNewWorkflowName}
        newWorkflowStages={newWorkflowStages}
        setNewWorkflowStages={setNewWorkflowStages}
        isSavingWorkflow={isSavingWorkflow}
        onCreateWorkflow={createWorkflow}
        onDeleteWorkflow={deleteWorkflow}
        onSelectWorkflowForBatch={(wf) => {
          setSelectedTemplateId(wf.id);
          setLiveWorkflow(wf);
          setWorkflowsDialogOpen(false);
          setBatchDialogOpen(true);
        }}
        onOpenContactsDialog={openContactsDialog}
      />

      <BatchHistoryDrawer
        isOpen={batchHistoryDialogOpen}
        onClose={() => setBatchHistoryDialogOpen(false)}
        isLoading={isLoadingBatchHistory}
        selectedBatchHistory={selectedBatchHistory}
        historyTab={historyTab}
        setHistoryTab={setHistoryTab}
      />

      <ReassignApproverModal
        isOpen={reassignModalOpen}
        onClose={() => setReassignModalOpen(false)}
        reassignTarget={reassignTarget}
        contacts={contacts}
        reassignNewContactId={reassignNewContactId}
        setReassignNewContactId={setReassignNewContactId}
        reassignReason={reassignReason}
        setReassignReason={setReassignReason}
        isSubmittingReassign={isSubmittingReassign}
        onSubmitReassign={submitReassignStep}
        onOpenContactsDialog={openContactsDialog}
      />
    </main>
  );
}
