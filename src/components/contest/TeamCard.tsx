"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import type { TeamSummary } from "@/lib/types";

interface TeamCardProps {
  team: TeamSummary;
  selected?: boolean;
  selectionOrder?: 1 | 2;
  onClick?: () => void;
  disabled?: boolean;
  compact?: boolean;
}

export function TeamCard({
  team,
  selected = false,
  selectionOrder,
  onClick,
  disabled = false,
  compact = false,
}: TeamCardProps) {
  const isClickable = !!onClick && !disabled;

  return (
    <button
      type="button"
      onClick={isClickable ? onClick : undefined}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`${team.name}${selected ? ` — selected as #${selectionOrder}` : ""}`}
      className={cn(
        "relative w-full text-left rounded-2xl transition-all duration-300",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/70",
        compact ? "p-3" : "p-4",
        // Base state
        !selected && "bg-obsidian-800 border border-obsidian-700",
        // Hover (only when clickable and not selected)
        isClickable && !selected && [
          "hover:border-gold-500/40 hover:bg-obsidian-700/80",
          "hover:shadow-[0_0_20px_rgba(212,175,55,0.06)]",
          "cursor-pointer",
        ],
        // Selected state
        selected && [
          "bg-gold-500/10 border-2 border-gold-400/70",
          "shadow-[0_0_30px_rgba(212,175,55,0.12)]",
        ],
        // Disabled state (not selected)
        disabled && !selected && "opacity-35 cursor-not-allowed",
        // Disabled but selected (still shows selection)
        disabled && selected && "cursor-default",
      )}
    >
      {/* Selection badge */}
      {selected && selectionOrder && (
        <div className="absolute -top-2.5 -right-2.5 z-10 w-7 h-7 rounded-full bg-gold-500 text-obsidian-900 flex items-center justify-center text-xs font-bold shadow-gold-glow">
          #{selectionOrder}
        </div>
      )}

      <div className={cn("flex items-center", compact ? "gap-2.5" : "gap-3.5")}>
        {/* Team Logo */}
        <div className={cn(
          "rounded-xl overflow-hidden flex-shrink-0 bg-obsidian-700 flex items-center justify-center",
          compact ? "w-10 h-10" : "w-14 h-14",
        )}>
          {team.logoUrl ? (
            <Image
              src={team.logoUrl}
              alt={`${team.name} logo`}
              width={compact ? 40 : 56}
              height={compact ? 40 : 56}
              className="object-cover w-full h-full"
              unoptimized={team.logoUrl.includes("drive.google.com")}
            />
          ) : (
            <span
              className={cn(
                "font-playfair font-bold text-gold-400",
                compact ? "text-base" : "text-xl",
              )}
              aria-hidden
            >
              {team.name.charAt(0)}
            </span>
          )}
        </div>

        {/* Team Info */}
        <div className="flex-1 min-w-0">
          <p className={cn(
            "font-semibold text-white leading-tight truncate",
            compact ? "text-sm" : "text-base",
          )}>
            {team.name}
          </p>
          {!compact && (
            <p className="text-xs text-white/40 mt-0.5 truncate">
              {team.ownerNames}
            </p>
          )}
          {!compact && team.captainName && (
            <p className="text-xs text-gold-400/70 mt-0.5 truncate">
              ⚡ {team.captainName}
            </p>
          )}
        </div>

        {/* Check icon when selected */}
        {selected && (
          <div className="flex-shrink-0">
            <svg
              className={cn("text-gold-400", compact ? "w-4 h-4" : "w-5 h-5")}
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
      </div>
    </button>
  );
}
