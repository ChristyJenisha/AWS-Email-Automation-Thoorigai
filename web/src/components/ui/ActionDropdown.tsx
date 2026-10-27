"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";

export interface ActionDropdownItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
}

const emptySubscribe = () => () => {};

export function ActionDropdown({
  items,
  triggerLabel,
  align = "right",
}: {
  items: ActionDropdownItem[];
  triggerLabel?: string;
  align?: "left" | "right";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const mounted = React.useSyncExternalStore(emptySubscribe, () => true, () => false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
    openUpward: boolean;
  }>({ openUpward: false });

  const activeItems = items.filter((i) => !i.disabled);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuEstimatedHeight = activeItems.length * 38 + 16;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Flip upward if space below is tighter than estimated menu height
    const openUpward = spaceBelow < menuEstimatedHeight && spaceAbove > spaceBelow;

    if (openUpward) {
      setCoords({
        bottom: Math.max(8, window.innerHeight - rect.top + 6),
        left: align === "left" ? Math.max(8, rect.left) : undefined,
        right: align === "right" ? Math.max(8, window.innerWidth - rect.right) : undefined,
        openUpward: true,
      });
    } else {
      setCoords({
        top: Math.max(8, rect.bottom + 6),
        left: align === "left" ? Math.max(8, rect.left) : undefined,
        right: align === "right" ? Math.max(8, window.innerWidth - rect.right) : undefined,
        openUpward: false,
      });
    }
  }, [activeItems.length, align]);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      updatePosition();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  if (activeItems.length === 0) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          updatePosition();
          setIsOpen((prev) => !prev);
        }}
        className="ui-action-menu-trigger"
        aria-expanded={isOpen}
        aria-haspopup="true"
        title={triggerLabel || "More actions"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: 6,
          border: "1px solid var(--border-light)",
          background: isOpen ? "var(--bg-subtle)" : "var(--bg-surface)",
          color: isOpen ? "var(--text-primary)" : "var(--text-secondary)",
          cursor: "pointer",
          transition: "all 120ms ease",
        }}
      >
        <MoreHorizontal size={15} />
      </button>

      {isOpen &&
        mounted &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="ui-action-menu-dropdown"
            style={{
              position: "fixed",
              top: coords.top !== undefined ? `${coords.top}px` : "auto",
              bottom: coords.bottom !== undefined ? `${coords.bottom}px` : "auto",
              left: coords.left !== undefined ? `${coords.left}px` : "auto",
              right: coords.right !== undefined ? `${coords.right}px` : "auto",
              minWidth: 190,
              background: "var(--bg-surface)",
              border: "1px solid var(--border-light)",
              borderRadius: 8,
              boxShadow: "0 12px 28px -4px rgba(0, 0, 0, 0.45), 0 8px 12px -6px rgba(0, 0, 0, 0.25)",
              padding: "5px",
              zIndex: 99999,
            }}
          >
            {activeItems.map((item, idx) => (
              <button
                key={idx}
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  item.onClick();
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: "transparent",
                  color: item.variant === "danger" ? "var(--urgency-rose)" : "var(--text-primary)",
                  fontSize: 12.5,
                  fontWeight: 500,
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "background 100ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    item.variant === "danger" ? "var(--urgency-rose-bg)" : "var(--bg-subtle)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {item.icon && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      color: item.variant === "danger" ? "var(--urgency-rose)" : "var(--text-muted)",
                    }}
                  >
                    {item.icon}
                  </span>
                )}
                <span>{item.label}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
