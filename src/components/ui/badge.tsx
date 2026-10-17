import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "gold" | "white" | "subtle" | "success" | "warning" | "error";
}

const variantStyles: Record<NonNullable<BadgeProps["variant"]>, string> = {
  gold:    "bg-gold-500/20 text-gold-300 border border-gold-500/30",
  white:   "bg-white/10 text-white border border-white/20",
  subtle:  "bg-obsidian-700 text-white/60 border border-obsidian-600",
  success: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
  warning: "bg-amber-500/15 text-amber-400 border border-amber-500/25",
  error:   "bg-red-500/15 text-red-400 border border-red-500/25",
};

export function Badge({ variant = "subtle", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium",
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  );
}
