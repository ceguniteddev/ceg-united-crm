"use client";

import React, { useEffect, useState } from "react";
import { fetchClientDisputesAction } from "../actions/crm";
import { ShieldCheck, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";

export function DisputesCard({ brainUid }: { brainUid?: string }) {
  const [lines, setLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!brainUid) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    const loadDisputes = async () => {
      try {
        const combined = await fetchClientDisputesAction(brainUid);
        if (isMounted) {
          setLines(combined);
          setLoading(false);
        }
      } catch (err) {
        console.error("Error loading dispute lines:", err);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadDisputes();
    const interval = setInterval(loadDisputes, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [brainUid]);

  const resolvedCount = lines.filter((l) => l.stage === "S7_RESOLVED" || l.outcomeCode === "R01").length;
  const violationCount = lines.filter((l) => l.outcomeCode === "V-CLEAR" || l.violationConfirmed).length;

  return (
    <section className="card wide" style={{ marginTop: "16px" }}>
      <div
        className="card-head"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          paddingBottom: "10px",
          marginBottom: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <ShieldCheck style={{ width: "16px", height: "16px", color: "#3b82f6" }} />
          <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#f8fafc" }}>
            Credit Repair (Dispute Engine v3)
          </h3>
        </div>
        {violationCount > 0 && (
          <span
            style={{
              background: "rgba(239, 68, 68, 0.15)",
              color: "#f87171",
              padding: "2px 8px",
              borderRadius: "12px",
              fontSize: "11px",
              fontWeight: 700,
            }}
          >
            {violationCount} FCRA Violation (V-CLEAR)
          </span>
        )}
      </div>

      {!brainUid ? (
        <div style={{ fontSize: "12px", color: "#64748b" }}>
          No linked Client App UID (brainUid) found.
        </div>
      ) : loading ? (
        <div style={{ fontSize: "12px", color: "#64748b" }}>Loading dispute matrix…</div>
      ) : lines.length === 0 ? (
        <div style={{ fontSize: "12px", color: "#64748b" }}>
          No active credit bureau disputes logged.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "8px",
            }}
          >
            {lines.map((l) => (
              <div
                key={l.id}
                style={{
                  background: "rgba(30, 41, 59, 0.5)",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  border: "1px solid rgba(255,255,255,0.05)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <b style={{ fontSize: "12px", color: "#f8fafc" }}>{l.creditor}</b>
                  <span
                    style={{
                      fontSize: "10px",
                      textTransform: "uppercase",
                      padding: "1px 5px",
                      borderRadius: "3px",
                      background: "rgba(255,255,255,0.08)",
                      color: "#94a3b8",
                      fontWeight: 700,
                    }}
                  >
                    {l.bureau}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", color: "#cbd5e1" }}>
                    Stage: <strong style={{ color: "#38bdf8" }}>{l.stage || "S4_INVESTIGATION"}</strong>
                  </span>
                  {l.outcomeCode && (
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: "4px",
                        background:
                          l.outcomeCode === "R01"
                            ? "rgba(16,185,129,0.2)"
                            : l.outcomeCode === "V-CLEAR"
                            ? "rgba(239,68,68,0.2)"
                            : "rgba(59,130,246,0.2)",
                        color:
                          l.outcomeCode === "R01"
                            ? "#34d399"
                            : l.outcomeCode === "V-CLEAR"
                            ? "#f87171"
                            : "#60a5fa",
                      }}
                    >
                      {l.outcomeCode}
                    </span>
                  )}
                </div>

                {l.timeline?.n_resultsDue && (
                  <div style={{ fontSize: "10px", color: "#94a3b8", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Clock style={{ width: "10px", height: "10px" }} />
                    Results Due: {new Date(l.timeline.n_resultsDue).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
