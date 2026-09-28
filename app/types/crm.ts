import { z } from "zod";

export type Channel =
  | "call"
  | "voicemail"
  | "sms"
  | "whatsapp"
  | "messenger"
  | "instagram"
  | "email"
  | "telegram"
  | "note";

export const ChannelSchema = z.enum([
  "call",
  "voicemail",
  "sms",
  "whatsapp",
  "messenger",
  "instagram",
  "email",
  "telegram",
  "note",
]);

export type Provider =
  | "quo"
  | "meta"
  | "gmail"
  | "nylas"
  | "telegram"
  | "whop"
  | "splitit"
  | "crm"
  | "ai";

export const ProviderSchema = z.enum([
  "quo",
  "meta",
  "gmail",
  "nylas",
  "telegram",
  "whop",
  "splitit",
  "crm",
  "ai",
]);

export type Role =
  | "owner"
  | "admin"
  | "manager"
  | "senior_rep"
  | "rep"
  | "viewer";
export const RoleSchema = z.enum([
  "owner",
  "admin",
  "manager",
  "senior_rep",
  "rep",
  "viewer",
]);

export type RepStatus = "available" | "busy" | "away" | "offline";
export const RepStatusSchema = z.enum(["available", "busy", "away", "offline"]);

export type ISODate = string;

export interface Handles {
  phones: string[];
  emails: string[];
  waIds: string[];
  igsids: string[];
  psids: string[];
  telegramChatIds: string[];
}

export const HandlesSchema = z.object({
  phones: z.array(z.string()).default([]),
  emails: z.array(z.string()).default([]),
  waIds: z.array(z.string()).default([]),
  igsids: z.array(z.string()).default([]),
  psids: z.array(z.string()).default([]),
  telegramChatIds: z.array(z.string()).default([]),
});

