"use client";

import React, { useEffect, useState } from "react";
import { fetchClientPositiveAccountsAction } from "../actions/crm";
import { TrendingUp, CheckCircle2, Clock, AlertCircle } from "lucide-react";

export function PositiveAccountsCard({ brainUid }: { brainUid?: string }) {
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [refreshState, setRefreshState] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!brainUid) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    const loadData = async () => {
      try {
        const res = await fetchClientPositiveAccountsAction(brainUid);
        if (isMounted) {
          setEnrollments(res.enrollments);
          setRefreshState(res.refreshState);
          setLoading(false);
        }
      } catch (err) {
        console.error("Error reading positive accounts:", err);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();
    const interval = setInterval(loadData, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [brainUid]);

  const activeCount = enrollments.filter((e) => e.stage !== "posted").length;
  const postedCount = enrollments.filter((e) => e.stage === "posted").length;
  const helpCount = enrollments.filter((e) => e.helpRequested).length;

  return (
    <section className="card wide" style={{ marginTop: "16px" }}>
      <div
        className="card-head"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          paddingBottom: "10px",
          marginBottom: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <TrendingUp style={{ width: "16px", height: "16px", color: "#10b981" }} />
          <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#f8fafc" }}>
            Positive Account Coach (Tradelines)
          </h3>
        </div>
        {postedCount > 0 && (
          <span
            style={{
              background: "rgba(16, 185, 129, 0.15)",
              color: "#34d399",
              padding: "2px 8px",
              borderRadius: "12px",
              fontSize: "11px",
              fontWeight: 600,
            }}
          >
            {postedCount} Verified Posted
          </span>
        )}
      </div>

      {!brainUid ? (
        <div style={{ fontSize: "12px", color: "#64748b" }}>
          No linked Client App UID (brainUid) found.
        </div>
      ) : loading ? (
        <div style={{ fontSize: "12px", color: "#64748b" }}>Loading coach snapshot…</div>
      ) : enrollments.length === 0 ? (
        <div style={{ fontSize: "12px", color: "#64748b" }}>
          No positive account enrollments started yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
            <div
              style={{
                background: "rgba(15, 23, 42, 0.5)",
                padding: "8px 12px",
                borderRadius: "8px",
              }}
            >
              <small style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase" }}>
                Active in Flight
              </small>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "#f8fafc" }}>{activeCount}</div>
            </div>
            <div
              style={{
                background: "rgba(15, 23, 42, 0.5)",
                padding: "8px 12px",
                borderRadius: "8px",
              }}
            >
              <small style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase" }}>
                Verified Posted
              </small>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "#34d399" }}>{postedCount}</div>
            </div>
            <div
              style={{
                background: "rgba(15, 23, 42, 0.5)",
                padding: "8px 12px",
                borderRadius: "8px",
              }}
            >
              <small style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase" }}>
                Help Requests
              </small>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: helpCount > 0 ? "#f87171" : "#94a3b8",
                }}
              >
                {helpCount}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: "6px", marginTop: "4px" }}>
            {enrollments.map((e) => (
              <div
                key={e.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 12px",
                  background: "rgba(30, 41, 59, 0.4)",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
              >
                <div>
                  <b style={{ color: "#f8fafc" }}>{e.name}</b>
                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                    Limit: ${(e.limit || 0).toLocaleString()} · Balance: ${(e.balance || 0).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    style={{
                      textTransform: "uppercase",
                      fontSize: "10px",
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background: e.stage === "posted" ? "rgba(16,185,129,0.2)" : "rgba(59,130,246,0.2)",
                      color: e.stage === "posted" ? "#34d399" : "#60a5fa",
                    }}
                  >
                    {e.stage}
                  </span>
                  {e.helpRequested && (
                    <span
                      style={{
                        background: "#ef4444",
                        color: "#fff",
                        padding: "2px 5px",
                        borderRadius: "4px",
                        fontSize: "9px",
                        fontWeight: 700,
                      }}
                    >
                      HELP
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
