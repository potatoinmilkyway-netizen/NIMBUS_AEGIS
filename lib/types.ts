export type Pledge = {
  pledge_id: string;
  team: string;
  item: string;
  qty: number;
  to_community: string;
};

export type ReliefState = {
  warehouse_stock: Record<string, number>;
  community_needs: Record<string, Record<string, number>>;
  active_pledges: Pledge[];
};

export type ItemBreakdown = {
  need: number;
  pledged: number;
  stock: number;
  gap: number;
};

export type Recommendation = {
  pledge_id: string;
  to_community: string;
  qty: number;
};

export type Clash = {
  item: string;
  community: string;
  need: number;
  pledged: number;
  overage: number;
  severity: "HIGH" | "MEDIUM";
  recommendation: Recommendation | null;
};

export type Engine = "mock" | "fastapi";

export type GridState = ReliefState & {
  gaps: Record<string, number>;
  item_breakdown: Record<string, ItemBreakdown>;
  clashes: Clash[];
  engine?: Engine;
};

export type TriageResponse = {
  extraction: Record<string, number>;
  source: string;
  fallback_reason: string;
  metrics: {
    gaps: Record<string, number>;
    gaps_per_item: Record<string, ItemBreakdown>;
    clashes: Clash[];
  };
  drafted_email: string;
};

export type ReallocationResponse = {
  applied: Recommendation;
  state_after: ReliefState;
  before: { gaps: Record<string, number>; clashes: Clash[] };
  after: { gaps: Record<string, number>; clashes: Clash[]; summary: string };
};

export const WAREHOUSE_CAPACITY = 1500;
