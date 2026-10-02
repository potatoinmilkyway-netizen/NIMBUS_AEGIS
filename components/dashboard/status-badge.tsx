import { AlertTriangle, CheckCircle2, OctagonAlert } from "lucide-react";
import type { ItemBreakdown } from "@/lib/types";
import { cn } from "@/lib/utils";

export type GridStatus = "ok" | "warning" | "high";

export function getGridStatus({ gap, need }: ItemBreakdown): GridStatus {
  if (gap === 0) return "ok";
  return need > 0 && gap / need >= 0.5 ? "high" : "warning";
}

const STATUS_CONFIG = {
  ok: { label: "OK", icon: CheckCircle2, className: "bg-success/10 text-success ring-success/25" },
  warning: { label: "Warning", icon: AlertTriangle, className: "bg-warning/10 text-warning ring-warning/25" },
  high: { label: "High Gap", icon: OctagonAlert, className: "bg-danger/10 text-danger ring-danger/30" },
} as const;

export function StatusBadge({ status }: { status: GridStatus }) {
  const { label, icon: Icon, className } = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap",
        className,
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </span>
  );
}
