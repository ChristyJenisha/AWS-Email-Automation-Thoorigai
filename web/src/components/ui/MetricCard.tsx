import React from "react";

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  urgency?: "normal" | "warning" | "urgent" | "success";
  onClick?: () => void;
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  badge,
  urgency = "normal",
  onClick,
}: MetricCardProps) {
  const isClickable = Boolean(onClick);

  return (
    <div
      className={`ui-metric-card ui-metric-card--${urgency} ${
        isClickable ? "ui-metric-card--clickable" : ""
      }`}
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <div className="ui-metric-card__header">
        <span className="ui-metric-card__title">{title}</span>
        {icon && <span className="ui-metric-card__icon">{icon}</span>}
      </div>

      <div className="ui-metric-card__value-row">
        <span className="ui-metric-card__value">{value}</span>
        {badge && <div className="ui-metric-card__badge">{badge}</div>}
      </div>

      {subtitle && <p className="ui-metric-card__subtitle">{subtitle}</p>}
    </div>
  );
}
