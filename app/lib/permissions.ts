import type { BrainProfile, Role } from "../types/crm";

export interface Permissions {
  viewScores: boolean;
  viewGatedPii: boolean;
  bankNumbers: "none" | "own_masked" | "all";
  sendMessages: boolean;
  claimLeads: boolean;
  reassign: boolean;
  manageAgent: boolean;
  manageReps: boolean;
  viewAllClients: boolean;
  openBrainAdmin: boolean;
}

export const PERMISSIONS: Record<Role, Permissions> = {
  owner: {
    viewScores: true,
    viewGatedPii: true,
    bankNumbers: "all",
    sendMessages: true,
    claimLeads: true,
    reassign: true,
    manageAgent: true,
    manageReps: true,
    viewAllClients: true,
    openBrainAdmin: true,
  },
  admin: {
    viewScores: true,
    viewGatedPii: true,
    bankNumbers: "all",
    sendMessages: true,
    claimLeads: true,
    reassign: true,
    manageAgent: true,
    manageReps: true,
    viewAllClients: true,
    openBrainAdmin: true,
  },
  manager: {
    viewScores: true,
    viewGatedPii: false,
    bankNumbers: "own_masked",
    sendMessages: true,
    claimLeads: true,
    reassign: true,
    manageAgent: false,
    manageReps: false,
    viewAllClients: true,
    openBrainAdmin: true,
  },
  senior_rep: {
    viewScores: true,
    viewGatedPii: false,
    bankNumbers: "own_masked",
    sendMessages: true,
    claimLeads: true,
    reassign: false,
    manageAgent: false,
    manageReps: false,
    viewAllClients: true,
    openBrainAdmin: true,
  },
  rep: {
    viewScores: true,
    viewGatedPii: false,
    bankNumbers: "own_masked",
    sendMessages: true,
    claimLeads: true,
    reassign: false,
    manageAgent: false,
    manageReps: false,
    viewAllClients: false,
    openBrainAdmin: true,
  },
  viewer: {
    viewScores: true,
    viewGatedPii: false,
    bankNumbers: "none",
    sendMessages: false,
    claimLeads: false,
    reassign: false,
    manageAgent: false,
    manageReps: false,
    viewAllClients: true,
    openBrainAdmin: false,
  },
};

export function can(
  role: Role | undefined | null,
  perm: keyof Permissions,
): boolean {
  if (!role) return false;
  const v = PERMISSIONS[role]?.[perm];
  return v === true || (typeof v === "string" && v !== "none");
}

const mask = (s?: string | null) => (s ? `•••• ${s.slice(-4)}` : null);

/** Server-side redaction. isOwnClient = rep is owner/assigned on this client. */
export function redactProfile(
  p: BrainProfile,
  role: Role,
  isOwnClient: boolean,
): { profile: BrainProfile; redacted: boolean } {
  const perms = PERMISSIONS[role];
  if (perms.viewGatedPii) return { profile: p, redacted: false };
  const out: BrainProfile = JSON.parse(JSON.stringify(p));
  out.business = {
    ...out.business,
    ein: out.business.ein ? mask(out.business.ein) : null,
  };
  const banks = p.gated?.bankAccounts ?? [];
  out.gated = {
    ssn: null,
    dob: null,
    ein: null,
    bankAccounts:
      perms.bankNumbers === "own_masked" && isOwnClient
        ? banks.map((b) => ({ bank: b.bank, last4: b.last4, full: null }))
        : [],
  };
  return { profile: out, redacted: true };
}
