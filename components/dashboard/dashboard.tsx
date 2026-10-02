"use client";

import { useState } from "react";
import { postReallocation, useGridState } from "@/lib/api-client";
import type { Recommendation } from "@/lib/types";
import { AllocationGrid } from "./allocation-grid";
import { ClashesPanel } from "./clashes-panel";
import { DashboardHeader } from "./dashboard-header";
import { ReallocationForm, type ReallocationFeedback } from "./reallocation-form";
import { TriagePanel } from "./triage-panel";

const EMPTY_FORM = { pledge_id: "", to_community: "", qty: "" };

export function Dashboard() {
  const { data, error, isLoading, mutate } = useGridState();
  const [formValues, setFormValues] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<ReallocationFeedback>(null);

  async function reallocate(rec: Recommendation) {
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const result = await postReallocation(rec);
      setFeedback({ type: "success", message: result.after.summary });
      setFormValues(EMPTY_FORM);
      await mutate();
    } catch (err) {
      setFeedback({ type: "error", message: err instanceof Error ? err.message : "Reallocation failed." });
    } finally {
      setIsSubmitting(false);
    }
  }

  function loadIntoForm(rec: Recommendation) {
    setFormValues({ pledge_id: rec.pledge_id, to_community: rec.to_community, qty: String(rec.qty) });
    setFeedback(null);
    document.getElementById("realloc-qty")?.focus();
  }

  return (
    <div className="min-h-dvh">
      <DashboardHeader data={data} isError={Boolean(error)} />
      <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 md:px-6">
        {error && (
          <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            Unable to load grid state: {error.message}
          </p>
        )}
        <div className="grid gap-4 lg:grid-cols-3">
          <AllocationGrid data={data} isLoading={isLoading} />
          <ClashesPanel clashes={data?.clashes} onApply={reallocate} onEdit={loadIntoForm} />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <TriagePanel />
          </div>
          <ReallocationForm
            values={formValues}
            onChange={setFormValues}
            onSubmit={reallocate}
            pledges={data?.active_pledges ?? []}
            communities={data ? Object.keys(data.community_needs) : []}
            isSubmitting={isSubmitting}
            feedback={feedback}
          />
        </div>
      </main>
    </div>
  );
}
