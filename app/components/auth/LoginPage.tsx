"use client";

import React from "react";
import AuthHero from "./AuthHero";
import AuthCard from "./AuthCard";
import "../../styles/auth.css";

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <div className="auth-grid">
        <AuthHero />
        <AuthCard />
      </div>
    </main>
  );
}
