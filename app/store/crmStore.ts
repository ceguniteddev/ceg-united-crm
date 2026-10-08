"use client";

import { create } from "zustand";
import type {
  AgentLogEntry,
  AgentSettings,
  AppSettings,
  BrainProfile,
  Channel,
  CrmClient,
  Interaction,
  PrioritySignals,
  PriorityType,
  Rep,
  RepStatus,
  Role,
  ScreenpopEvent,
  Task,
  TaskStatus,
} from "../types/crm";
import {
  fetchCrmDataAction,
  fetchClientInteractionsAction,
  fetchClientTasksAction,
  fetchClient360Action,
  sendCrmMessageAction,
  addCrmNoteAction,
  createCrmTaskAction,
  toggleCrmTaskStatusAction,
  claimCrmLeadAction,
  linkCrmClientToBrainAction,
  updateCrmAgentSettingsAction,
  refreshCrmAiSummaryAction,
  setRepStatusAction,
  markClientAsReadAction,
} from "../actions/crm";

export type View =
  | "inbox"
  | "priority"
  | "agent"
  | "mine"
  | "sla"
  | "clients"
  | "deals"
  | "tasks"
  | "me";

export type Subtab = "profile" | "timeline" | "details" | "tasks" | "documents";

interface CrmState {
  // Navigation & Selection
  view: View;
  selectedClientId: string | null;
  subtab: Subtab;
  channelFilter: Channel | "all" | "unread";
  priorityFilter: PriorityType | "all";
  taskFilter: "mine" | "all" | "overdue";
  searchQuery: string;
  composeChannel: Channel | null;
  toastMessage: string | null;
  isTaskModalOpen: boolean;
  dismissedPops: Record<string, boolean>;

  // User / Rep State
  activeRepUid: string;
  reps: Rep[];

  // Real-time Data
  clients: CrmClient[];
  interactions: Record<string, Interaction[]>;
  tasks: Task[];
  prioritySignals: PrioritySignals[];
  screenpops: ScreenpopEvent[];
  agentSettings: AgentSettings;
  agentLogs: AgentLogEntry[];
  appSettings: AppSettings;
  profiles: Record<string, BrainProfile>;
  isSyncing: boolean;

  // Actions
  setView: (v: View) => void;
  setSelectedClient: (id: string | null) => void;
  setSubtab: (s: Subtab) => void;
  setChannelFilter: (c: Channel | "all" | "unread") => void;
  setPriorityFilter: (p: PriorityType | "all") => void;
  setTaskFilter: (t: "mine" | "all" | "overdue") => void;
  setSearchQuery: (q: string) => void;
  setComposeChannel: (c: Channel | null) => void;
  setToast: (msg: string | null) => void;
  setTaskModalOpen: (open: boolean) => void;
  setActiveRep: (uid: string) => void;
  syncAdminUser: (adminUser: {
    uid: string;
    email: string;
    displayName: string;
  }) => void;
  setRepStatus: (status: RepStatus) => Promise<void>;
  dismissScreenpop: (id: string) => void;

  // Data Loading
  loadCrmData: () => Promise<void>;
  loadClientInteractions: (clientId: string) => Promise<void>;
  loadClientTasks: (clientId: string) => Promise<void>;
  loadClient360: (clientId: string) => Promise<void>;

  // CRM Mutation Actions
  sendMessage: (
    clientId: string,
    channel: Channel,
    body: string,
  ) => Promise<void>;
  addNote: (clientId: string, text: string) => Promise<void>;
  createTask: (
    clientId: string,
    title: string,
    dueAt: string | null,
  ) => Promise<void>;
  toggleTaskStatus: (taskId: string) => Promise<void>;
  claimLead: (leadId: string) => Promise<void>;
  linkBrain: (clientId: string, brainUid: string) => Promise<void>;
  updateAgentSettings: (settings: Partial<AgentSettings>) => Promise<void>;
  refreshAiSummary: (clientId: string) => Promise<void>;
  initSubscriptions: () => () => void;
}