export interface CrmClient {
  id: string;
  brainUid: string | null;
  displayName: string;
  handles: Handles;
  ownerRepId: string | null;
  repIds: string[];
  tags: string[];
  vip: boolean;
  highPriority: boolean;
  lastInboundAt: ISODate | null;
  lastOutboundAt: ISODate | null;
  unreadCount: number;
  lastMessagePreview: string;
  lastChannel: Channel | null;
  metaWindowExpiresAt: Partial<
    Record<"whatsapp" | "messenger" | "instagram", ISODate>
  >;
  aiSummary: { text: string; updatedAt: ISODate; model: string } | null;
  smsConsent: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export const CrmClientSchema = z.object({
  id: z.string(),
  brainUid: z.string().nullable().default(null),
  displayName: z.string().min(1),
  handles: HandlesSchema.default({
    phones: [],
    emails: [],
    waIds: [],
    igsids: [],
    psids: [],
    telegramChatIds: [],
  }),
  ownerRepId: z.string().nullable().default(null),
  repIds: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  vip: z.boolean().default(false),
  highPriority: z.boolean().default(false),
  lastInboundAt: z.string().nullable().default(null),
  lastOutboundAt: z.string().nullable().default(null),
  unreadCount: z.number().default(0),
  lastMessagePreview: z.string().default(""),
  lastChannel: ChannelSchema.nullable().default(null),
  metaWindowExpiresAt: z.record(z.string(), z.string()).default({}),
  aiSummary: z
    .object({
      text: z.string(),
      updatedAt: z.string(),
      model: z.string(),
    })
    .nullable()
    .default(null),
  smsConsent: z.boolean().default(true),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export interface Attachment {
  type: "image" | "audio" | "video" | "file";
  url: string;
  mimeType?: string;
  name?: string;
  transcript?: string;
}

export interface CallDetails {
  durationSec: number;
  missed: boolean;
  voicemail: boolean;
  recordingUrl?: string;
  transcript?: { speaker: string; text: string; start: number; end: number }[];
  summary?: string;
  nextSteps?: string[];
  quoCallId?: string;
}

export interface Interaction {
  id: string;
  clientId: string | null;
  leadId?: string | null;
  channel: Channel;
  direction: "in" | "out";
  ts: ISODate;
  from: string;
  to: string;
  body: string;
  subject?: string;
  threadId?: string;
  attachments: Attachment[];
  call?: CallDetails;
  provider: Provider;
  providerId: string;
  repId: string | null;
  aiHandled: boolean;
  status: "received" | "queued" | "sent" | "delivered" | "read" | "failed";
  error?: string;
  intentTags?: string[];
  processing?: "pending" | "done" | "error";
  createdAt: ISODate;
}

export type TaskStatus = "open" | "in_progress" | "done" | "overdue";

export interface Task {
  id: string;
  clientId: string;
  title: string;
  dueAt: ISODate | null;
  status: TaskStatus;
  assigneeRepId: string | null;
  priority: "low" | "normal" | "high";
  createdBy: string;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export const TaskSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  title: z.string().min(1),
  dueAt: z.string().nullable().default(null),
  status: z.enum(["open", "in_progress", "done", "overdue"]).default("open"),
  assigneeRepId: z.string().nullable().default(null),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type PriorityType =
  | "overdue_payment"
  | "high_priority"
  | "missed_call"
  | "overdue_task"
  | "unanswered"
  | "new_lead"
  | "buying_interest";

export interface PrioritySignal {
  type: PriorityType;
  label: string;
  since: ISODate;
  detail?: string;
}

export interface PrioritySignals {
  id: string;
  kind: "client" | "lead";
  clientId: string | null;
  leadId: string | null;
  displayName: string;
  phone?: string;
  email?: string;
  ownerRepId: string | null;
  score: number;
  signals: PrioritySignal[];
  updatedAt: ISODate;
}

export interface Rep {
  uid: string;
  name: string;
  email: string;
  role: Role;
  channels: Channel[];
  status: RepStatus;
  phoneUserId?: string;
  updatedAt: ISODate;
}

export interface AgentSettings {
  enabled: boolean;
  mode: "shadow" | "copilot" | "autonomous";
  provider: "xai" | "openai" | "anthropic";
  model: string;
  confidenceThreshold: number;
  channels: Channel[];
  allowedTools: string[];
  mcpServerUrl: string;
  alwaysEscalate: string[];
  autoReplyDelaySeconds: number;
  slaFallbackMinutes: number;
  systemPrompt: string;
  updatedAt: ISODate;
}

export interface AgentLogEntry {
  id: string;
  clientId: string | null;
  interactionId: string | null;
  decision: "replied" | "escalated" | "suggested" | "skipped";
  reason: string;
  confidence: number;
  provider: string;
  model: string;
  toolsCalled: string[];
  replyBody?: string;
  durationMs: number;
  createdAt: ISODate;
}

export interface ScreenpopEvent {
  id: string;
  repUid: string;
  clientId: string;
  channel: Channel;
  callerHandle: string;
  status: "ringing" | "connected" | "completed" | "dismissed";
  receivedAt: ISODate;
}

export interface AppSettings {
  brainAdminUrl: string;
  timezone: string;
  businessHours: { start: string; end: string; days: number[] };
  unansweredMinutes: number;
  slaMinutes: number;
}

export interface BureauScore {
  score: number | null;
  pulledAt: ISODate | null;
  delta?: number;
  prevScore?: number;
  change30d?: number;
  history?: { date: string; score: number }[];
}

export interface BrainProfile {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  credit: {
    equifax: BureauScore;
    experian: BureauScore;
    transunion: BureauScore;
  };
  business: {
    name: string | null;
    ein: string | null;
    state?: string | null;
    entityType: string | null;
    industry: string | null;
    naics?: string | null;
    timeInBusiness?: string | null;
    annualRevenue: number | null;
    monthlyDeposits?: number | null;
    businessCredit?: string | null;
    duns?: string | null;
  };
  billing: {
    status:
      | "current"
      | "past_due"
      | "failed"
      | "canceled"
      | "trial"
      | "unknown"
      | null;
    planName: string | null;
    amount: number | null;
    interval?: "month" | "year" | null;
    nextBillDate: ISODate | null;
    lastPaidAt?: ISODate | null;
    lifetimeValue?: number | null;
    paymentMethod?: string | null;
    paymentHistory?: {
      monthLabel: string;
      status: "paid" | "unpaid" | "upcoming" | "empty";
    }[];
  };
  enrollments: {
    programId: string;
    name: string;
    status: "active" | "graduated" | "paused";
    progressPercent: number;
    joinedAt: ISODate;
  }[];
  recommendations: {
    id: string;
    title: string;
    fitScore: number;
    reason: string;
  }[];
  notes: {
    id: string;
    author: string;
    text: string;
    createdAt: ISODate;
  }[];
  lifecycle: {
    stage:
      | "Lead"
      | "Diagnostic"
      | "Enrolled"
      | "Repair"
      | "Build"
      | "Fund"
      | "Funded";
    updatedAt: ISODate;
  };
  alerts: {
    id: string;
    severity: "info" | "warning" | "critical";
    message: string;
    createdAt: ISODate;
  }[];
  gated?: {
    ssn: string | null;
    dob: string | null;
    ein: string | null;
    bankAccounts: { bank: string; last4: string; full: string | null }[];
  };
}

export interface Client360 {
  client: CrmClient;
  profile: BrainProfile | null;
  interactions: Interaction[];
  tasks: Task[];
  priority: PrioritySignals | null;
  redacted: boolean;
}
