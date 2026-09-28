"use client";

import React, { useState } from "react";
import { useI18n } from "../lib/i18n";
import { useCrmStore } from "../store/crmStore";

export function TaskModal() {
  const { t } = useI18n();
  const { clients, selectedClientId, createTask, setTaskModalOpen } =
    useCrmStore();
  const [clientId, setClientId] = useState(
    selectedClientId || clients[0]?.id || "",
  );
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !clientId || submitting) return;

    setSubmitting(true);
    try {
      await createTask(
        clientId,
        title.trim(),
        due ? new Date(due).toISOString() : null,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="compose-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setTaskModalOpen(false);
      }}
    >
      <form className="task-form" onSubmit={handleSubmit}>
        <div className="sheet-grip mobile-only" />
        <div className="compose-head">
          <h2>{t("CreateTask")}</h2>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setTaskModalOpen(false)}
            aria-label={t("CloseComposer")}
          >
            ✕
          </button>
        </div>

        <label>
          {t("Client")}
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            {clients.map((c) => (
              <option value={c.id} key={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
        </label>

        <label>
          {t("Tasks")}
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("TaskPlaceholder")}
          />
        </label>

        <label>
          {t("DueDate")}
          <input
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </label>

        <button
          type="submit"
          className="btn primary"
          disabled={!title.trim() || !clientId || submitting}
        >
          {submitting ? t("Loading") : t("CreateTask")}
        </button>
      </form>
    </div>
  );
}
