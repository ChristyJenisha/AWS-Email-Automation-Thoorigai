import React from "react";
import { AIGradientBorder } from "./AIGradientBorder";

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  urgency?: "normal" | "warning" | "urgent" | "success" | "primary" | "info";
  onClick?: () => void;
  enableAIBorder?: boolean;
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  badge,
  urgency = "normal",
  onClick,
  enableAIBorder = true,
}: MetricCardProps) {
  const isClickable = Boolean(onClick);

  const cardContent = (
    <div
      className={`ui-metric-card ui-metric-card--${urgency} ${
        isClickable ? "ui-metric-card--clickable" : ""
      } ${enableAIBorder ? "ui-metric-card--ai-nested" : ""}`}
      onClick={enableAIBorder ? undefined : onClick}
      role={!enableAIBorder && isClickable ? "button" : undefined}
      tabIndex={!enableAIBorder && isClickable ? 0 : undefined}
      onKeyDown={
        !enableAIBorder && isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <div className="ui-metric-card__top">
        {icon && (
          <div className={`ui-metric-card__icon-box ui-metric-card__icon-box--${urgency}`}>
            {icon}
          </div>
        )}
        <div className="ui-metric-card__info">
          <div className="ui-metric-card__title">{title}</div>
          <div className="ui-metric-card__value">{value}</div>
        </div>
      </div>

      {(subtitle || badge) && (
        <div className="ui-metric-card__footer">
          {subtitle ? <span>{subtitle}</span> : <span />}
          {badge && <div>{badge}</div>}
        </div>
      )}
    </div>
  );

  if (enableAIBorder) {
    return (
      <AIGradientBorder
        variant={urgency}
        className={`ui-metric-card-wrapper ${isClickable ? "ui-metric-card--clickable" : ""}`}
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
        {cardContent}
      </AIGradientBorder>
    );
  }

  return cardContent;
}

