"use client";

import dynamic from "next/dynamic";
import { useAuth } from "./provider/AuthContext";
import LoginPage from "./components/auth/LoginPage";

const CrmShell = dynamic(
  () => import("./components/CrmShell").then((mod) => mod.CrmShell),
  { ssr: false },
);

export default function HomePage() {
  const { user, adminUser, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          height: "100vh",
          width: "100vw",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#060b18",
          color: "#93c5fd",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              border: "3px solid rgba(59, 130, 246, 0.2)",
              borderTopColor: "#3b82f6",
              animation: "authSpin 700ms linear infinite",
            }}
          />
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#7c8aa5",
            }}
          >
            Loading CEG Console…
          </span>
        </div>
      </div>
    );
  }

  if (!user || !adminUser || !isAdmin) {
    return <LoginPage />;
  }

  return <CrmShell />;
}
