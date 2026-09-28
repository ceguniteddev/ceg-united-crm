"use client";

import React, { useState } from "react";
import { useAuth } from "../../provider/AuthContext";
import {
  AlertIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  MailIcon,
  ShieldIcon,
} from "./Icons";

type Props = {
  onAuthed?: () => void;
};

export default function AuthCard({ onAuthed }: Props) {
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<{
    kind: "error" | "success";
    msg: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};
    if (!email.trim()) {
      nextErrors.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = "Please enter a valid email address.";
    }

    if (!password) {
      nextErrors.password = "Password is required.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);

    if (!validate()) return;

    setBusy(true);
    try {
      await signIn(email, password);
      onAuthed?.();
    } catch (err: unknown) {
      console.error("CRM Login Error:", err);
      let msg = "Invalid email or password.";
      const errorObj = err as { code?: string; message?: string };

      if (
        errorObj?.code === "auth/invalid-credential" ||
        errorObj?.code === "auth/wrong-password" ||
        errorObj?.code === "auth/user-not-found"
      ) {
        msg = "Invalid email or password.";
      } else if (errorObj?.code === "auth/too-many-requests") {
        msg = "Too many failed attempts. Please try again later.";
      } else if (errorObj?.message) {
        msg = errorObj.message;
      }

      setBanner({ kind: "error", msg });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-card-wrap auth-reveal d2">
      <div className="auth-card-glow" aria-hidden />
      <div className="auth-card-box">
        {/* Admin Portal Header Badge */}
        <div className="auth-admin-badge">
          <ShieldIcon /> Administrator Access
        </div>

        <h2 className="auth-card-title">Sign In to Console</h2>
        <p className="auth-card-lede">
          Enter your admin credentials to access the CRM console.
        </p>

        {banner && (
          <div
            className={`auth-alert ${banner.kind === "error" ? "auth-alert-error" : "auth-alert-success"}`}
            role="alert"
          >
            <AlertIcon /> <span>{banner.msg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} noValidate>
          <div className="auth-field">
            <label htmlFor="crm-email" className="auth-label">
              Admin Email Address
            </label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">
                <MailIcon />
              </span>
              <input
                id="crm-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="admin@cegunited.com"
                className="auth-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "err-email" : undefined}
                required
              />
            </div>
            {errors.email && (
              <div id="err-email" className="auth-field-error">
                <AlertIcon />
                {errors.email}
              </div>
            )}
          </div>

          <div className="auth-field">
            <label htmlFor="crm-password" className="auth-label">
              Password
            </label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">
                <LockIcon />
              </span>
              <input
                id="crm-password"
                name="password"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter password"
                className="auth-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "err-password" : undefined}
                required
              />
              <button
                type="button"
                className="auth-input-toggle"
                aria-label={showPw ? "Hide password" : "Show password"}
                onClick={() => setShowPw((v) => !v)}
              >
                {showPw ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {errors.password && (
              <div id="err-password" className="auth-field-error">
                <AlertIcon />
                {errors.password}
              </div>
            )}
          </div>

          <div className="auth-form-row">
            <label className="auth-checkbox">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Keep me signed in
            </label>
          </div>

          <button className="auth-btn-primary" type="submit" disabled={busy}>
            {busy ? (
              <>
                <span className="auth-spinner" /> Authenticating…
              </>
            ) : (
              "Sign In to Console"
            )}
          </button>
        </form>

        <div className="auth-card-foot">
          Protected by CEG United Security & Access Control.
        </div>

        <p className="auth-legal">
          Unauthorized access attempts are monitored and logged.
        </p>
      </div>
    </div>
  );
}
