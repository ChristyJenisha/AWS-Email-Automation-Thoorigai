"use client";

import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

export interface ModalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export function ModalDialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = "520px",
}: ModalDialogProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="ui-dialog-overlay" />
        <Dialog.Content
          className="ui-dialog-content"
          style={{ maxWidth }}
          aria-describedby={description ? undefined : undefined}
        >
          <div className="ui-dialog-header">
            <div>
              <Dialog.Title className="ui-dialog-title">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="ui-dialog-description">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <button className="ui-dialog-close" aria-label="Close dialog">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>
          <div className="ui-dialog-body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
