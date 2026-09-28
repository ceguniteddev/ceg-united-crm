import type { PrioritySignal, PriorityType } from "../types/crm";

export const PRIORITY_WEIGHTS: Record<PriorityType, number> = {
  overdue_payment: 40,
  high_priority: 35,
  missed_call: 30,
  overdue_task: 30,
  unanswered: 25,
  new_lead: 20,
  buying_interest: 15,
};

export const PRIORITY_LABELS: Record<PriorityType, string> = {
  overdue_payment: "Overdue payment",
  high_priority: "High priority",
  missed_call: "Missed call",
  overdue_task: "Overdue task",
  unanswered: "Unanswered message",
  new_lead: "New lead",
  buying_interest: "Buying interest",
};

export const PRIORITY_ORDER: PriorityType[] = [
  "overdue_payment",
  "high_priority",
  "missed_call",
  "overdue_task",
  "unanswered",
  "buying_interest",
  "new_lead",
];

/** Score = sum of unique signal-type weights, capped at 100. */
export function scoreSignals(signals: PrioritySignal[]): number {
  const types = new Set(signals.map((s) => s.type));
  let total = 0;
  for (const t of types) total += PRIORITY_WEIGHTS[t] ?? 0;
  return Math.min(100, total);
}

/** Sort: score desc, then oldest signal first (waited longest). */
export function comparePriority(
  a: { score: number; signals: PrioritySignal[] },
  b: { score: number; signals: PrioritySignal[] },
): number {
  if (b.score !== a.score) return b.score - a.score;
  const oldest = (x: { signals: PrioritySignal[] }) =>
    x.signals.reduce((m, s) => (s.since < m ? s.since : m), "9999");
  return oldest(a) < oldest(b) ? -1 : 1;
}
