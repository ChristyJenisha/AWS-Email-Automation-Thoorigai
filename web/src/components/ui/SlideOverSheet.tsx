"use client";

import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

export interface SlideOverSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  width?: string;
}

export function SlideOverSheet({
  isOpen,
  onClose,
  title,
  description,
  children,
  width = "480px",
}: SlideOverSheetProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="ui-sheet-overlay" />
        <Dialog.Content
          className="ui-sheet-content"
          style={{ width, maxWidth: "100vw" }}
        >
          <div className="ui-sheet-header">
            <div>
              <Dialog.Title className="ui-sheet-title">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="ui-sheet-description">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <button className="ui-sheet-close" aria-label="Close panel">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>
          <div className="ui-sheet-body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
