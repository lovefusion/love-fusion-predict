"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "gold" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "xl";
  loading?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
  gold: [
    "bg-gold-500 text-obsidian-900 font-semibold",
    "hover:bg-gold-400 active:bg-gold-600",
    "shadow-gold-glow hover:shadow-gold-strong",
    "border border-gold-400",
  ].join(" "),
  outline: [
    "bg-transparent text-gold-400 font-semibold",
    "border border-gold-500/40 hover:border-gold-400",
    "hover:bg-gold-500/8 hover:text-gold-300",
  ].join(" "),
  ghost: [
    "bg-transparent text-white/70 font-medium",
    "hover:text-white hover:bg-white/5",
    "border border-transparent",
  ].join(" "),
  danger: [
    "bg-red-800/80 text-white font-semibold",
    "border border-red-700 hover:bg-red-700",
  ].join(" "),
};

const sizeStyles: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "px-3 py-1.5 text-sm rounded-lg gap-1.5",
  md: "px-5 py-2.5 text-base rounded-xl gap-2",
  lg: "px-7 py-3.5 text-lg rounded-xl gap-2.5",
  xl: "px-10 py-5 text-xl rounded-2xl gap-3",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "gold", size = "md", loading, disabled, className, children, ...props }, ref) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          "inline-flex items-center justify-center",
          "transition-all duration-200 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian-900",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none",
          "select-none cursor-pointer",
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...props}
      >
        {loading ? (
          <>
            <svg
              className="animate-spin h-4 w-4 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <circle
                className="opacity-25"
                cx="12" cy="12" r="10"
                stroke="currentColor" strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span>Processing…</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);

Button.displayName = "Button";
