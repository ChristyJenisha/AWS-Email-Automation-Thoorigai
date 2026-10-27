"use client";

import React, { FormEvent, useState } from "react";
import { KeyRound, Eye, EyeOff, Trash2 } from "lucide-react";
import { ModalDialog, Button } from "../ui";
import { ContactRecord } from "../../types";

export interface ContactDraft {
  name: string;
  email: string;
  role: string;
  password: string;
}

interface ContactModalsProps {
  createContactOpen: boolean;
  setCreateContactOpen: (open: boolean) => void;
  editContactOpen: boolean;
  setEditContactOpen: (open: boolean) => void;
  deleteContactTarget: ContactRecord | null;
  setDeleteContactTarget: (target: ContactRecord | null) => void;
  editingContact: ContactRecord | null;
  setEditingContact: React.Dispatch<React.SetStateAction<ContactRecord | null>>;
  contactDraft: ContactDraft;
  setContactDraft: React.Dispatch<React.SetStateAction<ContactDraft>>;
  isModalForAdmin: boolean;
  isAdmin: boolean;
  editContactPassword: string;
  setEditContactPassword: (pw: string) => void;
  isSubmittingContact: boolean;
  handleCreateContact: (e: FormEvent) => Promise<void>;
  handleEditContact: (e: FormEvent) => Promise<void>;
  handleDeleteContact: () => Promise<void>;
}

export function ContactModals({
  createContactOpen,
  setCreateContactOpen,
  editContactOpen,
  setEditContactOpen,
  deleteContactTarget,
  setDeleteContactTarget,
  editingContact,
  setEditingContact,
  contactDraft,
  setContactDraft,
  isModalForAdmin,
  isAdmin,
  editContactPassword,
  setEditContactPassword,
  isSubmittingContact,
  handleCreateContact,
  handleEditContact,
  handleDeleteContact,
}: ContactModalsProps) {
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  return (
    <>
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

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 14 }}>
              {isAdmin && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={isSubmittingContact}
                  leftIcon={<Trash2 size={13} />}
                  onClick={() => {
                    const target = editingContact;
                    setEditContactOpen(false);
                    setDeleteContactTarget(target);
                  }}
                >
                  Delete {isModalForAdmin ? "Administrator" : "Approver"}
                </Button>
              )}

              <div style={{ display: "flex", gap: 10, marginLeft: "auto" }}>
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
    </>
  );
}