const DEFAULT_APP_SETTINGS: AppSettings = {
  brainAdminUrl: "https://cegunitedllc.firebaseapp.com/admin/clients/{uid}",
  timezone: "America/New_York",
  businessHours: { start: "09:00", end: "18:00", days: [1, 2, 3, 4, 5] },
  unansweredMinutes: 15,
  slaMinutes: 30,
};

const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  enabled: true,
  mode: "copilot",
  provider: "openai",
  model: "gpt-6-astra",
  confidenceThreshold: 0.85,
  channels: ["whatsapp", "messenger", "instagram", "sms", "telegram"],
  allowedTools: [
    "crm_find_client",
    "crm_get_profile_summary",
    "crm_get_task_status",
    "crm_create_task",
    "crm_log_note",
    "crm_send_message",
    "crm_send_upload_link",
    "crm_send_payment_link",
    "crm_book_appointment",
    "crm_escalate_to_human",
  ],
  mcpServerUrl: "https://mcp-crm-prod-380b9fae.run.app",
  alwaysEscalate: [
    "pricing_negotiation",
    "dispute_legal",
    "funding_decision",
    "upset_client",
    "vip_client",
  ],
  autoReplyDelaySeconds: 45,
  slaFallbackMinutes: 10,
  systemPrompt: `You are the CEG United CRM AI Specialist. Assist clients with program onboarding, document uploads, appointment bookings, and status inquiries with professionalism and empathy. Never disclose sensitive PII (full SSN, EIN, bank accounts).`,
  updatedAt: new Date().toISOString(),
};

