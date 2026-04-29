"use client";

import { SCORING_LABELS } from "@/lib/scoring";
import type { ScoringSystem } from "@/lib/types";

const OPTIONS: ScoringSystem[] = ["ppr", "half_ppr", "standard"];

interface Props {
  value: ScoringSystem;
  onChange: (value: ScoringSystem) => void;
}

export function ScoringToggle({ value, onChange }: Props) {
  return (
    <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 text-sm dark:border-slate-700 dark:bg-slate-900">
      {OPTIONS.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={
              "rounded-full px-4 py-1.5 font-medium transition " +
              (active
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white")
            }
          >
            {SCORING_LABELS[opt]}
          </button>
        );
      })}
    </div>
  );
}
