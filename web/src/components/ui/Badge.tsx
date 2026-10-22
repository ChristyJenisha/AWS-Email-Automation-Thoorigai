import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "neutral" | "success" | "warning" | "urgent" | "info";
  icon?: React.ReactNode;
}

export function Badge({
  children,
  variant = "neutral",
  icon,
  className = "",
  ...props
}: BadgeProps) {
  const baseClass = "ui-badge";
  const variantClass = `ui-badge--${variant}`;

  return (
    <span
      className={[baseClass, variantClass, className].filter(Boolean).join(" ")}
      {...props}
    >
      {icon && <span className="ui-badge__icon">{icon}</span>}
      <span className="ui-badge__label">{children}</span>
    </span>
  );
}