export const useCrmStore = create<CrmState>((set, get) => ({
  view: "inbox",
  selectedClientId: null,
  subtab: "profile",
  channelFilter: "all",
  priorityFilter: "all",
  taskFilter: "mine",
  searchQuery: "",
  composeChannel: null,
  toastMessage: null,
  isTaskModalOpen: false,
  dismissedPops: {},

  activeRepUid: "rep_admin",
  reps: [],

  clients: [],
  interactions: {},
  tasks: [],
  prioritySignals: [],
  screenpops: [],
  agentSettings: DEFAULT_AGENT_SETTINGS,
  agentLogs: [],
  appSettings: DEFAULT_APP_SETTINGS,
  profiles: {},
  isSyncing: true,

  setView: (view) => {
    set({ view });
    if (view !== "inbox" && view !== "clients") {
      set({ selectedClientId: null });
    }
  },

  setSelectedClient: (selectedClientId) => {
    const currentView = get().view;
    set({
      selectedClientId,
      subtab: currentView === "inbox" ? "timeline" : "profile",
    });
    if (selectedClientId) {
      const { clients } = get();
      const targetClient = clients.find((c) => c.id === selectedClientId);
      if (targetClient && targetClient.unreadCount > 0) {
        set({
          clients: clients.map((c) =>
            c.id === selectedClientId ? { ...c, unreadCount: 0 } : c,
          ),
        });
        markClientAsReadAction(selectedClientId).catch((err) =>
          console.error("markClientAsReadAction error:", err),
        );
      }

      get().loadClientInteractions(selectedClientId);
      get().loadClientTasks(selectedClientId);
      get().loadClient360(selectedClientId);
    }
  },

  setSubtab: (subtab) => set({ subtab }),
  setChannelFilter: (channelFilter) => set({ channelFilter }),
  setPriorityFilter: (priorityFilter) => set({ priorityFilter }),
  setTaskFilter: (taskFilter) => set({ taskFilter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setComposeChannel: (composeChannel) => set({ composeChannel }),
  setToast: (toastMessage) => set({ toastMessage }),
  setTaskModalOpen: (isTaskModalOpen) => set({ isTaskModalOpen }),
  setActiveRep: (activeRepUid) => set({ activeRepUid }),

  syncAdminUser: ({ uid, email, displayName }) => {
    const { reps } = get();
    const existing = reps.find((r) => r.uid === uid);
    if (existing) {
      const updated = reps.map((r) =>
        r.uid === uid ? { ...r, name: displayName, email } : r,
      );
      set({ reps: updated, activeRepUid: uid });
    } else {
      const newAdminRep: Rep = {
        uid,
        name: displayName,
        email,
        role: "owner",
        channels: [
          "call",
          "sms",
          "whatsapp",
          "messenger",
          "instagram",
          "email",
          "telegram",
          "voicemail",
          "note",
        ],
        status: "available",
        updatedAt: new Date().toISOString(),
      };
      set({ reps: [newAdminRep, ...reps], activeRepUid: uid });
    }
  },

  setRepStatus: async (status: RepStatus) => {
    const { activeRepUid, reps } = get();
    const updated = reps.map((r) =>
      r.uid === activeRepUid
        ? { ...r, status, updatedAt: new Date().toISOString() }
        : r,
    );
    set({ reps: updated, toastMessage: "Availability updated" });

    try {
      await setRepStatusAction(activeRepUid, status);
    } catch (e) {
      console.error("setRepStatus error:", e);
    }
  },

  dismissScreenpop: (id: string) => {
    set((state) => ({
      dismissedPops: { ...state.dismissedPops, [id]: true },
    }));
  },

  loadCrmData: async () => {
    set({ isSyncing: true });
    try {
      const data = await fetchCrmDataAction();
      const currentSelected = get().selectedClientId;
      const nextSelected =
        currentSelected && data.clients.some((c) => c.id === currentSelected)
          ? currentSelected
          : null;

      const safeAgentSettings: AgentSettings = {
        ...DEFAULT_AGENT_SETTINGS,
        ...(data.agentSettings || {}),
        allowedTools: Array.isArray(data.agentSettings?.allowedTools)
          ? data.agentSettings.allowedTools
          : DEFAULT_AGENT_SETTINGS.allowedTools,
        channels: Array.isArray(data.agentSettings?.channels)
          ? data.agentSettings.channels
          : DEFAULT_AGENT_SETTINGS.channels,
        alwaysEscalate: Array.isArray(data.agentSettings?.alwaysEscalate)
          ? data.agentSettings.alwaysEscalate
          : DEFAULT_AGENT_SETTINGS.alwaysEscalate,
      };

      set({
        clients: data.clients,
        prioritySignals: data.prioritySignals,
        appSettings: data.appSettings,
        agentSettings: safeAgentSettings,
        agentLogs: data.agentLogs,
        reps: data.reps,
        selectedClientId: nextSelected,
        isSyncing: false,
      });

      if (nextSelected) {
        get().loadClientInteractions(nextSelected);
        get().loadClientTasks(nextSelected);
        get().loadClient360(nextSelected);
      }
    } catch (err) {
      console.error("loadCrmData Error:", err);
      set({ isSyncing: false });
    }
  },

  loadClientInteractions: async (clientId: string) => {
    try {
      const ixs = await fetchClientInteractionsAction(clientId);
      set((state) => ({
        interactions: {
          ...state.interactions,
          [clientId]: ixs,
        },
      }));
    } catch (err) {
      console.error(`loadClientInteractions error for ${clientId}:`, err);
    }
  },

  loadClientTasks: async (clientId: string) => {
    try {
      const clientTasks = await fetchClientTasksAction(clientId);
      set((state) => {
        const otherTasks = state.tasks.filter((t) => t.clientId !== clientId);
        return {
          tasks: [...clientTasks, ...otherTasks],
        };
      });
    } catch (err) {
      console.error(`loadClientTasks error for ${clientId}:`, err);
    }
  },

  loadClient360: async (clientId: string) => {
    const { activeRepUid, reps } = get();
    const currentRep = reps.find((r) => r.uid === activeRepUid);
    const role: Role = currentRep?.role || "admin";

    try {
      const profile = await fetchClient360Action(clientId, role);
      if (profile) {
        set((state) => ({
          profiles: {
            ...state.profiles,
            [clientId]: profile,
          },
        }));
      }
    } catch (err) {
      console.error(`loadClient360 error for ${clientId}:`, err);
    }
  },

  sendMessage: async (clientId: string, channel: Channel, body: string) => {
    const { activeRepUid, clients, interactions } = get();
    const now = new Date().toISOString();

    // Optimistic UI update
    const tempIx: Interaction = {
      id: `ix_${Date.now()}`,
      clientId,
      channel,
      direction: "out",
      ts: now,
      createdAt: now,
      from: activeRepUid,
      to: "",
      body,
      attachments: [],
      provider: "crm",
      providerId: `prov_${Date.now()}`,
      repId: activeRepUid,
      aiHandled: false,
      status: "sent",
    };

    const clientIxs = interactions[clientId] || [];
    set({
      interactions: {
        ...interactions,
        [clientId]: [...clientIxs, tempIx],
      },
      clients: clients.map((c) =>
        c.id === clientId
          ? {
              ...c,
              lastOutboundAt: now,
              lastMessagePreview: body,
              lastChannel: channel,
              unreadCount: 0,
              updatedAt: now,
            }
          : c,
      ),
      composeChannel: null,
      toastMessage: "Message sent successfully",
    });

    try {
      const savedIx = await sendCrmMessageAction({
        clientId,
        channel,
        body,
        repId: activeRepUid,
      });

      // Update with server returned record
      set((state) => ({
        interactions: {
          ...state.interactions,
          [clientId]: (state.interactions[clientId] || []).map((i) =>
            i.id === tempIx.id ? savedIx : i,
          ),
        },
      }));
    } catch (err) {
      console.error("sendMessage error:", err);
    }
  },

  addNote: async (clientId: string, text: string) => {
    const { activeRepUid, interactions } = get();
    const now = new Date().toISOString();

    const tempNote: Interaction = {
      id: `note_${Date.now()}`,
      clientId,
      channel: "note",
      direction: "out",
      ts: now,
      createdAt: now,
      from: activeRepUid,
      to: "",
      body: text,
      attachments: [],
      provider: "crm",
      providerId: `note_${Date.now()}`,
      repId: activeRepUid,
      aiHandled: false,
      status: "sent",
    };

    const clientIxs = interactions[clientId] || [];
    set({
      interactions: {
        ...interactions,
        [clientId]: [...clientIxs, tempNote],
      },
      composeChannel: null,
      toastMessage: "Internal note saved",
    });

    try {
      const savedNote = await addCrmNoteAction({
        clientId,
        body: text,
        repId: activeRepUid,
      });

      set((state) => ({
        interactions: {
          ...state.interactions,
          [clientId]: (state.interactions[clientId] || []).map((i) =>
            i.id === tempNote.id ? savedNote : i,
          ),
        },
      }));
    } catch (err) {
      console.error("addNote error:", err);
    }
  },

  createTask: async (clientId: string, title: string, dueAt: string | null) => {
    const { activeRepUid, tasks } = get();
    const now = new Date().toISOString();

    const tempTask: Task = {
      id: `task_${Date.now()}`,
      clientId,
      title,
      dueAt,
      status: "open",
      assigneeRepId: activeRepUid,
      priority: "normal",
      createdBy: activeRepUid,
      createdAt: now,
      updatedAt: now,
    };

    set({
      tasks: [tempTask, ...tasks],
      isTaskModalOpen: false,
      toastMessage: "Task created",
    });

    try {
      const savedTask = await createCrmTaskAction({
        clientId,
        title,
        dueAt,
        repId: activeRepUid,
      });

      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === tempTask.id ? savedTask : t)),
      }));
    } catch (err) {
      console.error("createTask error:", err);
    }
  },

  toggleTaskStatus: async (taskId: string) => {
    const { tasks } = get();
    const now = new Date().toISOString();
    const target = tasks.find((t) => t.id === taskId);
    if (!target) return;

    const nextStatus: TaskStatus = target.status === "done" ? "open" : "done";

    set({
      tasks: tasks.map((t) =>
        t.id === taskId ? { ...t, status: nextStatus, updatedAt: now } : t,
      ),
    });

    try {
      await toggleCrmTaskStatusAction({
        clientId: target.clientId,
        taskId,
        nextStatus,
      });
    } catch (err) {
      console.error("toggleTaskStatus error:", err);
    }
  },

  claimLead: async (leadId: string) => {
    const { prioritySignals } = get();
    set({
      prioritySignals: prioritySignals.filter(
        (p) => p.leadId !== leadId && p.id !== `lead_${leadId}`,
      ),
      toastMessage: "Lead claimed and assigned to you",
    });

    try {
      await claimCrmLeadAction(leadId);
    } catch (err) {
      console.error("claimLead error:", err);
    }
  },

  linkBrain: async (clientId: string, brainUid: string) => {
    const { clients } = get();
    set({
      clients: clients.map((c) => (c.id === clientId ? { ...c, brainUid } : c)),
      toastMessage: "Client linked to CEG Brain",
    });

    try {
      await linkCrmClientToBrainAction(clientId, brainUid);
      get().loadClient360(clientId);
    } catch (err) {
      console.error("linkBrain error:", err);
    }
  },

  updateAgentSettings: async (newSettings: Partial<AgentSettings>) => {
    const { agentSettings } = get();
    const updated: AgentSettings = {
      ...DEFAULT_AGENT_SETTINGS,
      ...agentSettings,
      ...newSettings,
      allowedTools: Array.isArray(newSettings.allowedTools)
        ? newSettings.allowedTools
        : Array.isArray(agentSettings?.allowedTools)
          ? agentSettings.allowedTools
          : DEFAULT_AGENT_SETTINGS.allowedTools,
      channels: Array.isArray(newSettings.channels)
        ? newSettings.channels
        : Array.isArray(agentSettings?.channels)
          ? agentSettings.channels
          : DEFAULT_AGENT_SETTINGS.channels,
      alwaysEscalate: Array.isArray(newSettings.alwaysEscalate)
        ? newSettings.alwaysEscalate
        : Array.isArray(agentSettings?.alwaysEscalate)
          ? agentSettings.alwaysEscalate
          : DEFAULT_AGENT_SETTINGS.alwaysEscalate,
      updatedAt: new Date().toISOString(),
    };
    set({ agentSettings: updated, toastMessage: "AI Agent settings saved" });

    try {
      await updateCrmAgentSettingsAction(newSettings);
    } catch (err) {
      console.error("updateAgentSettings error:", err);
    }
  },

  refreshAiSummary: async (clientId: string) => {
    const { clients } = get();
    const now = new Date().toISOString();
    set({
      clients: clients.map((c) =>
        c.id === clientId && c.aiSummary
          ? {
              ...c,
              aiSummary: { ...c.aiSummary, updatedAt: now },
              updatedAt: now,
            }
          : c,
      ),
      toastMessage: "AI Client Brief refreshed",
    });

    try {
      await refreshCrmAiSummaryAction(clientId);
    } catch (err) {
      console.error("refreshAiSummary error:", err);
    }
  },

  initSubscriptions: () => {
    // Initial fetch from Server Actions
    get().loadCrmData();

    // Poll periodically to keep data fresh without client firestore rules issues
    const interval = setInterval(() => {
      get().loadCrmData();
    }, 15000);

    return () => {
      clearInterval(interval);
    };
  },
}));
