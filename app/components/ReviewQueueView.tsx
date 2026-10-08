"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ExternalLink,
  ChevronRight,
  Gavel,
} from "lucide-react";
import {
  fetchReviewQueueAction,
  approveReviewQueueItemAction,
  overrideReviewQueueItemAction,
} from "../actions/crm";

export interface ReviewItem {
  id: string;
  uid: string;
  bureau: string;
  creditor: string;
  accountNumberMasked: string;
  suggestedOutcome: string;
  confidence: number;
  documentUrl?: string;
  extractedSnippet?: string;
  status: "pending" | "approved" | "overridden";
  slaDueAt: string;
  createdAt: string;
}

export function ReviewQueueView() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null);
  const [overrideOutcome, setOverrideOutcome] = useState("R01");
  const [vClearChecked, setVClearChecked] = useState(false);

  const loadQueue = async () => {
    try {
      const list = await fetchReviewQueueAction();
      setItems(list);
      setLoading(false);
    } catch (err) {
      console.error("Error reading review queue:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleApprove = async (item: ReviewItem) => {
    try {
      const res = await approveReviewQueueItemAction(item);
      if (!res.success) {
        alert(`Approval error: ${res.error}`);
        return;
      }
      setSelectedItem(null);
      await loadQueue();
    } catch (err: any) {
      alert(`Approval error: ${err.message}`);
    }
  };

  const handleOverride = async (item: ReviewItem) => {
    try {
      const res = await overrideReviewQueueItemAction({
        item,
        overrideOutcome,
        vClearChecked,
      });
      if (!res.success) {
        alert(`Override error: ${res.error}`);
        return;
      }
      setSelectedItem(null);
      await loadQueue();
    } catch (err: any) {
      alert(`Override error: ${err.message}`);
    }
  };

  // Helper to calculate SLA countdown
  const getSlaBadge = (dueAt: string) => {
    const remainingMs = new Date(dueAt).getTime() - Date.now();
    const hours = Math.round(remainingMs / (1000 * 60 * 60));

    if (remainingMs <= 0) {
      return (
        <span
          style={{
            background: "#fee2e2",
            color: "#991b1b",
            padding: "2px 8px",
            borderRadius: "12px",
            fontSize: "11px",
            fontWeight: 700,
          }}
        >
          Overdue SLA
        </span>
      );
    }
    if (hours < 6) {
      return (
        <span
          style={{
            background: "#fef3c7",
            color: "#92400e",
            padding: "2px 8px",
            borderRadius: "12px",
            fontSize: "11px",
            fontWeight: 700,
          }}
        >
          {hours}h SLA Remaining
        </span>
      );
    }
    return (
      <span
        style={{
          background: "#ecfdf5",
          color: "#065f46",
          padding: "2px 8px",
          borderRadius: "12px",
          fontSize: "11px",
          fontWeight: 700,
        }}
      >
        {hours}h SLA (On Track)
      </span>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div style={{ minWidth: "220px", flex: "1 1 auto" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "#f8fafc" }}>
            Dispute Review Desk Queue
          </h2>
          <p style={{ fontSize: "12px", color: "#94a3b8", margin: "4px 0 0" }}>
            Human-in-the-loop gating for low-confidence OCR response letter classifications (&lt; 85%)
          </p>
        </div>
        <span
          style={{
            background: "rgba(59, 130, 246, 0.15)",
            color: "#60a5fa",
            padding: "4px 10px",
            borderRadius: "12px",
            fontSize: "12px",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {items.length} Pending 1-Day SLA Reviews
        </span>
      </div>

      {loading ? (
        <div style={{ color: "#94a3b8", fontSize: "13px" }}>Loading review desk…</div>
      ) : items.length === 0 ? (
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            background: "rgba(15, 23, 42, 0.4)",
            borderRadius: "12px",
            border: "1px dashed rgba(255, 255, 255, 0.1)",
          }}
        >
          <CheckCircle2 style={{ width: "32px", height: "32px", color: "#10b981", margin: "0 auto 8px" }} />
          <h4 style={{ margin: 0, color: "#f8fafc", fontSize: "14px" }}>Review Queue is Clear</h4>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "12px" }}>
            All response letter classifications meet the &gt; 85% statistical confidence threshold.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                background: "rgba(30, 41, 59, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "12px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: "14px", color: "#f8fafc" }}>
                      {item.creditor} ({item.accountNumberMasked})
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        textTransform: "uppercase",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: "rgba(255,255,255,0.06)",
                        color: "#94a3b8",
                      }}
                    >
                      {item.bureau}
                    </span>
                  </div>
                  <div style={{ fontSize: "12px", color: "#cbd5e1", marginTop: "4px" }}>
                    Suggested: <strong style={{ color: "#38bdf8" }}>{item.suggestedOutcome}</strong> (Confidence:{" "}
                    {Math.round(item.confidence * 100)}%)
                  </div>
                </div>
                {getSlaBadge(item.slaDueAt)}
              </div>

              {item.extractedSnippet && (
                <div
                  style={{
                    background: "rgba(15, 23, 42, 0.6)",
                    padding: "10px",
                    borderRadius: "8px",
                    fontSize: "11px",
                    fontFamily: "monospace",
                    color: "#94a3b8",
                  }}
                >
                  &ldquo;{item.extractedSnippet}…&rdquo;
                </div>
              )}

              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                {item.documentUrl && (
                  <a
                    href={item.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "12px",
                      color: "#94a3b8",
                      textDecoration: "none",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    <ExternalLink style={{ width: "12px", height: "12px" }} /> View Letter
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}
                  style={{
                    fontSize: "12px",
                    padding: "8px 14px",
                    borderRadius: "6px",
                    background: "transparent",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#f8fafc",
                    cursor: "pointer",
                    minHeight: "36px",
                  }}
                >
                  Override…
                </button>
                <button
                  type="button"
                  onClick={() => handleApprove(item)}
                  style={{
                    fontSize: "12px",
                    padding: "8px 14px",
                    borderRadius: "6px",
                    background: "#059669",
                    color: "#ffffff",
                    border: "none",
                    fontWeight: 600,
                    cursor: "pointer",
                    minHeight: "36px",
                  }}
                >
                  Approve Suggested ({item.suggestedOutcome})
                </button>
              </div>

              {/* Staff Override Panel */}
              {selectedItem?.id === item.id && (
                <div
                  style={{
                    marginTop: "8px",
                    padding: "12px",
                    background: "rgba(15, 23, 42, 0.8)",
                    borderRadius: "8px",
                    border: "1px solid #3b82f6",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#f8fafc" }}>
                    Staff Override & Violation Checklist
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <label style={{ fontSize: "12px", color: "#94a3b8" }}>New Outcome Code:</label>
                    <select
                      value={overrideOutcome}
                      onChange={(e) => setOverrideOutcome(e.target.value)}
                      style={{
                        background: "#1e293b",
                        color: "#f8fafc",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: "4px",
                        padding: "4px 8px",
                        fontSize: "12px",
                      }}
                    >
                      <option value="R01">R01 - Deleted / Removed</option>
                      <option value="R02">R02 - Fully Corrected</option>
                      <option value="R03">R03 - Partially Corrected</option>
                      <option value="R04">R04 - Verified, No Change</option>
                      <option value="R05">R05 - Frivolous / Irrelevant</option>
                      <option value="R10">R10 - Statutory Missed Deadline</option>
                      <option value="V-CLEAR">V-CLEAR - Clear FCRA Violation</option>
                    </select>
                  </div>

                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#f8fafc", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={vClearChecked}
                      onChange={(e) => setVClearChecked(e.target.checked)}
                    />
                    <span>
                      <Gavel style={{ width: "12px", height: "12px", display: "inline", marginRight: "4px", color: "#f59e0b" }} />
                      Confirm Actionable Violation Checklist (Refer to Partner Attorney)
                    </span>
                  </label>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() => handleOverride(item)}
                      style={{
                        background: "#2563eb",
                        color: "#fff",
                        padding: "6px 14px",
                        borderRadius: "6px",
                        border: "none",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Commit Staff Override
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
