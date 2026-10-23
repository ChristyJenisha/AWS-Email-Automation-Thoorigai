import React from "react";

export interface AIGradientBorderProps {
  children: React.ReactNode;
  className?: string;
  variant?: "ai" | "primary" | "urgent" | "warning" | "success" | "info" | "normal";
  duration?: number; // duration in seconds
  enableGlow?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
  role?: string;
  tabIndex?: number;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function AIGradientBorder({
  children,
  className = "",
  variant = "ai",
  duration = 4,
  enableGlow = true,
  style,
  onClick,
  role,
  tabIndex,
  onKeyDown,
}: AIGradientBorderProps) {
  const isClickable = Boolean(onClick);

  return (
    <div
      className={`ai-gradient-border-wrapper ${isClickable ? "ai-gradient-border-wrapper--clickable" : ""} ${className}`}
      style={
        {
          "--ai-spin-duration": `${duration}s`,
          ...style,
        } as React.CSSProperties
      }
      onClick={onClick}
      role={role ?? (isClickable ? "button" : undefined)}
      tabIndex={tabIndex ?? (isClickable ? 0 : undefined)}
      onKeyDown={onKeyDown}
    >
      <div
        className={`ai-gradient-beam ai-gradient-beam--${variant}`}
        aria-hidden="true"
      />
      <div className="ai-gradient-inner-container">
        <div className="ai-gradient-content">{children}</div>
        {enableGlow && (
          <div
            className={`ai-gradient-inner-glow ai-glow-spill-mask ai-gradient-inner-glow--${variant}`}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}

