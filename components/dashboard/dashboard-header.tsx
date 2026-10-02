import { Radio, ShieldHalf } from "lucide-react";
import type { GridState } from "@/lib/types";
import { CapacityGauge } from "./capacity-gauge";

export function DashboardHeader({ data, isError }: { data?: GridState; isError: boolean }) {
  const engineLabel = data?.engine === "fastapi" ? "FastAPI engine" : "Mock engine";
  return (
    <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-6">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldHalf className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">NIMBUS_AEGIS</p>
            <h1 className="text-base leading-tight font-semibold">ReliefMatch Operations</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={
              isError
                ? "inline-flex items-center gap-1.5 rounded-full border border-danger/40 px-2.5 py-1 text-xs text-danger"
                : "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground"
            }
          >
            <Radio className="size-3.5" aria-hidden="true" />
            {isError ? "Feed offline" : `Live · ${engineLabel}`}
          </span>
          <CapacityGauge stock={data?.warehouse_stock} />
        </div>
      </div>
    </header>
  );
}
