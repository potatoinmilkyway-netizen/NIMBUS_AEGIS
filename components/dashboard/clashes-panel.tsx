"use client";

import { ArrowRight, Loader2, PencilLine, Siren, Sparkles } from "lucide-react";
import { useState } from "react";
import type { Clash, Recommendation } from "@/lib/types";
import { cn, titleCase } from "@/lib/utils";
import { Panel } from "./panel";

type ClashesPanelProps = {
  clashes?: Clash[];
  onApply: (rec: Recommendation) => Promise<void>;
  onEdit: (rec: Recommendation) => void;
};

export function ClashesPanel({ clashes, onApply, onEdit }: ClashesPanelProps) {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const count = clashes?.length ?? 0;

  async function handleApply(key: string, rec: Recommendation) {
    setPendingKey(key);
    try {
      await onApply(rec);
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <Panel
      title="Operational Clashes"
      description="Communities pledged beyond their declared need"
      icon={Siren}
      tone={count > 0 ? "alert" : "default"}
      action={
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-mono text-xs font-semibold tabular-nums",
            count > 0 ? "bg-danger text-background" : "bg-muted text-muted-foreground",
          )}
        >
          {count}
        </span>
      }
    >
      <ul className="flex flex-col gap-3 p-4" aria-live="polite">
        {clashes === undefined && <li className="h-28 animate-pulse rounded-lg bg-muted" />}
        {clashes?.length === 0 && (
          <li className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            No over-pledged communities. All pledges are within need.
          </li>
        )}
        {clashes?.map((clash) => {
          const key = `${clash.community}-${clash.item}`;
          const rec = clash.recommendation;
          const isPending = pendingKey === key;
          return (
            <li key={key} className="rounded-lg border border-danger/25 bg-danger/[0.04] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">
                    {clash.community} <span className="text-muted-foreground">·</span> {titleCase(clash.item)}
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
                    pledged {clash.pledged} / need {clash.need}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider",
                    clash.severity === "HIGH" ? "bg-danger text-background" : "bg-warning text-background",
                  )}
                >
                  {clash.severity}
                </span>
              </div>

              <p className="mt-3 text-sm">
                Over-pledged by <span className="font-mono font-semibold text-danger">+{clash.overage}</span> units
              </p>

              {rec ? (
                <>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-md bg-muted/60 px-3 py-2 font-mono text-xs">
                    <span className="text-primary">{rec.pledge_id}</span>
                    <span className="text-muted-foreground">({rec.qty})</span>
                    <ArrowRight className="size-3 text-muted-foreground" aria-hidden="true" />
                    <span>{rec.to_community}</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleApply(key, rec)}
                      disabled={pendingKey !== null}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none disabled:opacity-60"
                    >
                      {isPending ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Sparkles className="size-3.5" aria-hidden="true" />
                      )}
                      {isPending ? "Reallocating…" : "Apply recommendation"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(rec)}
                      className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                    >
                      <PencilLine className="size-3.5" aria-hidden="true" />
                      <span className="sr-only sm:not-sr-only">Edit</span>
                    </button>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  No safe reallocation target available for this item.
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
