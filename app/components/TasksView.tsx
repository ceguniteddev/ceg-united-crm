"use client";

import React from "react";
import { useI18n } from "../lib/i18n";
import { useCrmStore } from "../store/crmStore";

export function TasksView() {
  const { t, locale } = useI18n();
  const {
    tasks,
    clients,
    taskFilter,
    setTaskFilter,
    setTaskModalOpen,
    toggleTaskStatus,
    setSelectedClient,
    setView,
    activeRepUid,
    isSyncing,
  } = useCrmStore();

  const filteredTasks = tasks.filter((task) => {
    if (taskFilter === "mine") {
      return task.assigneeRepId === activeRepUid;
    }
    if (taskFilter === "overdue") {
      return (
        task.status === "overdue" ||
        (task.dueAt !== null &&
          new Date(task.dueAt) < new Date() &&
          task.status !== "done")
      );
    }
    return true;
  });

  const handleOpenClient = (clientId: string) => {
    setSelectedClient(clientId);
    setView("inbox");
  };

  return (
    <div>
      <div className="toolbar">
        <div className="chip-scroll">
          {(["mine", "all", "overdue"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`chip ${taskFilter === f ? "active" : ""}`}
              onClick={() => setTaskFilter(f)}
            >
              {f === "mine" ? t("Mine") : f === "all" ? t("All") : t("Overdue")}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="btn primary"
          onClick={() => setTaskModalOpen(true)}
        >
          + {t("Create")}
        </button>
      </div>

      {isSyncing && tasks.length === 0 ? (
        <div className="skeleton-wrap" aria-label={t("Loading")}>
          <div className="skeleton" style={{ height: "64px" }} />
          <div className="skeleton" style={{ height: "64px" }} />
          <div className="skeleton" style={{ height: "64px" }} />
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="empty">{t("NoActiveTasks")}</div>
      ) : (
        filteredTasks.map((task) => {
          const client = clients.find((c) => c.id === task.clientId);
          const isDone = task.status === "done";
          const isOverdue =
            task.status === "overdue" ||
            (task.dueAt !== null &&
              new Date(task.dueAt) < new Date() &&
              !isDone);

          return (
            <div className="task-card" key={task.id}>
              <div className="task-row">
                <button
                  type="button"
                  className={`task-check ${isDone ? "done" : ""}`}
                  onClick={() => toggleTaskStatus(task.id)}
                  aria-label={t("CompleteTask")}
                >
                  {isDone && "✓"}
                </button>
                <div>
                  <b
                    style={{ textDecoration: isDone ? "line-through" : "none" }}
                  >
                    {task.title}
                  </b>
                  <small>
                    {task.dueAt
                      ? `${t("DueDate")}: ${new Date(
                          task.dueAt,
                        ).toLocaleDateString(
                          locale === "es" ? "es-ES" : "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}`
                      : "No due date"}{" "}
                    ·{" "}
                    <span
                      className={`task-status ${isOverdue ? "overdue" : ""}`}
                    >
                      {t(
                        isDone
                          ? "DoneStatus"
                          : isOverdue
                            ? "OverdueStatus"
                            : "OpenStatus",
                      )}
                    </span>
                  </small>
                </div>
                {client && (
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => handleOpenClient(client.id)}
                  >
                    {client.displayName} ↗
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
