"use client";

import { TeamCard } from "./TeamCard";
import { cn } from "@/lib/utils";
import type { GroupLabel, TeamSummary } from "@/lib/types";

interface GroupPredictionPanelProps {
  groupLabel: GroupLabel;
  teams: TeamSummary[];
  selection: [string | null, string | null];   // [teamId1, teamId2]
  onToggle: (teamId: string) => void;
  isComplete: boolean;
}

const groupColors: Record<GroupLabel, { label: string; accent: string }> = {
  A: { label: "Group A", accent: "text-gold-300" },
  B: { label: "Group B", accent: "text-blue-300" },
  C: { label: "Group C", accent: "text-emerald-300" },
  D: { label: "Group D", accent: "text-purple-300" },
};

export function GroupPredictionPanel({
  groupLabel,
  teams,
  selection,
  onToggle,
  isComplete,
}: GroupPredictionPanelProps) {
  const [sel1, sel2] = selection;
  const { label, accent } = groupColors[groupLabel];
  const selectedCount = [sel1, sel2].filter(Boolean).length;

  return (
    <div
      className={cn(
        "rounded-2xl p-5 border transition-all duration-300",
        isComplete
          ? "bg-gold-500/5 border-gold-400/30"
          : "bg-obsidian-800 border-obsidian-700",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center font-playfair font-bold text-lg",
            isComplete
              ? "bg-gold-500 text-obsidian-900"
              : "bg-obsidian-700 text-white/60",
          )}>
            {groupLabel}
          </div>
          <div>
            <h3 className={cn("font-semibold text-white text-base", isComplete && "text-gold-300")}>
              {label}
            </h3>
            <p className="text-xs text-white/40">
              {selectedCount === 0 && "Pick 2 teams to qualify"}
              {selectedCount === 1 && "Pick 1 more team"}
              {selectedCount === 2 && (
                <span className="text-gold-400 font-medium">✓ Complete</span>
              )}
            </p>
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5">
          {[0, 1].map((i) => (
            <div
              key={i}
              className={cn(
                "w-2.5 h-2.5 rounded-full transition-all duration-300",
                (i === 0 && sel1) || (i === 1 && sel2)
                  ? "bg-gold-400 scale-110"
                  : "bg-obsidian-600",
              )}
            />
          ))}
        </div>
      </div>

      {/* Teams grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {teams.map((team) => {
          const isFirst  = team.id === sel1;
          const isSecond = team.id === sel2;
          const isSelected = isFirst || isSecond;
          // Disable unchosen teams once 2 are picked, and teams already knocked out.
          // (A team that is OUT but already selected stays clickable so it can be un-picked.)
          const isOut = team.eliminated === true;
          const isDisabled = !isSelected && (selectedCount >= 2 || isOut);

          return (
            <TeamCard
              key={team.id}
              team={team}
              selected={isSelected}
              selectionOrder={isFirst ? 1 : isSecond ? 2 : undefined}
              onClick={() => onToggle(team.id)}
              disabled={isDisabled}
              compact
            />
          );
        })}
      </div>

      {/* Selection summary row */}
      {selectedCount > 0 && (
        <div className="mt-3 pt-3 border-t border-obsidian-700 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-white/40">Your picks:</span>
          {[sel1, sel2].filter(Boolean).map((id) => {
            const t = teams.find((t) => t.id === id);
            return t ? (
              <span
                key={id}
                className="text-xs font-medium text-gold-300 bg-gold-500/10 px-2 py-0.5 rounded-full border border-gold-500/20"
              >
                {t.name}
              </span>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}
