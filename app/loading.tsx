import React from "react";

export default function Loading() {
  return (
    <div
      className="ceg-console"
      style={{ display: "grid", placeItems: "center" }}
    >
      <div
        className="skeleton-wrap"
        style={{ width: "min(480px, 90vw)", textAlign: "center" }}
      >
        <div
          className="brand-mark"
          style={{
            margin: "0 auto 16px",
            width: "48px",
            height: "48px",
            fontSize: "28px",
          }}
        >
          ▥
        </div>
        <h2 style={{ fontSize: "18px", color: "#fff", marginBottom: "8px" }}>
          CEG Console CRM
        </h2>
        <p className="muted" style={{ fontSize: "12px", marginBottom: "24px" }}>
          Initializing Firebase & loading workspace…
        </p>
        <div className="skeleton" style={{ height: "24px", width: "100%" }} />
        <div className="skeleton" style={{ height: "56px", width: "100%" }} />
        <div className="skeleton" style={{ height: "56px", width: "100%" }} />
      </div>
    </div>
  );
}
