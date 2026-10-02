"use client";

import { Check, Copy, Inbox, Loader2, Play } from "lucide-react";
import { useState } from "react";
import { postTriage } from "@/lib/api-client";
import type { TriageResponse } from "@/lib/types";
import { cn, titleCase } from "@/lib/utils";
import { Panel } from "./panel";

const SAMPLE_OFFER =
  "Hi ReliefMatch, Team Gamma here. We can deliver 120 notebooks, 40 hygiene kits and 25 pencil boxes to the depot by Friday.";

const inputClass =
  "w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none";

export function TriagePanel() {
  const [text, setText] = useState("");
  const [team, setTeam] = useState("");
  const [result, setResult] = useState<TriageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim()) return;
    setIsRunning(true);
    setError(null);
    try {
      setResult(await postTriage(text.trim(), team.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Triage failed.");
    } finally {
      setIsRunning(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(result.drafted_email);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const extracted = result ? Object.entries(result.extraction) : [];

  return (
    <Panel
      title="Inbound Offer Triage"
      description="Paste a donor message to extract quantities and draft a response"
      icon={Inbox}
    >
      <div className="grid flex-1 gap-0 md:grid-cols-2">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 border-b p-5 md:border-r md:border-b-0">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="offer-text" className="text-xs font-medium text-muted-foreground">
                Donor offer message
              </label>
              <button
                type="button"
                onClick={() => setText(SAMPLE_OFFER)}
                className="text-xs text-primary hover:underline focus-visible:underline focus-visible:outline-none"
              >
                Use sample
              </button>
            </div>
            <textarea
              id="offer-text"
              required
              rows={6}
              maxLength={10000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. We can send 200 notebooks and 50 blankets next week…"
              className={cn(inputClass, "resize-y leading-relaxed")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="offer-team" className="text-xs font-medium text-muted-foreground">
              Team / Donor name <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <input
              id="offer-team"
              value={team}
              maxLength={120}
              onChange={(e) => setTeam(e.target.value)}
              placeholder="Team Gamma"
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={isRunning || !text.trim()}
            className="mt-auto inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRunning ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
            {isRunning ? "Running triage…" : "Run Triage"}
          </button>
          {error && (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          )}
        </form>

        <div className="flex min-w-0 flex-col gap-4 p-5" aria-live="polite">
          {!result ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center">
              <Inbox className="size-5 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">Triage output will appear here.</p>
            </div>
          ) : (
            <>
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-xs font-medium text-muted-foreground">Extracted quantities</h3>
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {result.source}
                  </span>
                </div>
                {extracted.length === 0 ? (
                  <p className="text-sm text-warning">No item quantities detected.</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {extracted.map(([item, qty]) => {
                      const gap = result.metrics.gaps[item] ?? 0;
                      return (
                        <li
                          key={item}
                          className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 py-1 pr-1 pl-3 text-xs"
                        >
                          <span className="font-mono font-semibold text-primary tabular-nums">{qty}</span>
                          <span>{titleCase(item)}</span>
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 font-mono text-[10px]",
                              gap > 0 ? "bg-danger/15 text-danger" : "bg-success/15 text-success",
                            )}
                            title="Current shortfall gap"
                          >
                            gap {gap}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-medium text-muted-foreground">Drafted response email</h3>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  >
                    {copied ? <Check className="size-3.5 text-success" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre className="max-h-72 overflow-auto rounded-lg border bg-background p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground/90">
                  <code>{result.drafted_email}</code>
                </pre>
              </div>
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}
