import * as React from "react";
import { cn } from "@/lib/utils";

const sizeMap = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-8 w-8" };

export function Spinner({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  return (
    <svg
      className={cn("animate-spin text-gold-400", sizeMap[size], className)}
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
      role="status"
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
  );
}

export function LoadingPage({ message = "Loading…" }: { message?: string }) {
  return (
    <div className="min-h-screen bg-obsidian-900 flex items-center justify-center flex-col gap-4">
      <Spinner className="h-8 w-8" />
      <p className="text-white/50 text-sm">{message}</p>
    </div>
  );
}
