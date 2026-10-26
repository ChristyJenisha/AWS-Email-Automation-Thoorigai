"use client";

import React, { useState, useMemo, FormEvent } from "react";
import {
  Layers,
  Users,
  ShieldCheck,
  Plus,
  Trash2,
  Edit2,
  ArrowRight,
  Lock,
  CheckCircle2,
  AlertCircle,
  Moon,
  Search,
  UserPlus,
  Clock,
  ShieldAlert,
  Eye,
  EyeOff,
  KeyRound,
} from "lucide-react";
import { useDataContext } from "../../lib/DataContext";
import { Button, Badge, ModalDialog } from "../../components/ui";
import { ContactRecord, WorkflowRecord } from "../../types";
import { initials } from "../../lib/utils";
import { getApiBase } from "../../lib/api";

type TabType = "workflows" | "admins" | "contacts" | "policies";

interface StageDraft {
  contactId: string;
  backupContactId: string;
  reminderIntervalHours: number;
  maxReminders: number;
}

export default function SettingsPage() {
  const { workflows, contacts, currentUser, authToken, refreshData } = useDataContext();
  const isAdmin = currentUser?.role?.toLowerCase() === "admin";

  // Tab State
  const [activeTab, setActiveTab] = useState<TabType>("workflows");

  // Feedback Notification
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // -------------------------------------------------------------------------
  // WORKFLOW TEMPLATES STATE & HANDLERS
  // -------------------------------------------------------------------------
  const [createWfOpen, setCreateWfOpen] = useState(false);
  const [editWfOpen, setEditWfOpen] = useState(false);
  const [editingWfId, setEditingWfId] = useState<string | null>(null);
  const [deleteWfTarget, setDeleteWfTarget] = useState<WorkflowRecord | null>(null);

  const [wfName, setWfName] = useState("");
  const [wfStages, setWfStages] = useState<StageDraft[]>([
    { contactId: "", backupContactId: "", reminderIntervalHours: 24, maxReminders: 3 },
  ]);
  const [isSubmittingWf, setIsSubmittingWf] = useState(false);

  const activeContacts = useMemo(() => contacts.filter((c) => c.isActive), [contacts]);

  const openCreateWorkflowModal = () => {
    setWfName("");
    setWfStages([{ contactId: "", backupContactId: "", reminderIntervalHours: 24, maxReminders: 3 }]);
    setCreateWfOpen(true);
  };

  const openEditWorkflowModal = (wf: WorkflowRecord) => {
    setEditingWfId(wf.id);
    setWfName(wf.name);
    setWfStages(
      wf.stages.map((stg) => ({
        contactId: stg.contact?.id ?? "",
        backupContactId: stg.backupContact?.id ?? "",
        reminderIntervalHours: stg.reminderIntervalHours ?? 24,
        maxReminders: stg.maxReminders ?? 3,
      }))
    );
    setEditWfOpen(true);
  };

  const handleAddStage = () => {
    setWfStages((curr) => [
      ...curr,
      { contactId: "", backupContactId: "", reminderIntervalHours: 24, maxReminders: 3 },
    ]);
  };

  const handleRemoveStage = (index: number) => {
    if (wfStages.length <= 1) return;
    setWfStages((curr) => curr.filter((_, idx) => idx !== index));
  };

  const handleStageChange = <K extends keyof StageDraft>(index: number, field: K, value: StageDraft[K]) => {
    setWfStages((curr) =>
      curr.map((stage, idx) => (idx === index ? { ...stage, [field]: value } : stage))
    );
  };

  const handleCreateWorkflow = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !authToken || !currentUser) return;
    if (!wfName.trim()) {
      setNotice({ type: "error", message: "Workflow template name is required." });
      return;
    }
    if (wfStages.some((s) => !s.contactId)) {
      setNotice({ type: "error", message: "Please select a primary approver for all stages." });
      return;
    }

    setIsSubmittingWf(true);
    setNotice(null);
    const apiBase = getApiBase();

    try {
      const response = await fetch(`${apiBase}/workflows`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          organizationId: currentUser.organizationId || "demo-org",
          name: wfName.trim(),
          stages: wfStages.map((s) => ({
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
        throw new Error(msg || "Failed to create workflow template.");
      }

      await refreshData();
      setCreateWfOpen(false);
      setNotice({ type: "success", message: `Workflow "${wfName.trim()}" created successfully.` });
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Creation failed." });
    } finally {
      setIsSubmittingWf(false);
    }
  };

  const handleEditWorkflow = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !authToken || !currentUser || !editingWfId) return;
    if (!wfName.trim()) {
      setNotice({ type: "error", message: "Workflow template name is required." });
      return;
    }
    if (wfStages.some((s) => !s.contactId)) {
      setNotice({ type: "error", message: "Please select a primary approver for all stages." });
      return;
    }

    setIsSubmittingWf(true);
    setNotice(null);
    const apiBase = getApiBase();

    try {
      const response = await fetch(`${apiBase}/workflows/${encodeURIComponent(editingWfId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          name: wfName.trim(),
          stages: wfStages.map((s) => ({
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
        throw new Error(msg || "Failed to update workflow template.");
      }

      await refreshData();
      setEditWfOpen(false);
      setEditingWfId(null);
      setNotice({ type: "success", message: `Workflow "${wfName.trim()}" updated successfully.` });
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Update failed." });
    } finally {
      setIsSubmittingWf(false);
    }
  };

  const handleDeleteWorkflow = async () => {
    if (!isAdmin || !authToken || !deleteWfTarget) return;
    setIsSubmittingWf(true);
    setNotice(null);
    const apiBase = getApiBase();

    try {
      const response = await fetch(`${apiBase}/workflows/${encodeURIComponent(deleteWfTarget.id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string | string[] };
        const msg = Array.isArray(payload.message) ? payload.message.join(" ") : payload.message;
        throw new Error(msg || "Failed to delete workflow template.");
      }

      await refreshData();
      setNotice({ type: "success", message: `Workflow "${deleteWfTarget.name}" deleted successfully.` });
      setDeleteWfTarget(null);
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Delete failed." });
    } finally {
      setIsSubmittingWf(false);
    }
  };

  // -------------------------------------------------------------------------
  // CONTACTS & ADMINISTRATORS STATE & HANDLERS
  // -------------------------------------------------------------------------
  const adminContacts = useMemo(
    () => contacts.filter((c) => c.role?.toUpperCase() === "ADMIN"),
    [contacts]
  );
  const approverContacts = useMemo(
    () => contacts.filter((c) => c.role?.toUpperCase() !== "ADMIN"),
    [contacts]
  );

  const [adminSearch, setAdminSearch] = useState("");
  const [approverSearch, setApproverSearch] = useState("");
  const [isModalForAdmin, setIsModalForAdmin] = useState(false);

  const [createContactOpen, setCreateContactOpen] = useState(false);
  const [editContactOpen, setEditContactOpen] = useState(false);
  const [deleteContactTarget, setDeleteContactTarget] = useState<ContactRecord | null>(null);

  const [contactDraft, setContactDraft] = useState({ name: "", email: "", role: "APPROVER", password: "" });
  const [editingContact, setEditingContact] = useState<ContactRecord | null>(null);
  const [editContactPassword, setEditContactPassword] = useState("");
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);

  const filteredAdmins = useMemo(() => {
    const q = adminSearch.trim().toLowerCase();
    if (!q) return adminContacts;
    return adminContacts.filter(
      (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    );
  }, [adminContacts, adminSearch]);

  const filteredApprovers = useMemo(() => {
    const q = approverSearch.trim().toLowerCase();
    if (!q) return approverContacts;
    return approverContacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.role.toLowerCase().includes(q)
    );
  }, [approverContacts, approverSearch]);

  const openCreateAdminModal = () => {
    setContactDraft({ name: "", email: "", role: "ADMIN", password: "" });
    setShowCreatePassword(false);
    setIsModalForAdmin(true);
    setCreateContactOpen(true);
  };

  const openCreateApproverModal = () => {
    setContactDraft({ name: "", email: "", role: "APPROVER", password: "" });
    setShowCreatePassword(false);
    setIsModalForAdmin(false);
    setCreateContactOpen(true);
  };

  const openEditContactModal = (c: ContactRecord) => {
    setEditingContact(c);
    setEditContactPassword("");
    setShowEditPassword(false);
    setIsModalForAdmin(c.role?.toUpperCase() === "ADMIN");
    setEditContactOpen(true);
  };

  const handleCreateContact = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !authToken || !currentUser) return;
    if (!contactDraft.name.trim() || !contactDraft.email.trim()) {
      setNotice({ type: "error", message: "Name and Email are required." });
      return;
    }
    if (isModalForAdmin && (!contactDraft.password.trim() || contactDraft.password.trim().length < 6)) {
      setNotice({ type: "error", message: "Password must be at least 6 characters long for an Administrator." });
      return;
    }

    setIsSubmittingContact(true);
    setNotice(null);
    const apiBase = getApiBase();

    try {
      const response = await fetch(`${apiBase}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          organizationId: currentUser.organizationId || "demo-org",
          name: contactDraft.name.trim(),
          email: contactDraft.email.trim(),
          role: contactDraft.role.trim() || "APPROVER",
          ...(isModalForAdmin && contactDraft.password.trim() ? { password: contactDraft.password.trim() } : {}),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string | string[] };
        const msg = Array.isArray(payload.message) ? payload.message.join(" ") : payload.message;
        throw new Error(msg || "Failed to create contact.");
      }

      await refreshData();
      setCreateContactOpen(false);
      setNotice({ type: "success", message: `Contact "${contactDraft.name}" added successfully.` });
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Creation failed." });
    } finally {
      setIsSubmittingContact(false);
    }
  };

  const handleEditContact = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !authToken || !currentUser || !editingContact) return;
    if (isModalForAdmin && editContactPassword.trim() && editContactPassword.trim().length < 6) {
      setNotice({ type: "error", message: "New password must be at least 6 characters long." });
      return;
    }

    setIsSubmittingContact(true);
    setNotice(null);
    const apiBase = getApiBase();

    try {
      const response = await fetch(
        `${apiBase}/contacts/${encodeURIComponent(editingContact.id)}?organizationId=${encodeURIComponent(
          currentUser.organizationId || "demo-org"
        )}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({
            name: editingContact.name.trim(),
            email: editingContact.email.trim(),
            role: editingContact.role.trim(),
            isActive: editingContact.isActive,
            ...(isModalForAdmin && editContactPassword.trim() ? { password: editContactPassword.trim() } : {}),
          }),
        }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string | string[] };
        const msg = Array.isArray(payload.message) ? payload.message.join(" ") : payload.message;
        throw new Error(msg || "Failed to update contact.");
      }

      await refreshData();
      setEditContactOpen(false);
      setEditingContact(null);
      setNotice({ type: "success", message: "Contact updated successfully." });
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Update failed." });
    } finally {
      setIsSubmittingContact(false);
    }
  };

  const handleToggleContactActive = async (contact: ContactRecord) => {
    if (!isAdmin || !authToken || !currentUser) return;
    setNotice(null);
    const apiBase = getApiBase();

    try {
      const response = await fetch(
        `${apiBase}/contacts/${encodeURIComponent(contact.id)}?organizationId=${encodeURIComponent(
          currentUser.organizationId || "demo-org"
        )}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({
            isActive: !contact.isActive,
          }),
        }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message || "Could not toggle contact status.");
      }

      await refreshData();
      setNotice({
        type: "success",
        message: `Contact "${contact.name}" is now ${!contact.isActive ? "active" : "inactive"}.`,
      });
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Action failed." });
    }
  };

  const handleDeleteContact = async () => {
    if (!isAdmin || !authToken || !currentUser || !deleteContactTarget) return;
    setIsSubmittingContact(true);
    setNotice(null);
    const apiBase = getApiBase();

    try {
      const response = await fetch(
        `${apiBase}/contacts/${encodeURIComponent(deleteContactTarget.id)}?organizationId=${encodeURIComponent(
          currentUser.organizationId || "demo-org"
        )}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string | string[] };
        const msg = Array.isArray(payload.message) ? payload.message.join(" ") : payload.message;
        throw new Error(msg || "Could not delete contact.");
      }

      await refreshData();
      setNotice({ type: "success", message: `Contact "${deleteContactTarget.name}" deleted permanently.` });
      setDeleteContactTarget(null);
    } catch (err) {
      setNotice({ type: "error", message: err instanceof Error ? err.message : "Delete failed." });
    } finally {
      setIsSubmittingContact(false);
    }
  };

  // -------------------------------------------------------------------------
  // POLICIES & QUIET HOURS CALCULATION
  // -------------------------------------------------------------------------
  const now = new Date();
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  // Indian Standard Time is UTC + 5:30
  const istTotalMinutes = (utcHours * 60 + utcMinutes + 330) % 1440;
  const istHour = Math.floor(istTotalMinutes / 60);
  const isQuietHoursNow = istHour >= 21 || istHour < 8;

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="section-heading" style={{ marginBottom: 20 }}>
        <div>
          <p className="eyebrow">ADMINISTRATION & CONFIGURATION</p>
          <h2>Workflow Settings & Policies</h2>
          <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: 13 }}>
            Manage sequential approval stages, approver directory, and dispatch policies.
          </p>
        </div>
        <div className="settings-header-actions">
          {!isAdmin && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                padding: "4px 10px",
                borderRadius: 6,
                background: "var(--bg-subtle)",
                color: "var(--text-muted)",
              }}
            >
              <Lock size={13} />
              <span>Read-only ({currentUser?.role ?? "Approver"} mode)</span>
            </div>
          )}
        </div>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px",
            borderRadius: "var(--radius-md)",
            fontSize: 13,
            marginBottom: 20,
            background: notice.type === "success" ? "var(--brand-light)" : "var(--urgency-rose-bg)",
            color: notice.type === "success" ? "var(--brand-primary)" : "var(--urgency-rose)",
            border: `1px solid ${notice.type === "success" ? "var(--brand-border)" : "var(--urgency-rose-border)"}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {notice.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{notice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            style={{
              background: "none",
              border: "none",
              fontSize: 16,
              cursor: "pointer",
              color: "inherit",
              lineHeight: 1,
            }}
            aria-label="Dismiss notice"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="settings-tabs-bar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "workflows"}
          className={`settings-tab-btn ${activeTab === "workflows" ? "active" : ""}`}
          onClick={() => setActiveTab("workflows")}
        >
          <Layers size={15} />
          <span>Workflow Templates</span>
          <Badge variant="neutral">{workflows.length}</Badge>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "admins"}
          className={`settings-tab-btn ${activeTab === "admins" ? "active" : ""}`}
          onClick={() => setActiveTab("admins")}
        >
          <ShieldAlert size={15} />
          <span>Team & Admins</span>
          <Badge variant={adminContacts.length > 0 ? "urgent" : "neutral"}>{adminContacts.length}</Badge>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "contacts"}
          className={`settings-tab-btn ${activeTab === "contacts" ? "active" : ""}`}
          onClick={() => setActiveTab("contacts")}
        >
          <Users size={15} />
          <span>Approvers Directory</span>
          <Badge variant="neutral">{approverContacts.length}</Badge>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "policies"}
          className={`settings-tab-btn ${activeTab === "policies" ? "active" : ""}`}
          onClick={() => setActiveTab("policies")}
        >
          <ShieldCheck size={15} />
          <span>Policies</span>
          <Badge variant="info">Read-only</Badge>
        </button>
      </div>

      {/* =====================================================================
          TAB 1: WORKFLOW TEMPLATES
         ===================================================================== */}
      {activeTab === "workflows" && (
        <section aria-labelledby="tab-workflows-title">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <div>
              <h3 id="tab-workflows-title" style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                Approval Hierarchies ({workflows.length})
              </h3>
              <p style={{ margin: "2px 0 0", color: "var(--text-secondary)", fontSize: 13 }}>
                Sequential approval chains with designated primary officers, backups, and automated intervals.
              </p>
            </div>
            {isAdmin && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus size={15} />}
                onClick={openCreateWorkflowModal}
              >
                Create Template
              </Button>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {workflows.map((wf) => {
              const inUseBatches = wf._count?.batches ?? 0;

              return (
                <div key={wf.id} className="settings-template-card">
                  <div className="settings-template-head">
                    <div>
                      <div className="settings-template-title-group">
                        <h4 className="settings-template-title">{wf.name}</h4>
                        <Badge variant="neutral">
                          {wf.stages.length} stage{wf.stages.length === 1 ? "" : "s"}
                        </Badge>
                        {inUseBatches > 0 ? (
                          <Badge variant="info">In Use ({inUseBatches} active batches)</Badge>
                        ) : (
                          <Badge variant="neutral">Draft / Available</Badge>
                        )}
                      </div>
                      <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 12 }}>
                        Template ID: <code style={{ fontSize: 11 }}>{wf.id}</code>
                      </p>
                    </div>

                    {isAdmin && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Button
                          variant="outline"
                          size="sm"
                          leftIcon={<Edit2 size={13} />}
                          onClick={() => openEditWorkflowModal(wf)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          leftIcon={<Trash2 size={13} />}
                          disabled={inUseBatches > 0}
                          onClick={() => setDeleteWfTarget(wf)}
                          title={
                            inUseBatches > 0
                              ? "Cannot delete a workflow template that is currently linked to active batches."
                              : "Permanently delete this workflow template"
                          }
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Visual Stages Flow */}
                  <div className="settings-stages-flow">
                    {wf.stages.map((stage, idx) => (
                      <React.Fragment key={stage.id || idx}>
                        <div className="settings-stage-chip">
                          <div className="settings-stage-chip-header">
                            <Badge variant="info">Stage #{stage.order}</Badge>
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                              {stage.reminderIntervalHours ?? 24}h interval
                            </span>
                          </div>

                          <div className="settings-stage-chip-approver">
                            <span>{stage.contact?.name ?? "Unassigned"}</span>
                          </div>

                          <div className="settings-stage-chip-meta">
                            <span>{stage.contact?.email ?? "No email"}</span>
                            {stage.backupContact ? (
                              <span style={{ color: "var(--text-secondary)" }}>
                                Backup: <strong>{stage.backupContact.name}</strong>
                              </span>
                            ) : (
                              <span style={{ color: "var(--text-muted)" }}>Backup: None</span>
                            )}
                            <span style={{ color: "var(--text-muted)" }}>
                              Max {stage.maxReminders ?? 3} reminders
                            </span>
                          </div>
                        </div>

                        {idx < wf.stages.length - 1 && (
                          <ArrowRight size={15} className="settings-stage-arrow" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              );
            })}

            {workflows.length === 0 && (
              <div
                style={{
                  background: "var(--bg-surface)",
                  border: "1px dashed var(--border-strong)",
                  borderRadius: "var(--radius-lg)",
                  padding: "48px 24px",
                  textAlign: "center",
                }}
              >
                <Layers size={32} style={{ color: "var(--text-muted)", marginBottom: 8 }} />
                <h4 style={{ margin: "0 0 6px", fontSize: 15 }}>No Workflow Templates Configured</h4>
                <p style={{ margin: "0 0 16px", color: "var(--text-secondary)", fontSize: 13 }}>
                  Create your first approval hierarchy to route payment batches to department approvers.
                </p>
                {isAdmin && (
                  <Button variant="primary" size="sm" onClick={openCreateWorkflowModal}>
                    + Create First Template
                  </Button>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* =====================================================================
          TAB 2: TEAM & ADMINISTRATORS (DASHBOARD LOGIN ACCESS)
         ===================================================================== */}
      {activeTab === "admins" && (
        <section aria-labelledby="tab-admins-title">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <h3 id="tab-admins-title" style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                Team & System Administrators ({adminContacts.length})
              </h3>
              <p style={{ margin: "2px 0 0", color: "var(--text-secondary)", fontSize: 13 }}>
                Internal operators and team leads authorized to log into the dashboard with their email & password. Administrators can also be assigned as stage approvers in workflow templates.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ position: "relative" }}>
                <Search
                  size={14}
                  style={{
                    position: "absolute",
                    left: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                  }}
                />
                <input
                  type="text"
                  placeholder="Search administrators..."
                  value={adminSearch}
                  onChange={(e) => setAdminSearch(e.target.value)}
                  style={{
                    padding: "6px 12px 6px 30px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-light)",
                    fontSize: 13,
                    background: "var(--bg-surface)",
                    color: "var(--text-primary)",
                    minWidth: 200,
                  }}
                />
              </div>

              {isAdmin && (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<UserPlus size={15} />}
                  onClick={openCreateAdminModal}
                >
                  Add Administrator
                </Button>
              )}
            </div>
          </div>

          <div className="settings-table-wrapper">
            <table className="settings-table">
              <thead>
                <tr>
                  <th>Administrator</th>
                  <th>Login Email</th>
                  <th>Access Role</th>
                  <th>Authentication</th>
                  <th>Status</th>
                  {isAdmin && <th style={{ textAlign: "right" }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredAdmins.map((admin) => (
                  <tr key={admin.id}>
                    <td>
                      <div className="settings-user-cell">
                        <span
                          className="settings-user-avatar"
                          style={{ background: "var(--brand-primary)", color: "var(--text-inverse)" }}
                        >
                          {initials(admin.name)}
                        </span>
                        <div>
                          <strong style={{ fontSize: 13.5, color: "var(--text-primary)" }}>
                            {admin.name}
                          </strong>
                        </div>
                      </div>
                    </td>

                    <td style={{ color: "var(--text-secondary)" }}>
                      <code style={{ fontSize: 12.5 }}>{admin.email}</code>
                    </td>

                    <td>
                      <Badge variant="urgent">👑 Administrator</Badge>
                    </td>

                    <td>
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--status-success)",
                          fontWeight: 600,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <KeyRound size={13} />
                        <span>Email & Password</span>
                      </span>
                    </td>

                    <td>
                      <Badge variant={admin.isActive ? "success" : "neutral"}>
                        {admin.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>

                    {isAdmin && (
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<Edit2 size={12} />}
                            onClick={() => openEditContactModal(admin)}
                          >
                            Edit / Password
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleToggleContactActive(admin)}
                            title={admin.isActive ? "Deactivate this admin" : "Re-activate this admin"}
                          >
                            {admin.isActive ? "Deactivate" : "Activate"}
                          </Button>

                          <Button
                            variant="destructive"
                            size="sm"
                            leftIcon={<Trash2 size={12} />}
                            onClick={() => setDeleteContactTarget(admin)}
                            title="Permanently remove administrator"
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}

                {filteredAdmins.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} style={{ textAlign: "center", padding: "36px 18px" }}>
                      <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>
                        No administrators found matching your search.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* =====================================================================
          TAB 3: APPROVERS DIRECTORY (PASSWORDLESS EMAIL SIGNATORIES)
         ===================================================================== */}
      {activeTab === "contacts" && (
        <section aria-labelledby="tab-contacts-title">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <h3 id="tab-contacts-title" style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                Approvers Directory ({approverContacts.length})
              </h3>
              <p style={{ margin: "2px 0 0", color: "var(--text-secondary)", fontSize: 13 }}>
                Designated reviewers and client signatories who receive 1-click email authorization links & OTP codes.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ position: "relative" }}>
                <Search
                  size={14}
                  style={{
                    position: "absolute",
                    left: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                  }}
                />
                <input
                  type="text"
                  placeholder="Search approvers..."
                  value={approverSearch}
                  onChange={(e) => setApproverSearch(e.target.value)}
                  style={{
                    padding: "6px 12px 6px 30px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-light)",
                    fontSize: 13,
                    background: "var(--bg-surface)",
                    color: "var(--text-primary)",
                    minWidth: 200,
                  }}
                />
              </div>

              {isAdmin && (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<UserPlus size={15} />}
                  onClick={openCreateApproverModal}
                >
                  Add Approver
                </Button>
              )}
            </div>
          </div>

          <div className="settings-table-wrapper">
            <table className="settings-table">
              <thead>
                <tr>
                  <th>Approver Officer</th>
                  <th>Email Address</th>
                  <th>Approval Role</th>
                  <th>Authentication</th>
                  <th>Status</th>
                  {isAdmin && <th style={{ textAlign: "right" }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredApprovers.map((approver) => (
                  <tr key={approver.id}>
                    <td>
                      <div className="settings-user-cell">
                        <span className="settings-user-avatar">{initials(approver.name)}</span>
                        <div>
                          <strong style={{ fontSize: 13.5, color: "var(--text-primary)" }}>
                            {approver.name}
                          </strong>
                        </div>
                      </div>
                    </td>

                    <td style={{ color: "var(--text-secondary)" }}>
                      <code style={{ fontSize: 12.5 }}>{approver.email}</code>
                    </td>

                    <td>
                      <Badge
                        variant={
                          approver.role.toUpperCase().includes("BACKUP")
                            ? "warning"
                            : "info"
                        }
                      >
                        {approver.role === "BACKUP_APPROVER" ? "🛡️ Backup Approver" : "👤 Primary Approver"}
                      </Badge>
                    </td>

                    <td>
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--text-muted)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <span>✉️ Signed Magic Link + OTP</span>
                      </span>
                    </td>

                    <td>
                      <Badge variant={approver.isActive ? "success" : "neutral"}>
                        {approver.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>

                    {isAdmin && (
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<Edit2 size={12} />}
                            onClick={() => openEditContactModal(approver)}
                          >
                            Edit
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleToggleContactActive(approver)}
                            title={approver.isActive ? "Deactivate this approver" : "Re-activate this approver"}
                          >
                            {approver.isActive ? "Deactivate" : "Activate"}
                          </Button>

                          <Button
                            variant="destructive"
                            size="sm"
                            leftIcon={<Trash2 size={12} />}
                            onClick={() => setDeleteContactTarget(approver)}
                            title="Permanently remove approver"
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}

                {filteredApprovers.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} style={{ textAlign: "center", padding: "36px 18px" }}>
                      <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>
                        No approvers found matching your search.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* =====================================================================
          TAB 3: POLICIES (QUIET HOURS, READ-ONLY)
         ===================================================================== */}
      {activeTab === "policies" && (
        <section aria-labelledby="tab-policies-title">
          <div style={{ marginBottom: 20 }}>
            <h3 id="tab-policies-title" style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              System Operational Rules & Policies
            </h3>
            <p style={{ margin: "2px 0 0", color: "var(--text-secondary)", fontSize: 13 }}>
              Delivery guardrails, automated reminder schedules, and verification security rules.
            </p>
          </div>

          <div className="settings-policies-grid">
            {/* Policy 1: Quiet Hours Policy */}
            <div className="settings-policy-card">
              <div className="settings-policy-head">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Moon size={18} style={{ color: "var(--brand-primary)" }} />
                  <strong style={{ fontSize: 15, color: "var(--text-primary)" }}>
                    Quiet Hours Policy
                  </strong>
                </div>
                <Badge variant={isQuietHoursNow ? "warning" : "success"}>
                  {isQuietHoursNow ? "Quiet Hours Active (Paused)" : "Active Dispatch Window"}
                </Badge>
              </div>

              <p style={{ margin: "0 0 12px", color: "var(--text-secondary)", fontSize: 13 }}>
                Automated reminders are paused between <strong>9:00 PM and 8:00 AM IST</strong> to respect approver rest hours.
              </p>

              <div className="settings-schedule-timeline">
                {/* 0h to 8h: quiet (8/24 = 33%) */}
                <div
                  className="settings-schedule-seg-quiet"
                  style={{ width: "33%" }}
                  title="12:00 AM - 8:00 AM IST (Quiet)"
                />
                {/* 8h to 21h: active (13/24 = 54%) */}
                <div
                  className="settings-schedule-seg-active"
                  style={{ width: "54%" }}
                  title="8:00 AM - 9:00 PM IST (Active Dispatch)"
                />
                {/* 21h to 24h: quiet (3/24 = 13%) */}
                <div
                  className="settings-schedule-seg-quiet"
                  style={{ width: "13%" }}
                  title="9:00 PM - 12:00 AM IST (Quiet)"
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: "var(--text-muted)",
                }}
              >
                <span>12:00 AM IST</span>
                <span style={{ color: "var(--brand-primary)", fontWeight: 600 }}>8:00 AM (Release)</span>
                <span style={{ color: "var(--urgency-amber)", fontWeight: 600 }}>9:00 PM (Quiet)</span>
                <span>12:00 AM</span>
              </div>

              <div
                style={{
                  background: "var(--bg-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: "12px",
                  marginTop: 14,
                  fontSize: 12,
                  color: "var(--text-secondary)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, marginBottom: 4 }}>
                  <Clock size={13} />
                  <span>Nighttime Queue Mechanism</span>
                </div>
                Reminders due during quiet hours are safely held in Postgres and automatically released at 8:00 AM IST sharp.
              </div>
            </div>

            {/* Policy 2: Approver OTP & Security */}
            <div className="settings-policy-card">
              <div className="settings-policy-head">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ShieldCheck size={18} style={{ color: "var(--brand-primary)" }} />
                  <strong style={{ fontSize: 15, color: "var(--text-primary)" }}>
                    Approval Authentication Policy
                  </strong>
                </div>
                <Badge variant="info">HMAC-SHA256</Badge>
              </div>

              <p style={{ margin: "0 0 12px", color: "var(--text-secondary)", fontSize: 13 }}>
                External and internal approvers verify approval actions with ephemeral one-time authentication.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "var(--bg-subtle)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <span style={{ color: "var(--text-muted)" }}>OTP Validity:</span>
                  <strong style={{ color: "var(--text-primary)" }}>10 Minutes (600 seconds)</strong>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "var(--bg-subtle)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <span style={{ color: "var(--text-muted)" }}>Max Failed Attempts:</span>
                  <strong style={{ color: "var(--text-primary)" }}>5 attempts before invalidation</strong>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "var(--bg-subtle)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <span style={{ color: "var(--text-muted)" }}>Email Dispatch Channel:</span>
                  <strong style={{ color: "var(--text-primary)" }}>Gmail SMTP / AWS SES</strong>
                </div>
              </div>
            </div>

            {/* Policy 3: Audit Governance */}
            <div className="settings-policy-card">
              <div className="settings-policy-head">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ShieldAlert size={18} style={{ color: "var(--brand-primary)" }} />
                  <strong style={{ fontSize: 15, color: "var(--text-primary)" }}>
                    Audit & Dual-Control Rules
                  </strong>
                </div>
                <Badge variant="neutral">Tamper-Evident</Badge>
              </div>

              <p style={{ margin: "0 0 12px", color: "var(--text-secondary)", fontSize: 13 }}>
                All administrative overrides and reassignments are recorded with strict validation criteria.
              </p>

              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                <li>
                  <strong>Confirm on Behalf:</strong> Requires minimum <strong>10 characters</strong> of documented audit reasoning before admin authorization completes.
                </li>
                <li>
                  <strong>Reassignment Invalidation:</strong> Changing an approver revokes any outstanding OTP tokens immediately and emails new credentials to the replacement officer.
                </li>
                <li>
                  <strong>Read-Only Isolation:</strong> Approver and non-admin logins cannot trigger batch creation, template deletion, or payment disbursements.
                </li>
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          MODALS: WORKFLOW TEMPLATES (CREATE / EDIT / DELETE)
         ===================================================================== */}

      {/* CREATE WORKFLOW TEMPLATE MODAL */}
      <ModalDialog
        isOpen={createWfOpen}
        onClose={() => !isSubmittingWf && setCreateWfOpen(false)}
        title="Create Workflow Template"
        description="Configure sequential approval stages with designated primary officers and reminder rules."
        maxWidth="620px"
      >
        <form onSubmit={handleCreateWorkflow} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600 }}>
            <span>Template Name</span>
            <input
              type="text"
              required
              placeholder="e.g. Standard 2-Stage Approval, Executive CapEx Review"
              value={wfName}
              onChange={(e) => setWfName(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-light)",
                fontSize: 13,
              }}
            />
          </label>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
              Sequential Approval Stages
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={<Plus size={13} />}
              onClick={handleAddStage}
            >
              Add Stage
            </Button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: "360px", overflowY: "auto", paddingRight: 4 }}>
            {wfStages.map((stage, idx) => (
              <div
                key={idx}
                style={{
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--border-light)",
                  borderRadius: "var(--radius-md)",
                  padding: "14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Badge variant="info">Stage #{idx + 1}</Badge>
                  {wfStages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveStage(idx)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--urgency-rose)",
                        fontSize: 12,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Trash2 size={12} />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600 }}>
                    <span>Primary Approver *</span>
                    <select
                      required
                      value={stage.contactId}
                      onChange={(e) => handleStageChange(idx, "contactId", e.target.value)}
                      style={{
                        padding: "7px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-light)",
                        fontSize: 12.5,
                        background: "var(--bg-surface)",
                      }}
                    >
                      <option value="">Select contact...</option>
                      {activeContacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.email})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600 }}>
                    <span>Backup Approver</span>
                    <select
                      value={stage.backupContactId}
                      onChange={(e) => handleStageChange(idx, "backupContactId", e.target.value)}
                      style={{
                        padding: "7px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-light)",
                        fontSize: 12.5,
                        background: "var(--bg-surface)",
                      }}
                    >
                      <option value="">None (Optional)</option>
                      {activeContacts
                        .filter((c) => c.id !== stage.contactId)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.email})
                          </option>
                        ))}
                    </select>
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600 }}>
                    <span>Reminder Interval (Hours)</span>
                    <input
                      type="number"
                      min={1}
                      max={720}
                      value={stage.reminderIntervalHours}
                      onChange={(e) =>
                        handleStageChange(idx, "reminderIntervalHours", Number(e.target.value))
                      }
                      style={{
                        padding: "6px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-light)",
                        fontSize: 12.5,
                        background: "var(--bg-surface)",
                      }}
                    />
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600 }}>
                    <span>Max Reminders</span>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={stage.maxReminders}
                      onChange={(e) =>
                        handleStageChange(idx, "maxReminders", Number(e.target.value))
                      }
                      style={{
                        padding: "6px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-light)",
                        fontSize: 12.5,
                        background: "var(--bg-surface)",
                      }}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmittingWf}
              onClick={() => setCreateWfOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmittingWf}>
              Save Workflow Template
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* EDIT WORKFLOW TEMPLATE MODAL */}
      <ModalDialog
        isOpen={editWfOpen}
        onClose={() => !isSubmittingWf && setEditWfOpen(false)}
        title="Edit Workflow Template"
        description="Update stage sequence, approvers, and automated dispatch intervals."
        maxWidth="620px"
      >
        <form onSubmit={handleEditWorkflow} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600 }}>
            <span>Template Name</span>
            <input
              type="text"
              required
              value={wfName}
              onChange={(e) => setWfName(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-light)",
                fontSize: 13,
              }}
            />
          </label>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
              Sequential Approval Stages
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={<Plus size={13} />}
              onClick={handleAddStage}
            >
              Add Stage
            </Button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: "360px", overflowY: "auto", paddingRight: 4 }}>
            {wfStages.map((stage, idx) => (
              <div
                key={idx}
                style={{
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--border-light)",
                  borderRadius: "var(--radius-md)",
                  padding: "14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Badge variant="info">Stage #{idx + 1}</Badge>
                  {wfStages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveStage(idx)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--urgency-rose)",
                        fontSize: 12,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Trash2 size={12} />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600 }}>
                    <span>Primary Approver *</span>
                    <select
                      required
                      value={stage.contactId}
                      onChange={(e) => handleStageChange(idx, "contactId", e.target.value)}
                      style={{
                        padding: "7px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-light)",
                        fontSize: 12.5,
                        background: "var(--bg-surface)",
                      }}
                    >
                      <option value="">Select contact...</option>
                      {activeContacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.email})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600 }}>
                    <span>Backup Approver</span>
                    <select
                      value={stage.backupContactId}
                      onChange={(e) => handleStageChange(idx, "backupContactId", e.target.value)}
                      style={{
                        padding: "7px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-light)",
                        fontSize: 12.5,
                        background: "var(--bg-surface)",
                      }}
                    >
                      <option value="">None (Optional)</option>
                      {activeContacts
                        .filter((c) => c.id !== stage.contactId)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.email})
                          </option>
                        ))}
                    </select>
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600 }}>
                    <span>Reminder Interval (Hours)</span>
                    <input
                      type="number"
                      min={1}
                      max={720}
                      value={stage.reminderIntervalHours}
                      onChange={(e) =>
                        handleStageChange(idx, "reminderIntervalHours", Number(e.target.value))
                      }
                      style={{
                        padding: "6px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-light)",
                        fontSize: 12.5,
                        background: "var(--bg-surface)",
                      }}
                    />
                  </label>

                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600 }}>
                    <span>Max Reminders</span>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={stage.maxReminders}
                      onChange={(e) =>
                        handleStageChange(idx, "maxReminders", Number(e.target.value))
                      }
                      style={{
                        padding: "6px 10px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-light)",
                        fontSize: 12.5,
                        background: "var(--bg-surface)",
                      }}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmittingWf}
              onClick={() => setEditWfOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmittingWf}>
              Save Changes
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* DELETE WORKFLOW CONFIRM MODAL */}
      <ModalDialog
        isOpen={Boolean(deleteWfTarget)}
        onClose={() => !isSubmittingWf && setDeleteWfTarget(null)}
        title="Delete Workflow Template"
        maxWidth="460px"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Are you sure you want to permanently delete the workflow template{" "}
            <strong style={{ color: "var(--text-primary)" }}>&ldquo;{deleteWfTarget?.name}&rdquo;</strong>?
            This action cannot be undone.
          </p>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmittingWf}
              onClick={() => setDeleteWfTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              isLoading={isSubmittingWf}
              onClick={() => void handleDeleteWorkflow()}
            >
              Delete Template
            </Button>
          </div>
        </div>
      </ModalDialog>

      {/* =====================================================================
          MODALS: CONTACTS (CREATE / EDIT / DELETE)
         ===================================================================== */}

      {/* CREATE CONTACT / ADMIN MODAL */}
      <ModalDialog
        isOpen={createContactOpen}
        onClose={() => !isSubmittingContact && setCreateContactOpen(false)}
        title={isModalForAdmin ? "Add Team Administrator" : "Add Approver Contact"}
        description={
          isModalForAdmin
            ? "Register an internal team member or Team Lead with full dashboard login credentials."
            : "Register a designated reviewer who will receive email authorization links. No password required."
        }
        maxWidth="480px"
      >
        <form onSubmit={handleCreateContact} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600 }}>
            <span>Full Name *</span>
            <input
              type="text"
              required
              placeholder={isModalForAdmin ? "e.g. TL Ramesh Kumar" : "e.g. Jeslin, Christy Jenisha"}
              value={contactDraft.name}
              onChange={(e) => setContactDraft((curr) => ({ ...curr, name: e.target.value }))}
              style={{
                padding: "8px 12px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-light)",
                fontSize: 13,
              }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600 }}>
            <span>Email Address *</span>
            <input
              type="email"
              required
              placeholder={isModalForAdmin ? "admin@company.com" : "approver@company.com"}
              value={contactDraft.email}
              onChange={(e) => setContactDraft((curr) => ({ ...curr, email: e.target.value }))}
              style={{
                padding: "8px 12px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-light)",
                fontSize: 13,
              }}
            />
          </label>

          {isModalForAdmin ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600 }}>
              <span>Access Role</span>
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: "var(--radius-md)",
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--border-light)",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--brand-primary)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>👑 Administrator (Full Platform Access)</span>
              </div>
            </div>
          ) : (
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600 }}>
              <span>Approval Level *</span>
              <select
                value={contactDraft.role}
                onChange={(e) => setContactDraft((curr) => ({ ...curr, role: e.target.value }))}
                style={{
                  padding: "8px 12px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-light)",
                  fontSize: 13,
                  background: "var(--bg-surface)",
                }}
              >
                <option value="APPROVER">👤 Primary Approver (Stage 1 Reviewer)</option>
                <option value="BACKUP_APPROVER">🛡️ Backup Approver (Stage 2 Reviewer)</option>
              </select>
            </label>
          )}

          {isModalForAdmin ? (
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <KeyRound size={13} style={{ color: "var(--brand-primary)" }} />
                  <span>Login Password *</span>
                </span>
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)" }}>
                  Min 6 characters
                </span>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  type={showCreatePassword ? "text" : "password"}
                  required
                  placeholder="Assign a secure login password"
                  minLength={6}
                  value={contactDraft.password}
                  onChange={(e) => setContactDraft((curr) => ({ ...curr, password: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "8px 36px 8px 12px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-light)",
                    fontSize: 13,
                    background: "var(--bg-surface)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword((p) => !p)}
                  tabIndex={-1}
                  aria-label={showCreatePassword ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    padding: 4,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {showCreatePassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </label>
          ) : (
            <div
              style={{
                padding: "10px 12px",
                background: "var(--bg-subtle)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-light)",
                fontSize: 12,
                color: "var(--text-secondary)",
                lineHeight: 1.4,
              }}
            >
              💡 <strong>Passwordless Security:</strong> Approvers do not need passwords. When batches require approval, they receive a secure cryptographic 1-click link via email with OTP verification.
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmittingContact}
              onClick={() => setCreateContactOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmittingContact}>
              {isModalForAdmin ? "Create Administrator" : "Add Approver"}
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* EDIT CONTACT / ADMIN MODAL */}
      <ModalDialog
        isOpen={editContactOpen}
        onClose={() => !isSubmittingContact && setEditContactOpen(false)}
        title={isModalForAdmin ? "Edit Administrator" : "Edit Approver Contact"}
        description={
          isModalForAdmin
            ? "Update administrator details or reset their login password."
            : "Update approver name, email, or sequential approval role."
        }
        maxWidth="480px"
      >
        {editingContact && (
          <form onSubmit={handleEditContact} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600 }}>
              <span>Full Name *</span>
              <input
                type="text"
                required
                value={editingContact.name}
                onChange={(e) =>
                  setEditingContact((curr) => (curr ? { ...curr, name: e.target.value } : curr))
                }
                style={{
                  padding: "8px 12px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-light)",
                  fontSize: 13,
                }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600 }}>
              <span>Email Address *</span>
              <input
                type="email"
                required
                value={editingContact.email}
                onChange={(e) =>
                  setEditingContact((curr) => (curr ? { ...curr, email: e.target.value } : curr))
                }
                style={{
                  padding: "8px 12px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-light)",
                  fontSize: 13,
                }}
              />
            </label>

            {!isModalForAdmin && (
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600 }}>
                <span>Approval Role *</span>
                <select
                  value={editingContact.role}
                  onChange={(e) =>
                    setEditingContact((curr) => (curr ? { ...curr, role: e.target.value } : curr))
                  }
                  style={{
                    padding: "8px 12px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-light)",
                    fontSize: 13,
                    background: "var(--bg-surface)",
                  }}
                >
                  <option value="APPROVER">👤 Primary Approver (Stage 1 Reviewer)</option>
                  <option value="BACKUP_APPROVER">🛡️ Backup Approver (Stage 2 Reviewer)</option>
                </select>
              </label>
            )}

            {isModalForAdmin ? (
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <KeyRound size={13} style={{ color: "var(--brand-primary)" }} />
                    <span>Reset Login Password</span>
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)" }}>
                    Leave blank to keep existing password
                  </span>
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    type={showEditPassword ? "text" : "password"}
                    placeholder="Enter new password to update (min 6 chars)"
                    minLength={6}
                    value={editContactPassword}
                    onChange={(e) => setEditContactPassword(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 36px 8px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-light)",
                      fontSize: 13,
                      background: "var(--bg-surface)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword((p) => !p)}
                    tabIndex={-1}
                    aria-label={showEditPassword ? "Hide password" : "Show password"}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      padding: 4,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {showEditPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </label>
            ) : (
              <div
                style={{
                  padding: "10px 12px",
                  background: "var(--bg-subtle)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-light)",
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  lineHeight: 1.4,
                }}
              >
                💡 <strong>Passwordless Approver:</strong> Approvers do not require a login password. They review and authorize bills strictly via secure, time-limited 1-click email authorization links.
              </div>
            )}

            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", marginTop: 4 }}>
              <input
                type="checkbox"
                checked={editingContact.isActive}
                onChange={(e) =>
                  setEditingContact((curr) => (curr ? { ...curr, isActive: e.target.checked } : curr))
                }
                style={{ width: 16, height: 16 }}
              />
              <span>Account is active</span>
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmittingContact}
                onClick={() => setEditContactOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={isSubmittingContact}>
                Save Changes
              </Button>
            </div>
          </form>
        )}
      </ModalDialog>

      {/* DELETE CONTACT CONFIRM MODAL */}
      <ModalDialog
        isOpen={Boolean(deleteContactTarget)}
        onClose={() => !isSubmittingContact && setDeleteContactTarget(null)}
        title={deleteContactTarget?.role === "ADMIN" ? "Delete Administrator" : "Delete Approver Contact"}
        maxWidth="460px"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Are you sure you want to permanently delete the {deleteContactTarget?.role === "ADMIN" ? "administrator" : "approver contact"}{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {deleteContactTarget?.name} ({deleteContactTarget?.email})
            </strong>
            ? This action cannot be undone.
          </p>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmittingContact}
              onClick={() => setDeleteContactTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              isLoading={isSubmittingContact}
              onClick={() => void handleDeleteContact()}
            >
              {deleteContactTarget?.role === "ADMIN" ? "Delete Administrator" : "Delete Approver"}
            </Button>
          </div>
        </div>
      </ModalDialog>
    </div>
  );
}
