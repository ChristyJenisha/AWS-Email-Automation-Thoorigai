"use client";

import React, { useState, FormEvent } from "react";
import { X, Zap, UserPlus, Save, Check, Trash2, AlertCircle, CheckCircle2, Crown } from "lucide-react";
import { AppUser, ContactRecord } from "../../types";

type ContactsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  contacts: ContactRecord[];
  setContacts: React.Dispatch<React.SetStateAction<ContactRecord[]>>;
  currentUser: AppUser | null;
  contactDraft: { name: string; email: string; role: string };
  setContactDraft: (draft: { name: string; email: string; role: string }) => void;
  isSavingContact: boolean;
  onSaveContact: (contact: ContactRecord) => Promise<void>;
  onDeleteContact: (contact: ContactRecord) => Promise<void>;
  onCreateContact: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  onBuildWorkflowWithContact: (contact: ContactRecord) => void;
  onSwitchToAdmin?: () => void;
};

export function ContactsModal({
  isOpen,
  onClose,
  contacts,
  setContacts,
  currentUser,
  contactDraft,
  setContactDraft,
  isSavingContact,
  onSaveContact,
  onDeleteContact,
  onCreateContact,
  onBuildWorkflowWithContact,
  onSwitchToAdmin,
}: ContactsModalProps) {
  const [modalNotice, setModalNotice] = useState<{ type: "error" | "success"; message: string } | null>(null);

  if (!isOpen) return null;

  const handleDelete = async (contact: ContactRecord) => {
    setModalNotice(null);
    try {
      await onDeleteContact(contact);
      setModalNotice({ type: "success", message: `Contact "${contact.name || contact.email}" deleted successfully.` });
    } catch (err) {
      setModalNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Unable to delete this contact.",
      });
    }
  };

  const handleSave = async (contact: ContactRecord) => {
    setModalNotice(null);
    try {
      await onSaveContact(contact);
      setModalNotice({ type: "success", message: `Contact "${contact.name || contact.email}" updated successfully.` });
    } catch (err) {
      setModalNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Unable to update this contact.",
      });
    }
  };

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setModalNotice(null);
    try {
      await onCreateContact(e);
      setModalNotice({ type: "success", message: "Contact added successfully! They are now available to use in Workflow Templates." });
    } catch (err) {
      setModalNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Unable to add this contact.",
      });
    }
  };

  const isNotAdmin = currentUser?.role?.toLowerCase() !== "admin";

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSavingContact) onClose();
      }}
    >
      <section
        className="bill-dialog contacts-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contacts-dialog-title"
      >
        <div className="dialog-heading">
          <div>
            <p className="eyebrow">{currentUser?.organizationId ?? "ORGANIZATION"}</p>
            <h2 id="contacts-dialog-title">Approver contacts</h2>
          </div>
          <button
            className="dialog-close"
            type="button"
            onClick={onClose}
            disabled={isSavingContact}
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        {isNotAdmin && !modalNotice && (
          <div style={{ background: "var(--urgency-amber-bg)", border: "1px solid var(--urgency-amber-border)", borderRadius: 8, padding: "10px 14px", margin: "0 0 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div style={{ fontSize: "0.85rem", color: "var(--urgency-amber-text)" }}>
              Viewing in <strong>{currentUser?.role ?? "Approver"}</strong> mode. Administrator role is required to add, edit, or delete contacts.
            </div>
            {onSwitchToAdmin && (
              <button
                type="button"
                onClick={() => {
                  onSwitchToAdmin();
                  setModalNotice({ type: "success", message: "Switched to Administrator role! You can now manage contacts." });
                }}
                style={{ fontSize: "0.8rem", fontWeight: 600, padding: "5px 12px", background: "var(--urgency-amber)", color: "var(--text-inverse)", border: "none", borderRadius: 5, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}
              >
                <Crown size={13} />
                <span>Switch to Admin</span>
              </button>
            )}
          </div>
        )}

        {modalNotice && (
          <div className={`contact-modal-notice ${modalNotice.type}`} role="alert">
            {modalNotice.type === "error" ? (
              <AlertCircle size={16} className="notice-icon" />
            ) : (
              <CheckCircle2 size={16} className="notice-icon" />
            )}
            <div className="notice-content">
              <strong>{modalNotice.type === "error" ? "Action Blocked" : "Success"}</strong>
              <p>{modalNotice.message}</p>
              {modalNotice.message.includes("Administrator access is required") && onSwitchToAdmin && (
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 14px",
                      background: "var(--urgency-rose)",
                      color: "var(--text-inverse)",
                      border: "none",
                      borderRadius: 6,
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      onSwitchToAdmin();
                      setModalNotice({ type: "success", message: "Switched to Administrator role! You can now save or delete contacts." });
                    }}
                  >
                    <Crown size={14} />
                    <span>👑 Switch to Admin Role &amp; Retry</span>
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              className="notice-close-btn"
              onClick={() => setModalNotice(null)}
              aria-label="Dismiss notice"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="contacts-modal-scrollable">
          <div className="contacts-list">
          {contacts.map((contact) => (
            <div className="contact-row" key={contact.id}>
              <div className="contact-row-header">
                <strong>{contact.name || "Approver Contact"}</strong>
                <button
                  type="button"
                  className="quick-wf-btn"
                  onClick={() => onBuildWorkflowWithContact(contact)}
                  title={`Create a workflow template using ${contact.name || "this contact"}`}
                >
                  <Zap size={12} />
                  <span>Build Workflow with {contact.name ? contact.name.split(" ")[0] : "Approver"}</span>
                </button>
              </div>

              <div className="form-two-columns">
                <label>
                  Full Name
                  <input
                    type="text"
                    required
                    value={contact.name}
                    placeholder="e.g. Jenisha Christy"
                    onChange={(event) =>
                      setContacts((current) =>
                        current.map((item) =>
                          item.id === contact.id ? { ...item, name: event.target.value } : item
                        )
                      )
                    }
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    required
                    value={contact.email}
                    placeholder="e.g. name@company.com"
                    onChange={(event) =>
                      setContacts((current) =>
                        current.map((item) =>
                          item.id === contact.id ? { ...item, email: event.target.value } : item
                        )
                      )
                    }
                  />
                </label>
              </div>

              <div className="contact-edit-footer">
                <label>
                  Role
                  <select
                    value={contact.role}
                    onChange={(event) =>
                      setContacts((current) =>
                        current.map((item) =>
                          item.id === contact.id ? { ...item, role: event.target.value } : item
                        )
                      )
                    }
                  >
                    <option value="APPROVER">👤 Approver</option>
                    <option value="BACKUP_APPROVER">🛡️ Backup Approver</option>
                    <option value="ADMIN">👑 Admin</option>
                  </select>
                </label>
                <label className="contact-active">
                  <input
                    type="checkbox"
                    checked={contact.isActive}
                    onChange={(event) =>
                      setContacts((current) =>
                        current.map((item) =>
                          item.id === contact.id ? { ...item, isActive: event.target.checked } : item
                        )
                      )
                    }
                  />{" "}
                  Active
                </label>
                <button
                  className="secondary-button save-contact-btn"
                  type="button"
                  disabled={isSavingContact}
                  onClick={() => void handleSave(contact)}
                >
                  <Save size={12} />
                  <span>Save</span>
                </button>
                <button
                  className="contact-delete-btn"
                  type="button"
                  disabled={isSavingContact}
                  onClick={() => void handleDelete(contact)}
                  title={`Delete ${contact.name || "contact"}`}
                >
                  <Trash2 size={12} />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        <form className="contact-create-form" onSubmit={handleCreate}>
          <p className="section-kicker">ADD CONTACT</p>
          <div className="contact-new-fields">
            <label>
              Name
              <input
                required
                maxLength={120}
                value={contactDraft.name}
                onChange={(event) =>
                  setContactDraft({ ...contactDraft, name: event.target.value })
                }
              />
            </label>
            <label>
              Email
              <input
                type="email"
                required
                value={contactDraft.email}
                onChange={(event) =>
                  setContactDraft({ ...contactDraft, email: event.target.value })
                }
              />
            </label>
            <label>
              Role
              <select
                value={contactDraft.role}
                onChange={(event) =>
                  setContactDraft({ ...contactDraft, role: event.target.value })
                }
              >
                <option value="APPROVER">👤 Approver</option>
                <option value="BACKUP_APPROVER">🛡️ Backup Approver</option>
                <option value="ADMIN">👑 Admin</option>
              </select>
            </label>
          </div>
          <div className="dialog-actions">
            <button
              className="secondary-button"
              type="button"
              disabled={isSavingContact}
              onClick={onClose}
            >
              Close
            </button>
            <button className="primary-button" type="submit" disabled={isSavingContact}>
              <UserPlus size={14} />
              <span>{isSavingContact ? "Saving..." : "Add contact"}</span>
            </button>
          </div>
        </form>
      </div>
    </section>
  </div>
  );
}

