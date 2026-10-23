"use client";

import React, { useState, useRef, useEffect } from "react";
import { MoreHorizontal } from "lucide-react";

export interface ActionDropdownItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
}

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
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const activeItems = items.filter((i) => !i.disabled);
  if (activeItems.length === 0) return null;

  return (
    <div
      ref={menuRef}
      style={{
        position: "relative",
        display: "inline-block",
        textAlign: "left",
      }}
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
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
          background: "var(--bg-surface)",
          color: "var(--text-secondary)",
          cursor: "pointer",
          transition: "all 120ms ease",
        }}
      >
        <MoreHorizontal size={15} />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="ui-action-menu-dropdown"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: align === "right" ? 0 : "auto",
            left: align === "left" ? 0 : "auto",
            minWidth: 180,
            background: "var(--bg-surface)",
            border: "1px solid var(--border-light)",
            borderRadius: 8,
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.2)",
            padding: "4px",
            zIndex: 60,
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
        </div>
      )}
    </div>
  );
}

