"use client";

import React, { useEffect, useState } from "react";
import { ShieldIcon } from "./Icons";

const highlights = [
  {
    title: "Omnichannel Command",
    quote: "Integrated SMS, WhatsApp, Calls, Email, and Telegram live queues.",
    who: "Real-Time Comms",
  },
  {
    title: "Autonomous AI Copilot",
    quote:
      "Deterministic escalation rules, CRM tool-calling, and live screenpops.",
    who: "AI Agent Engine",
  },
  {
    title: "Client & Credit Intel",
    quote:
      "Direct sync with CEG Brain, bureau scores, and deal pipeline stages.",
    who: "Enterprise Central",
  },
];

export default function AuthHero() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % highlights.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  return (
    <section
      className="auth-hero auth-reveal d1"
      aria-labelledby="crm-auth-headline"
    >
      <div className="auth-brand" aria-label="CEG Console CRM">
        <span className="auth-brand-mark" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        CEG Console · CRM
      </div>

      <h1 id="crm-auth-headline" className="auth-headline">
        Client <span className="auth-accent">intelligence</span>.<br />
        Unified control.
      </h1>

      <p className="auth-sub">
        The internal command platform for CEG United operators. Monitor
        omnichannel conversations, track pipeline deals, review bureau reports,
        and manage AI workflows.
      </p>

      {/* Desktop View: 3-column feature cards */}
      <div className="auth-proof-desktop" aria-label="Platform capabilities">
        {highlights.map((h) => (
          <div className="auth-proof-card" key={h.title}>
            <div className="auth-proof-stars">{h.who}</div>
            <p className="auth-proof-quote">{h.quote}</p>
            <div className="auth-proof-who">● {h.title}</div>
          </div>
        ))}
      </div>

      {/* Mobile View: Carousel */}
      <div
        className="auth-proof-carousel"
        aria-label="Platform highlights carousel"
      >
        <div className="auth-proof-carousel-track">
          {highlights.map((h, idx) => (
            <div
              className={`auth-proof-card auth-proof-slide ${idx === activeIndex ? "active" : ""}`}
              key={h.title}
              aria-hidden={idx !== activeIndex}
            >
              <div className="auth-proof-stars">{h.who}</div>
              <p className="auth-proof-quote">{h.quote}</p>
              <div className="auth-proof-who">● {h.title}</div>
            </div>
          ))}
        </div>
        <div
          className="auth-carousel-dots"
          role="tablist"
          aria-label="Highlight slides"
        >
          {highlights.map((h, idx) => (
            <button
              key={h.title}
              type="button"
              role="tab"
              aria-selected={idx === activeIndex}
              aria-label={`Go to slide ${idx + 1}`}
              className={`auth-carousel-dot ${idx === activeIndex ? "active" : ""}`}
              onClick={() => setActiveIndex(idx)}
            />
          ))}
        </div>
      </div>

      <div className="auth-trust-row">
        <ShieldIcon /> Restricted Access · Authorized Administrators Only.
      </div>
    </section>
  );
}
