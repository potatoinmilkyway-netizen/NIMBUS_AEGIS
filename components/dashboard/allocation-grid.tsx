import { LayoutGrid } from "lucide-react";
import type { GridState } from "@/lib/types";
import { cn, titleCase } from "@/lib/utils";
import { Panel } from "./panel";
import { getGridStatus, StatusBadge } from "./status-badge";

export function AllocationGrid({ data, isLoading }: { data?: GridState; isLoading: boolean }) {
  const rows = data ? Object.entries(data.item_breakdown) : [];
  const totalGap = rows.reduce((sum, [, b]) => sum + b.gap, 0);

  return (
    <Panel
      title="Live Allocation Grid"
      description="Gap = max(Need − Pledged − Stock, 0), recomputed every 5s"
      icon={LayoutGrid}
      className="lg:col-span-2"
      action={
        <div className="text-right">
          <p className="text-[10px] tracking-wider text-muted-foreground uppercase">Total gap</p>
          <p className="font-mono text-lg font-semibold tabular-nums text-foreground">{data ? totalGap : "—"}</p>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">Per-item need, pledges, stock and shortfall gap</caption>
          <thead>
            <tr className="border-b text-left text-[11px] tracking-wider text-muted-foreground uppercase">
              <th scope="col" className="px-5 py-2.5 font-medium">Item</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Need</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Pledged</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Stock</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Shortfall gap</th>
              <th scope="col" className="px-5 py-2.5 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td colSpan={6} className="px-5 py-3.5">
                    <div className="h-4 w-full animate-pulse rounded bg-muted" />
                  </td>
                </tr>
              ))}
            {rows.map(([item, b]) => {
              const status = getGridStatus(b);
              const coverage = b.need > 0 ? Math.min(((b.need - b.gap) / b.need) * 100, 100) : 100;
              return (
                <tr key={item} className="border-b transition-colors last:border-0 hover:bg-muted/40">
                  <th scope="row" className="px-5 py-3 text-left font-medium">
                    {titleCase(item)}
                  </th>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{b.need}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-muted-foreground">{b.pledged}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-muted-foreground">{b.stock}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "w-10 text-right font-mono font-semibold tabular-nums",
                          status === "high" && "text-danger",
                          status === "warning" && "text-warning",
                          status === "ok" && "text-muted-foreground",
                        )}
                      >
                        {b.gap}
                      </span>
                      <div
                        className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"
                        aria-label={`${Math.round(coverage)}% of need covered`}
                        role="img"
                      >
                        <div
                          className={cn(
                            "h-full rounded-full",
                            status === "high" ? "bg-danger" : status === "warning" ? "bg-warning" : "bg-success",
                          )}
                          style={{ width: `${coverage}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <StatusBadge status={status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
