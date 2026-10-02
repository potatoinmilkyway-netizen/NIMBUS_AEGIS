import { Warehouse } from "lucide-react";
import { WAREHOUSE_CAPACITY } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CapacityGauge({ stock }: { stock?: Record<string, number> }) {
  const used = stock ? Object.values(stock).reduce((sum, qty) => sum + qty, 0) : 0;
  const remaining = Math.max(WAREHOUSE_CAPACITY - used, 0);
  const usedPct = Math.min((used / WAREHOUSE_CAPACITY) * 100, 100);
  const remainingRatio = remaining / WAREHOUSE_CAPACITY;
  const tone = remainingRatio < 0.15 ? "danger" : remainingRatio < 0.35 ? "warning" : "success";

  const toneClasses = {
    danger: { bar: "bg-danger", text: "text-danger", dot: "bg-danger" },
    warning: { bar: "bg-warning", text: "text-warning", dot: "bg-warning" },
    success: { bar: "bg-success", text: "text-success", dot: "bg-success" },
  }[tone];

  return (
    <div
      className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2"
      role="meter"
      aria-label="Warehouse storage capacity used"
      aria-valuemin={0}
      aria-valuemax={WAREHOUSE_CAPACITY}
      aria-valuenow={used}
      aria-valuetext={`${remaining} of ${WAREHOUSE_CAPACITY} units remaining`}
    >
      <Warehouse className="size-4 text-muted-foreground" aria-hidden="true" />
      <div className="flex min-w-36 flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Storage free</span>
          <span className="font-mono text-xs tabular-nums">
            <span className={cn("font-semibold", toneClasses.text)}>{stock ? remaining : "—"}</span>
            <span className="text-muted-foreground"> / {WAREHOUSE_CAPACITY}</span>
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-[width] duration-700", toneClasses.bar)}
            style={{ width: `${usedPct}%` }}
          />
        </div>
      </div>
      <span className="relative flex size-2" aria-hidden="true">
        <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60", toneClasses.dot)} />
        <span className={cn("relative inline-flex size-2 rounded-full", toneClasses.dot)} />
      </span>
    </div>
  );
}
