"use client";

import { ArrowLeftRight, CheckCircle2, Loader2, XCircle } from "lucide-react";
import type { Pledge, Recommendation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Panel } from "./panel";

export type ReallocationFeedback = { type: "success" | "error"; message: string } | null;

type ReallocationFormProps = {
  values: { pledge_id: string; to_community: string; qty: string };
  onChange: (values: ReallocationFormProps["values"]) => void;
  onSubmit: (rec: Recommendation) => Promise<void>;
  pledges: Pledge[];
  communities: string[];
  isSubmitting: boolean;
  feedback: ReallocationFeedback;
};

const fieldClass =
  "w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none";

export function ReallocationForm({
  values,
  onChange,
  onSubmit,
  pledges,
  communities,
  isSubmitting,
  feedback,
}: ReallocationFormProps) {
  const selected = pledges.find((p) => p.pledge_id === values.pledge_id);
  const qtyNumber = Number(values.qty);
  const mode = selected && qtyNumber > 0 ? (qtyNumber === selected.qty ? "Shift" : "Split") : null;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({ pledge_id: values.pledge_id, to_community: values.to_community, qty: qtyNumber });
  }

  return (
    <Panel title="Reallocation" description="Shift or split a pledge to another community" icon={ArrowLeftRight}>
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="realloc-pledge" className="text-xs font-medium text-muted-foreground">
            Pledge ID
          </label>
          <select
            id="realloc-pledge"
            required
            value={values.pledge_id}
            onChange={(e) => onChange({ ...values, pledge_id: e.target.value })}
            className={fieldClass}
          >
            <option value="">Select a pledge…</option>
            {pledges.map((p) => (
              <option key={p.pledge_id} value={p.pledge_id}>
                {p.pledge_id} · {p.qty} {p.item} → {p.to_community}
              </option>
            ))}
          </select>
          {selected && (
            <p className="font-mono text-[11px] text-muted-foreground">
              {selected.team} · holds {selected.qty} {selected.item}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="realloc-target" className="text-xs font-medium text-muted-foreground">
            Target community
          </label>
          <select
            id="realloc-target"
            required
            value={values.to_community}
            onChange={(e) => onChange({ ...values, to_community: e.target.value })}
            className={fieldClass}
          >
            <option value="">Select a community…</option>
            {communities.map((c) => (
              <option key={c} value={c} disabled={c === selected?.to_community}>
                {c}
                {c === selected?.to_community ? " (current)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="realloc-qty" className="text-xs font-medium text-muted-foreground">
              Quantity
            </label>
            {mode && (
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase",
                  mode === "Shift" ? "bg-primary/15 text-primary" : "bg-muted text-foreground",
                )}
              >
                {mode}
              </span>
            )}
          </div>
          <input
            id="realloc-qty"
            type="number"
            inputMode="numeric"
            required
            min={1}
            max={selected?.qty}
            step={1}
            value={values.qty}
            onChange={(e) => onChange({ ...values, qty: e.target.value })}
            placeholder="50"
            className={cn(fieldClass, "font-mono")}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-auto inline-flex items-center justify-center gap-2 rounded-md border border-primary/50 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none disabled:opacity-50"
        >
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowLeftRight className="size-4" aria-hidden="true" />
          )}
          {isSubmitting ? "Applying…" : "Apply reallocation"}
        </button>

        <div aria-live="polite">
          {feedback && (
            <p
              className={cn(
                "flex items-start gap-2 rounded-md px-3 py-2 text-xs leading-relaxed",
                feedback.type === "success" ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
              )}
            >
              {feedback.type === "success" ? (
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <XCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              )}
              {feedback.message}
            </p>
          )}
        </div>
      </form>
    </Panel>
  );
}
