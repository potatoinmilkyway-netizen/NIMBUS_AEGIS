import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type PanelProps = {
  title: string;
  description?: string;
  icon: LucideIcon;
  action?: React.ReactNode;
  className?: string;
  tone?: "default" | "alert";
  children: React.ReactNode;
};

export function Panel({ title, description, icon: Icon, action, className, tone = "default", children }: PanelProps) {
  const headingId = `${title.toLowerCase().replace(/\W+/g, "-")}-heading`;
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "flex flex-col rounded-xl border bg-card",
        tone === "alert" && "border-danger/40 shadow-[0_0_0_1px_rgba(248,113,113,0.08),0_8px_32px_-12px_rgba(248,113,113,0.25)]",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-4 border-b px-5 py-4">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md",
              tone === "alert" ? "bg-danger/15 text-danger" : "bg-primary/10 text-primary",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <div>
            <h2 id={headingId} className="text-sm font-semibold text-foreground text-balance">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>}
          </div>
        </div>
        {action}
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </section>
  );
}
