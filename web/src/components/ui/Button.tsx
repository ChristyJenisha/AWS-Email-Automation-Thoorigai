import React, { forwardRef } from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "destructive" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      className = "",
      disabled,
      ...props
    },
    ref
  ) => {
    const baseClass = "ui-button";
    const variantClass = `ui-button--${variant}`;
    const sizeClass = `ui-button--${size}`;
    const loadingClass = isLoading ? "ui-button--loading" : "";

    return (
      <button
        ref={ref}
        className={[baseClass, variantClass, sizeClass, loadingClass, className]
          .filter(Boolean)
          .join(" ")}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="ui-button__spinner" size={16} />}
        {!isLoading && leftIcon && <span className="ui-button__icon-left">{leftIcon}</span>}
        <span className="ui-button__text">{children}</span>
        {!isLoading && rightIcon && <span className="ui-button__icon-right">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";

