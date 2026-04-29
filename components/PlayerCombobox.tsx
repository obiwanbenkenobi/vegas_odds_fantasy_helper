"use client";

import { useMemo, useState } from "react";
import type { Player } from "@/lib/types";

interface Props {
  label: string;
  players: Player[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  excludeId?: string | null;
}

export function PlayerCombobox({
  label,
  players,
  selectedId,
  onSelect,
  excludeId,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => players.find((p) => p.id === selectedId) ?? null,
    [players, selectedId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players
      .filter((p) => p.id !== excludeId)
      .filter((p) =>
        q.length === 0
          ? true
          : p.name.toLowerCase().includes(q) ||
            p.team.toLowerCase().includes(q) ||
            p.position.toLowerCase() === q,
      )
      .slice(0, 12);
  }, [players, query, excludeId]);

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </label>

      {selected ? (
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
          <div>
            <div className="text-lg font-semibold">{selected.name}</div>
            <div className="text-xs text-slate-500">
              {selected.position} · {selected.team}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              setQuery("");
            }}
            className="text-xs text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline dark:hover:text-slate-100"
          >
            Change
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={query}
            placeholder="Search by name, team, or position..."
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-base outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900"
          />
          {open && filtered.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
              {filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onSelect(p.id);
                      setQuery("");
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-slate-500">
                      {p.position} · {p.team}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
