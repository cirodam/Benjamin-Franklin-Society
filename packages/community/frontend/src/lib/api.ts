// Typed API wrappers for the community backend.
// All calls use relative URLs — Vite proxies /api → http://localhost:3002 in dev.

import { getToken, session, sessionExpired } from "./session.js";

/**
 * Authenticated fetch — attaches the Bearer credential token when present.
 * On 401, clears the session so the app re-routes to login.
 */
async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
    const token = getToken();
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(input, { ...init, headers });
    if (res.status === 401) {
        sessionExpired.set(true);
        session.logout();
    }
    return res;
}

export interface PersonDto {
    /** Only present in the login response; not exposed in list/detail endpoints. */
    id?: string;
    firstName: string;
    lastName: string;
    handle: string;
    phone: string | null;
    disabled: boolean;
    retired: boolean;
    admin: boolean;
    isAdmin: boolean;
    joinDate: string;
    hasPassword: boolean;
    mustChangePassword?: boolean;
    /** Satellite apps this person has been enrolled in. */
    apps: string[];
    /** Present on individual GET /api/persons/:handle; absent from list responses. */
    appPermissions?: Record<string, string[]>;
}

export interface DocumentParameter {
    value:        number | boolean;
    immutable:    boolean;
    description:  string;
    constraints?: { min?: number; max?: number };
}

export interface DocumentSection {
    id:             string;
    title?:         string;
    body:           string;
    rationale?:     string;

    /** Vote rule for amending/repealing this section. null = use document fallback. */
    voteRuleId?:    string | null;
}

export interface DocumentArticle {
    number:    string;
    title:     string;
    preamble?: string;
    sections:  DocumentSection[];
}

export interface DocumentAmendmentDto {
    version:    number;
    parameter:  string;
    oldValue:   number | boolean;
    newValue:   number | boolean;
    motionId:   string;
    amendedAt:  string;
}

export interface GoverningDocumentDto {
    id:           string;
    type:         string;
    title:        string;
    preamble?:    string;
    authorityId:  string;
    /** Default vote rule for amending sections. Sections may override with their own voteRuleId. */
    voteRuleId:   string;
    domainId?:    string | null;
    adoptedAt:    string;
    version:      number;
    expiresAt?:   string | null;
    readonly?:    boolean;
    articles:     DocumentArticle[];
    parameters?:  Record<string, DocumentParameter>;
    amendments?:  DocumentAmendmentDto[];
}

/** @deprecated Use GoverningDocumentDto */
export type ConstitutionParam       = DocumentParameter;
/** @deprecated Use DocumentAmendmentDto */
export type ConstitutionAmendmentDto = DocumentAmendmentDto;

// ── Economics ─────────────────────────────────────────────────────────────────

export interface EconomicsDto {
    ready: boolean;
    centralBank: {
        kinInCirculation: number;
    } | null;
    socialInsurance: {
        poolBalance: number;
        totalContributed: number;
        totalPaidOut: number;
        memberCount: number;
    } | null;
    demographics: {
        total:          number;
        workingAge:     number;
        children:       number;
        retired:        number;
        disabled:       number;
        workingAgeMin:  number;
        retirementAge:  number;
        totalPersonYears: number;
    } | null;
    healthcareStaffing: {
        gp:           { recommended: number; ratioPerPerson: number };
        nurse:        { recommended: number; ratioPerPerson: number };
        dentist:      { recommended: number; ratioPerPerson: number };
        mentalHealth: { recommended: number; ratioPerPerson: number };
        paramedic:    { recommended: number; ratioPerPerson: number };
        midwife:      { recommended: number; ratioPerPerson: number };
    } | null;
}

export async function getEconomics(): Promise<EconomicsDto> {
    const res = await fetch("/api/economics");
    if (!res.ok) throw new Error("Failed to load economics data");
    return res.json() as Promise<EconomicsDto>;
}

// ── Federation membership ─────────────────────────────────────────────────────

export type FederationStatus = "none" | "pending" | "approved" | "rejected";

export interface FederationMembershipRecord {
    federationUrl:       string;
    applicationId:       string;
    memberId:            string | null;
    federationAccountId: string | null;
    communityHandle:     string;
    federationHandle:    string | null;
    commonwealthHandle:  string | null;
    globeHandle:         string | null;
    commonwealthUrl:     string | null;
    globeUrl:            string | null;
    status:              FederationStatus;
    appliedAt:           string;
}

export async function getFederationMembership(): Promise<FederationMembershipRecord | null> {
    const res = await fetch("/api/federation");
    if (!res.ok) throw new Error("Failed to load federation status");
    const data = await res.json() as { status: string } & Partial<FederationMembershipRecord>;
    if (data.status === "none") return null;
    return data as FederationMembershipRecord;
}

export async function syncFederationMembership(): Promise<FederationMembershipRecord | null> {
    const res = await apiFetch("/api/federation/sync");
    if (!res.ok) throw new Error("Failed to sync federation status");
    const data = await res.json() as { status: string } & Partial<FederationMembershipRecord>;
    if (data.status === "none") return null;
    return data as FederationMembershipRecord;
}

export async function applyToFederation(
    federationUrl: string,
    communityName: string,
    communityHandle: string,
): Promise<FederationMembershipRecord> {
    const res = await apiFetch("/api/federation/apply", {
        method: "POST",
        body: JSON.stringify({ federationUrl, communityName, communityHandle }),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Application failed");
    }
    return res.json() as Promise<FederationMembershipRecord>;
}

// ── Community Budget ───────────────────────────────────────────────────────────

export interface BudgetPayrollRow {
    roleId:      string;
    title:       string;
    memberId:    string | null;
    kinPerMonth: number;
}

export interface BudgetItem {
    id:        string;
    label:     string;
    amount:    number;
    category:  "supplies" | "equipment" | "services" | "other";
    note:      string;
    perMember?: boolean;
}

export interface BudgetDomainRow {
    domainId:   string;
    domainName: string;
    payroll:    BudgetPayrollRow[];
    items:      BudgetItem[];
    totals:     { payroll: number; items: number; total: number };
}

export interface CommunityBudgetDto {
    ready: boolean;
    inflow: {
        treasuryBalance:      number;
        duesRate:             number;
        estimatedMonthlyDues: number;
        kinInCirculation:     number;
    };
    outflow: {
        monthlyTotal: number;
        domains:      BudgetDomainRow[];
        totals:       { payroll: number; items: number; total: number };
    };
    memberCount:            number;
    foodAllowancePerMember: number;
    solvent: boolean;
}

export async function getCommunityBudget(): Promise<CommunityBudgetDto> {
    const res = await fetch("/api/budget");
    if (!res.ok) throw new Error("Failed to load budget");
    return res.json() as Promise<CommunityBudgetDto>;
}

// ── Setup ─────────────────────────────────────────────────────────────────────

export async function getSetupStatus(): Promise<{ needsSetup: boolean }> {
    const res = await fetch("/api/setup/status");
    if (!res.ok) throw new Error("Failed to check setup status");
    return res.json() as Promise<{ needsSetup: boolean }>;
}

export interface SetupPayload {
    communityName: string;
    communityHandle: string;
    firstName: string;
    lastName: string;
    birthDate: string;   // ISO date string, e.g. "1990-04-25"
    handle: string;
    password: string;
    phone?: string;
    seedPopulation?: boolean;
}

export interface SetupResult {
    communityName: string;
    seededCount: number;
    founder: { id: string; firstName: string; lastName: string; handle: string };
}

export async function runSetup(payload: SetupPayload): Promise<SetupResult> {
    const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Setup failed");
    }
    return res.json() as Promise<SetupResult>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login(handle: string, password: string): Promise<PersonDto & { token: string }> {
    const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, password }),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Login failed");
    }
    return res.json() as Promise<PersonDto & { token: string }>;
}

// ── Persons ───────────────────────────────────────────────────────────────────

export async function listPersons(): Promise<PersonDto[]> {
    const res = await apiFetch("/api/persons");
    if (!res.ok) throw new Error("Failed to load members");
    return res.json() as Promise<PersonDto[]>;
}

// ── Assembly ──────────────────────────────────────────────────────────────────

export interface AssemblySlimPerson {
    id: string;
    firstName: string;
    lastName: string;
    handle: string;
}

export interface AssemblyDto {
    seats:                  number;
    fraction:               number;
    termMonths:             number;
    termStartMonth:         number;
    termStartDay:           number;
    canonicalTermStartDate: string;
    canonicalTermEndDate:   string;
    termStartDate:          string | null;
    population:             number;
    seated:                 AssemblySlimPerson[];
}

export async function getAssembly(): Promise<AssemblyDto> {
    const res = await apiFetch("/api/assembly");
    if (!res.ok) throw new Error("Failed to load assembly");
    return res.json() as Promise<AssemblyDto>;
}

export async function drawAssembly(termStartDate?: string): Promise<AssemblyDto> {
    const res = await apiFetch("/api/assembly/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ termStartDate }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Failed to draw assembly");
    }
    return res.json() as Promise<AssemblyDto>;
}

export async function clearAssembly(): Promise<void> {
    const res = await apiFetch("/api/assembly", { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to clear assembly");
}



export async function getPerson(handle: string): Promise<PersonDto> {
    const res = await apiFetch(`/api/persons/${encodeURIComponent(handle)}`);
    if (!res.ok) throw new Error("Member not found");
    return res.json() as Promise<PersonDto>;
}

export async function addPerson(data: {
    firstName: string;
    lastName: string;
    birthDate: string;
    phone?: string | null;
}): Promise<PersonDto> {
    const res = await apiFetch("/api/persons", {
        method: "POST",
        body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({})) as { error?: string } & PersonDto;
    if (!res.ok) throw new Error(body.error ?? "Failed to add person");
    return body as PersonDto;
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function setPassword(handle: string, password: string): Promise<void> {
    const res = await apiFetch(`/api/persons/${encodeURIComponent(handle)}/password`, {
        method: "POST",
        body: JSON.stringify({ password }),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to set password");
    }
}

export async function changeOwnPassword(password: string): Promise<void> {
    const res = await apiFetch("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ password }),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to change password");
    }
}

export async function setPin(handle: string, pin: string): Promise<void> {
    const res = await apiFetch(`/api/persons/${encodeURIComponent(handle)}/pin`, {
        method: "POST",
        body: JSON.stringify({ pin }),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to set PIN");
    }
}

export async function updatePerson(handle: string, patch: { phone?: string }): Promise<PersonDto> {
    const res = await apiFetch(`/api/persons/${encodeURIComponent(handle)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to update profile");
    }
    return res.json() as Promise<PersonDto>;
}

export async function grantAdmin(handle: string): Promise<PersonDto> {
    const res = await apiFetch(`/api/persons/${encodeURIComponent(handle)}/admin`, { method: "POST" });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to grant admin access");
    }
    return res.json() as Promise<PersonDto>;
}

export async function revokeAdmin(handle: string): Promise<PersonDto> {
    const res = await apiFetch(`/api/persons/${encodeURIComponent(handle)}/admin`, { method: "DELETE" });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to revoke admin access");
    }
    return res.json() as Promise<PersonDto>;
}

export async function grantPersonApp(handle: string, app: string): Promise<PersonDto> {
    const res = await apiFetch(`/api/persons/${encodeURIComponent(handle)}/apps/${encodeURIComponent(app)}`, { method: "POST" });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Failed to grant ${app} access`);
    }
    return res.json() as Promise<PersonDto>;
}

export async function revokePersonApp(handle: string, app: string): Promise<PersonDto> {
    const res = await apiFetch(`/api/persons/${encodeURIComponent(handle)}/apps/${encodeURIComponent(app)}`, { method: "DELETE" });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Failed to revoke ${app} access`);
    }
    return res.json() as Promise<PersonDto>;
}


// ── Constitution ──────────────────────────────────────────────────────────────

export async function getConstitution(): Promise<GoverningDocumentDto> {
    const res = await fetch("/api/documents/constitution");
    if (!res.ok) throw new Error("Failed to load constitution");
    return res.json() as Promise<GoverningDocumentDto>;
}

/** @deprecated Use getConstitution() — now returns GoverningDocumentDto directly */
export const getConstitutionLegacy = getConstitution;

export async function updateConstitutionParameter(key: string, value: number | boolean): Promise<void> {
    const res = await apiFetch(`/api/documents/constitution/parameters/${encodeURIComponent(key)}`, {
        method: "PATCH",
        body:   JSON.stringify({ value }),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to update parameter");
    }
}

export async function updateConstitutionSection(sectionId: string, body: string): Promise<GoverningDocumentDto> {
    const res = await apiFetch(`/api/documents/constitution/sections/${encodeURIComponent(sectionId)}`, {
        method: "PATCH",
        body:   JSON.stringify({ body }),
    });
    if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(b.error ?? "Failed to update section");
    }
    return res.json() as Promise<GoverningDocumentDto>;
}

// ── Bylaws ────────────────────────────────────────────────────────────────────

/** @deprecated Use GoverningDocumentDto */
export type BylawDto = GoverningDocumentDto;

export async function listBylaws(): Promise<BylawDto[]> {
    const res = await apiFetch("/api/bylaws");
    if (!res.ok) throw new Error("Failed to load bylaws");
    return res.json() as Promise<BylawDto[]>;
}

export async function getCharter(): Promise<BylawDto> {
    const res = await apiFetch("/api/charter");
    if (!res.ok) throw new Error("Charter not found");
    return res.json() as Promise<BylawDto>;
}

export async function getBylaw(id: string): Promise<BylawDto> {
    const res = await apiFetch(`/api/bylaws/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error("Bylaw not found");
    return res.json() as Promise<BylawDto>;
}

export async function createBylaw(title: string, preamble?: string): Promise<BylawDto> {
    const res = await apiFetch("/api/bylaws", {
        method: "POST",
        body:   JSON.stringify({ title, preamble }),
    });
    if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(b.error ?? "Failed to create bylaw");
    }
    return res.json() as Promise<BylawDto>;
}

export async function addBylawArticle(id: string, number: string, title: string, preamble?: string): Promise<BylawDto> {
    const res = await apiFetch(`/api/bylaws/${encodeURIComponent(id)}/articles`, {
        method: "POST",
        body:   JSON.stringify({ number, title, preamble }),
    });
    if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(b.error ?? "Failed to add article");
    }
    return res.json() as Promise<BylawDto>;
}

export async function addBylawSection(id: string, articleNumber: string, sectionId: string, title: string, body: string): Promise<BylawDto> {
    const res = await apiFetch(`/api/bylaws/${encodeURIComponent(id)}/articles/${encodeURIComponent(articleNumber)}/sections`, {
        method: "POST",
        body:   JSON.stringify({ sectionId, title, body }),
    });
    if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(b.error ?? "Failed to add section");
    }
    return res.json() as Promise<BylawDto>;
}

export async function updateBylawSection(id: string, sectionId: string, body: string): Promise<BylawDto> {
    const res = await apiFetch(`/api/bylaws/${encodeURIComponent(id)}/sections/${encodeURIComponent(sectionId)}`, {
        method: "PATCH",
        body:   JSON.stringify({ body }),
    });
    if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(b.error ?? "Failed to update section");
    }
    return res.json() as Promise<BylawDto>;
}

export async function deleteBylaw(id: string): Promise<void> {
    const res = await apiFetch(`/api/bylaws/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok && res.status !== 204) {
        const b = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(b.error ?? "Failed to delete bylaw");
    }
}

export interface SimulateStepResult {
    ok:             boolean;
    demurrageCount: number;
    duesCount:      number;
    foodCount:      number;
    payrollDomains: number;
}

export async function simulateBudgetStep(): Promise<SimulateStepResult> {
    const res = await apiFetch("/api/budget/simulate-step", { method: "POST" });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Simulation failed");
    }
    return res.json() as Promise<SimulateStepResult>;
}

// ── Associations ──────────────────────────────────────────────────────────────

export interface AssociationDto {
    id:             string;
    name:           string;
    handle:         string;
    description:    string;
    active:         boolean;
    memberHandles:  string[];
    adminHandles:   string[];
    memberCount:    number;
    registeredAt:   string;
}

export async function listAssociations(): Promise<AssociationDto[]> {
    const res = await fetch("/api/associations");
    if (!res.ok) throw new Error("Failed to load associations");
    return res.json() as Promise<AssociationDto[]>;
}

export async function getAssociation(id: string): Promise<AssociationDto> {
    const res = await fetch(`/api/associations/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error("Association not found");
    return res.json() as Promise<AssociationDto>;
}

export async function createAssociation(payload: { name: string; handle: string; description?: string }): Promise<AssociationDto> {
    const res = await apiFetch("/api/associations", {
        method: "POST",
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to create association");
    }
    return res.json() as Promise<AssociationDto>;
}

export async function updateAssociation(id: string, patch: { name?: string; description?: string }): Promise<AssociationDto> {
    const res = await apiFetch(`/api/associations/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to update association");
    }
    return res.json() as Promise<AssociationDto>;
}

export async function addAssociationMember(id: string, handle: string): Promise<AssociationDto> {
    const res = await apiFetch(`/api/associations/${encodeURIComponent(id)}/members`, {
        method: "POST",
        body: JSON.stringify({ handle }),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to add member");
    }
    return res.json() as Promise<AssociationDto>;
}

export async function removeAssociationMember(id: string, handle: string): Promise<AssociationDto> {
    const res = await apiFetch(`/api/associations/${encodeURIComponent(id)}/members/${encodeURIComponent(handle)}`, {
        method: "DELETE",
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to remove member");
    }
    return res.json() as Promise<AssociationDto>;
}

export async function addAssociationAdmin(id: string, handle: string): Promise<AssociationDto> {
    const res = await apiFetch(`/api/associations/${encodeURIComponent(id)}/admins`, {
        method: "POST",
        body: JSON.stringify({ handle }),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to promote admin");
    }
    return res.json() as Promise<AssociationDto>;
}

export async function removeAssociationAdmin(id: string, handle: string): Promise<AssociationDto> {
    const res = await apiFetch(`/api/associations/${encodeURIComponent(id)}/admins/${encodeURIComponent(handle)}`, {
        method: "DELETE",
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to remove admin");
    }
    return res.json() as Promise<AssociationDto>;
}

// ── Domains ───────────────────────────────────────────────────────────────────

export interface DomainDto {
    id: string;
    name: string;
    handle: string;
    description: string;
    unitIds: string[];
    roleIds: string[];
    poolId: string | null;
}

export interface UnitDto {
    id: string;
    name: string;
    description: string;
    type: string;
    personHandles: string[];
    roleIds: string[];
    locationId: string | null;
    createdAt: string;
}

export async function listDomains(): Promise<DomainDto[]> {
    const res = await fetch("/api/domains");
    if (!res.ok) throw new Error("Failed to load domains");
    return res.json() as Promise<DomainDto[]>;
}

export async function getDomain(id: string): Promise<DomainDto> {
    const res = await fetch(`/api/domains/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error("Domain not found");
    return res.json() as Promise<DomainDto>;
}

export async function updateDomain(id: string, patch: { poolId?: string | null }): Promise<DomainDto> {
    const res = await apiFetch(`/api/domains/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body:   JSON.stringify(patch),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to update domain");
    }
    return res.json() as Promise<DomainDto>;
}

export interface DomainBudgetDto {
    payroll: BudgetPayrollRow[];
    items:   BudgetItem[];
    totals:  { payroll: number; items: number; total: number };
}

export async function getDomainBudget(id: string): Promise<DomainBudgetDto> {
    const res = await fetch(`/api/domains/${encodeURIComponent(id)}/budget`);
    if (!res.ok) throw new Error("Domain not found");
    return res.json() as Promise<DomainBudgetDto>;
}

export async function addBudgetItem(
    domainId: string,
    item: { label: string; amount: number; category?: string; note?: string },
): Promise<BudgetItem> {
    const res = await apiFetch(`/api/domains/${encodeURIComponent(domainId)}/budget/items`, {
        method: "POST",
        body:   JSON.stringify(item),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to add budget item");
    }
    return res.json() as Promise<BudgetItem>;
}

export async function removeBudgetItem(domainId: string, itemId: string): Promise<void> {
    const res = await apiFetch(
        `/api/domains/${encodeURIComponent(domainId)}/budget/items/${encodeURIComponent(itemId)}`,
        { method: "DELETE" },
    );
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to remove budget item");
    }
}

export async function listUnits(): Promise<UnitDto[]> {
    const res = await fetch("/api/units");
    if (!res.ok) throw new Error("Failed to load units");
    return res.json() as Promise<UnitDto[]>;
}

export interface TemplateDto {
    type:        string;
    label:       string;
    description: string;
}

export async function listTemplates(): Promise<TemplateDto[]> {
    const res = await fetch("/api/templates");
    if (!res.ok) throw new Error("Failed to load templates");
    return res.json() as Promise<TemplateDto[]>;
}

export async function createUnit(type: string, domainId: string): Promise<UnitDto> {
    const res = await apiFetch("/api/units", {
        method: "POST",
        body:   JSON.stringify({ type, domainId }),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to create unit");
    }
    return res.json() as Promise<UnitDto>;
}

export async function getUnit(id: string): Promise<UnitDto> {
    const res = await fetch(`/api/units/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error("Unit not found");
    return res.json() as Promise<UnitDto>;
}

export async function updateUnit(id: string, patch: {
    name?: string;
    description?: string;
    locationId?: string | null;
}): Promise<UnitDto> {
    const res = await apiFetch(`/api/units/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body:   JSON.stringify(patch),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to update unit");
    }
    return res.json() as Promise<UnitDto>;
}

// ── Roles ──────────────────────────────────────────────────────────────────────

export interface ScheduleSlot {
    /** 0 = Sunday, 1 = Monday … 6 = Saturday */
    dayOfWeek: number;
    /** "HH:MM" 24-hour */
    startTime: string;
    /** "HH:MM" 24-hour */
    endTime: string;
}

export interface RoleDto {
    id:             string;
    roleTypeId:     string | null;
    title:          string;
    description:    string;
    memberHandle:   string | null;
    kinPerMonth:    number;
    funded:         boolean;
    termStartDate:  string | null;
    termEndDate:    string | null;
    isActive:       boolean;
    weeklySchedule: ScheduleSlot[];
}

export interface RoleTypeDto {
    id:                 string;
    title:              string;
    description:        string;
    defaultKinPerMonth: number;
    preferredUnitTypes: string[];
    category:           string;
    responsibilities:   string[];
    qualifications:     string[];
}

export async function getRoleType(id: string): Promise<RoleTypeDto> {
    const res = await fetch(`/api/role-types/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error("Failed to load role type");
    return res.json() as Promise<RoleTypeDto>;
}

export async function listRoles(): Promise<RoleDto[]> {
    const res = await fetch("/api/roles");
    if (!res.ok) throw new Error("Failed to load roles");
    return res.json() as Promise<RoleDto[]>;
}

export async function listRoleTypes(): Promise<RoleTypeDto[]> {
    const res = await fetch("/api/role-types");
    if (!res.ok) throw new Error("Failed to load role types");
    return res.json() as Promise<RoleTypeDto[]>;
}

export interface UnitTypeDto {
    type:        string;
    label:       string;
    description: string;
    custom:      boolean;
}

export async function listUnitTypes(): Promise<UnitTypeDto[]> {
    const res = await fetch("/api/unit-types");
    if (!res.ok) throw new Error("Failed to load unit types");
    return res.json() as Promise<UnitTypeDto[]>;
}

export async function createRole(payload: {
    unitId: string;
    title?: string;
    description?: string;
    kinPerMonth?: number;
    roleTypeId?: string;
}): Promise<RoleDto> {
    const res = await apiFetch("/api/roles", {
        method: "POST",
        body:   JSON.stringify(payload),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to create role");
    }
    return res.json() as Promise<RoleDto>;
}

export async function updateRole(id: string, patch: {
    title?: string;
    description?: string;
    kinPerMonth?: number;
    funded?: boolean;
    memberHandle?: string | null;
    weeklySchedule?: ScheduleSlot[];
}): Promise<RoleDto> {
    const res = await apiFetch(`/api/roles/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body:   JSON.stringify(patch),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to update role");
    }
    return res.json() as Promise<RoleDto>;
}

export async function deleteRole(id: string): Promise<void> {
    const res = await apiFetch(`/api/roles/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to delete role");
    }
}

// ── Pools ─────────────────────────────────────────────────────────────────────

export interface PoolDto {
    id: string;
    name: string;
    description: string;
    mandate: string;
    personHandles: string[];
    createdAt: string;
}

export async function listPools(): Promise<PoolDto[]> {
    const res = await apiFetch("/api/pools");
    if (!res.ok) throw new Error("Failed to load pools");
    return res.json() as Promise<PoolDto[]>;
}

export async function getPool(id: string): Promise<PoolDto> {
    const res = await apiFetch(`/api/pools/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error("Pool not found");
    return res.json() as Promise<PoolDto>;
}

export async function createPool(name: string, description = ""): Promise<PoolDto> {
    const res = await apiFetch("/api/pools", {
        method: "POST",
        body: JSON.stringify({ name, description }),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to create pool");
    }
    return res.json() as Promise<PoolDto>;
}

export async function updatePool(id: string, data: { mandate?: string; name?: string; description?: string }): Promise<PoolDto> {
    const res = await apiFetch(`/api/pools/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to update pool");
    }
    return res.json() as Promise<PoolDto>;
}

export async function addPoolMember(poolId: string, handle: string): Promise<PoolDto> {
    const res = await apiFetch(`/api/pools/${encodeURIComponent(poolId)}/members`, {
        method: "POST",
        body: JSON.stringify({ handle }),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to add pool member");
    }
    return res.json() as Promise<PoolDto>;
}

export async function removePoolMember(poolId: string, handle: string): Promise<PoolDto> {
    const res = await apiFetch(`/api/pools/${encodeURIComponent(poolId)}/members/${encodeURIComponent(handle)}`, {
        method: "DELETE",
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to remove pool member");
    }
    return res.json() as Promise<PoolDto>;
}

export async function deletePool(poolId: string): Promise<void> {
    const res = await apiFetch(`/api/pools/${encodeURIComponent(poolId)}`, { method: "DELETE" });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to delete pool");
    }
}

// Public (no auth required) — applicant submits their own application.
export async function submitPublicApplication(payload: {
    firstName: string;
    lastName: string;
    birthDate: string;
    message: string;
}): Promise<MotionDto> {
    const res = await apiFetch("/api/apply", {
        method: "POST",
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to submit application");
    }
    return res.json() as Promise<MotionDto>;
}

// ── Locations ─────────────────────────────────────────────────────────────────

export interface LocationDto {
    id:          string;
    name:        string;
    address:     string;
    lat:         number | null;
    lng:         number | null;
    description: string;
    createdAt:   string;
}

export async function listLocations(): Promise<LocationDto[]> {
    const res = await fetch("/api/locations");
    if (!res.ok) throw new Error("Failed to load locations");
    return res.json() as Promise<LocationDto[]>;
}

export async function getLocation(id: string): Promise<LocationDto> {
    const res = await fetch(`/api/locations/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error("Location not found");
    return res.json() as Promise<LocationDto>;
}

export async function createLocation(data: {
    name: string;
    address: string;
    lat?: number | null;
    lng?: number | null;
    description?: string;
}): Promise<LocationDto> {
    const res = await apiFetch("/api/locations", {
        method: "POST",
        body:   JSON.stringify(data),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to create location");
    }
    return res.json() as Promise<LocationDto>;
}

export async function updateLocation(id: string, patch: {
    name?: string;
    address?: string;
    lat?: number | null;
    lng?: number | null;
    description?: string;
}): Promise<LocationDto> {
    const res = await apiFetch(`/api/locations/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body:   JSON.stringify(patch),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to update location");
    }
    return res.json() as Promise<LocationDto>;
}

export async function deleteLocation(id: string): Promise<void> {
    const res = await apiFetch(`/api/locations/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to delete location");
    }
}

// ── Network / Nodes ───────────────────────────────────────────────────────────

export type NodeType = "community" | "infrastructure" | "federation" | "forum";

export interface NodeIdentityDto {
    id: string;
    type: NodeType;
    name: string;
    address: string;
    publicKey: string;
    createdAt: string;
}

export interface PeerRecordDto {
    id: string;
    type: NodeType;
    name: string;
    address: string;
    publicKey: string;
    firstSeenAt: string;
    lastSeenAt: string;
    lastLatencyMs: number | null;
    consecutiveFailures: number;
    healthy: boolean;
}

export async function getNodeIdentity(): Promise<NodeIdentityDto> {
    const res = await apiFetch("/api/node/identity");
    if (!res.ok) throw new Error("Failed to load node identity");
    return res.json() as Promise<NodeIdentityDto>;
}

export async function getNodePeers(): Promise<PeerRecordDto[]> {
    const res = await apiFetch("/api/node/peers");
    if (!res.ok) throw new Error("Failed to load peers");
    return res.json() as Promise<PeerRecordDto[]>;
}

// ── Vacancies & Expiring Roles ────────────────────────────────────────────────

export interface VacancyDto {
    roleId:      string;
    roleTitle:   string;
    kinPerMonth: number;
    unitId:      string;
    unitName:    string;
    domainId:    string;
    domainName:  string;
}

export interface ExpiringRoleDto {
    roleId:       string;
    roleTitle:    string;
    memberHandle: string | null;
    termEndDate:  string;
    unitId:       string;
    unitName:     string;
    domainId:     string;
    domainName:   string;
}

export interface RoleDto {
    id:             string;
    roleTypeId:     string | null;
    title:          string;
    description:    string;
    memberHandle:   string | null;
    kinPerMonth:    number;
    funded:         boolean;
    termStartDate:  string | null;
    termEndDate:    string | null;
    isActive:       boolean;
    weeklySchedule: string | null;
}

export async function listVacancies(): Promise<VacancyDto[]> {
    const res = await apiFetch("/api/roles/vacancies");
    if (!res.ok) throw new Error("Failed to load vacancies");
    return res.json() as Promise<VacancyDto[]>;
}

export async function getRole(id: string): Promise<RoleDto> {
    const res = await apiFetch(`/api/roles/${id}`);
    if (!res.ok) throw new Error("Role not found");
    return res.json() as Promise<RoleDto>;
}

export async function listExpiringRoles(days = 60): Promise<ExpiringRoleDto[]> {
    const res = await apiFetch(`/api/roles/expiring?days=${days}`);
    if (!res.ok) throw new Error("Failed to load expiring roles");
    return res.json() as Promise<ExpiringRoleDto[]>;
}

// ── Motions ───────────────────────────────────────────────────────────────────

export type MotionStage   = "draft" | "deliberating" | "voting" | "resolved";
export type MotionOutcome = "passed" | "failed" | "withdrawn" | "referred";

// ── Authorities ───────────────────────────────────────────────────────────────

/** A single power granted to an authority by an authority.grant directive. */
export interface AuthorityPower {
    action:     string;
    voteRuleId: string;
    /** Section id that declared the grant, e.g. "II.5" */
    sectionId:  string;
    /** Document id that contains the granting section, e.g. "constitution" */
    docId:      string;
}

export interface AuthorityDto {
    id:                string;
    name:              string;
    description?:      string;
    kind:              string;
    defaultVoteRuleId: string;
    /** Powers granted to this authority by authority.grant directives in active documents. */
    powers:            AuthorityPower[];
}

export async function getAuthorities(): Promise<AuthorityDto[]> {
    const res = await apiFetch("/api/authorities");
    if (!res.ok) throw new Error("Failed to load authorities");
    return res.json() as Promise<AuthorityDto[]>;
}

export type VoteLegitimacy = "absolute-majority" | "majority-of-votes" | "petition";

export interface VoteRule {
    id:                string;
    label:             string;
    legitimacy:        VoteLegitimacy;
    thresholdFraction?: number;
    deliberationDays:   number;
    votingWindowDays:   number;
}

export type CommentKind = "evidence" | "challenge" | "general";

export interface MotionComment {
    id:           string;
    authorHandle: string;
    body:         string;
    kind:         CommentKind;
    createdAt:    string;
}

export interface MotionDissent {
    authorHandle: string;
    body:         string;
    recordedAt:   string;
}

export interface MotionVote {
    handle:    string;
    vote:      "approve" | "reject" | "abstain";
    votedAt:   string;
}

export interface MotionEffectKind {
    kind:      string;
    label:     string;
    authorityId?: string;
}

export interface MotionDto {
    id:                   string;
    authorityId:          string;
    stage:                MotionStage;
    title:                string;
    description:          string;
    proposerHandle:       string;
    createdAt:            string;
    deliberationStartedAt: string | null;
    votingOpensAt:        string | null;
    votingClosesAt:       string | null;
    minApprovals:         number | null;
    voteRuleId:           string | null;
    premises:             string | null;
    expectedOutcome:      string | null;
    votes:                MotionVote[];
    comments:             MotionComment[];
    dissents:             MotionDissent[];
    outcome:              MotionOutcome | null;
    outcomeNote:          string;
    resolvedAt:           string | null;
    referredToId:         string | null;
    parentId:             string | null;
    pendingAmendmentIds:  string[];
    approvalCount:        number;
    rejectionCount:       number;
    kind:                 string | null;
    payload:              string | null;
}

export async function listMotions(opts: { authorityId?: string; stage?: string; kind?: string } = {}): Promise<MotionDto[]> {
    const params = new URLSearchParams();
    if (opts.authorityId) params.set("authorityId", opts.authorityId);
    if (opts.stage)       params.set("stage",       opts.stage);
    if (opts.kind)        params.set("kind",        opts.kind);
    const qs = params.toString();
    const res = await apiFetch(`/api/motions${qs ? `?${qs}` : ""}`);
    if (!res.ok) throw new Error("Failed to load motions");
    return res.json() as Promise<MotionDto[]>;
}

export async function getMotion(id: string): Promise<MotionDto> {
    const res = await apiFetch(`/api/motions/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error("Motion not found");
    return res.json() as Promise<MotionDto>;
}

export async function listMotionEffects(): Promise<MotionEffectKind[]> {
    const res = await apiFetch("/api/motions/effects");
    if (!res.ok) throw new Error("Failed to load motion effects");
    return res.json() as Promise<MotionEffectKind[]>;
}

export async function listVoteRules(): Promise<VoteRule[]> {
    const res = await apiFetch("/api/motions/vote-rules");
    if (!res.ok) throw new Error("Failed to load vote rules");
    return res.json() as Promise<VoteRule[]>;
}

export async function createMotion(data: {
    authorityId:     string;
    title:           string;
    description:     string;
    parentId?:       string;
    kind?:           string | null;
    payload?:        unknown;
    premises?:       string;
    expectedOutcome?: string;
}): Promise<MotionDto> {
    const res = await apiFetch("/api/motions", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(data),
    });
    if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(b.error ?? "Failed to create motion");
    }
    return res.json() as Promise<MotionDto>;
}

export async function submitMotionForDeliberation(id: string, voteRuleId: string, minApprovals?: number): Promise<MotionDto> {
    const res = await apiFetch(`/api/motions/${encodeURIComponent(id)}/deliberate`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ voteRuleId, ...(minApprovals !== undefined ? { minApprovals } : {}) }),
    });
    if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(b.error ?? "Failed to submit motion");
    }
    return res.json() as Promise<MotionDto>;
}

export async function openMotionVoting(id: string): Promise<MotionDto> {
    const res = await apiFetch(`/api/motions/${encodeURIComponent(id)}/open-voting`, { method: "POST" });
    if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(b.error ?? "Failed to open voting");
    }
    return res.json() as Promise<MotionDto>;
}

export async function castMotionVote(id: string, vote: "approve" | "reject" | "abstain"): Promise<MotionDto> {
    const res = await apiFetch(`/api/motions/${encodeURIComponent(id)}/vote`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ vote }),
    });
    if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(b.error ?? "Failed to cast vote");
    }
    return res.json() as Promise<MotionDto>;
}

export async function addMotionComment(id: string, body: string, kind: CommentKind = "general"): Promise<MotionDto> {
    const res = await apiFetch(`/api/motions/${encodeURIComponent(id)}/comment`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ body, kind }),
    });
    if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(b.error ?? "Failed to add comment");
    }
    return res.json() as Promise<MotionDto>;
}

export async function recordMotionDissent(id: string, body: string): Promise<MotionDto> {
    const res = await apiFetch(`/api/motions/${encodeURIComponent(id)}/dissent`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ body }),
    });
    if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(b.error ?? "Failed to record dissent");
    }
    return res.json() as Promise<MotionDto>;
}

export async function markMotionDiscussed(id: string): Promise<MotionDto> {
    const res = await apiFetch(`/api/motions/${encodeURIComponent(id)}/discuss`, { method: "POST" });
    if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(b.error ?? "Failed to mark discussed");
    }
    return res.json() as Promise<MotionDto>;
}

export async function recordMotionOutcome(id: string, outcome: MotionOutcome, outcomeNote = ""): Promise<MotionDto> {
    const res = await apiFetch(`/api/motions/${encodeURIComponent(id)}/outcome`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ outcome, outcomeNote }),
    });
    if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(b.error ?? "Failed to record outcome");
    }
    return res.json() as Promise<MotionDto>;
}

export async function withdrawMotion(id: string): Promise<MotionDto> {
    const res = await apiFetch(`/api/motions/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(b.error ?? "Failed to withdraw motion");
    }
    return res.json() as Promise<MotionDto>;
}

// ── Shifts ────────────────────────────────────────────────────────────────────

export interface ShiftDto {
    id:               string;
    domainId:         string;
    label:            string;
    startAt:          string;
    endAt:            string;
    assignedHandle:   string | null;
    note:             string | null;
    createdBy:        string;
    createdAt:        string;
    isOpen:           boolean;
}

export async function listShifts(opts: {
    domainId?: string;
    handle?: string;
    open?: boolean;
    from?: string;
    to?: string;
} = {}): Promise<ShiftDto[]> {
    const params = new URLSearchParams();
    if (opts.domainId) params.set("domainId", opts.domainId);
    if (opts.handle)   params.set("handle", opts.handle);
    if (opts.open)     params.set("open", "true");
    if (opts.from)     params.set("from", opts.from);
    if (opts.to)       params.set("to", opts.to);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await apiFetch(`/api/shifts${qs}`);
    if (!res.ok) throw new Error("Failed to load shifts");
    return res.json() as Promise<ShiftDto[]>;
}

export async function createShift(data: {
    domainId: string;
    label:    string;
    startAt:  string;
    endAt:    string;
    note?:    string | null;
}): Promise<ShiftDto> {
    const res = await apiFetch("/api/shifts", {
        method: "POST",
        body:   JSON.stringify(data),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to create shift");
    }
    return res.json() as Promise<ShiftDto>;
}

export async function claimShift(id: string): Promise<ShiftDto> {
    const res = await apiFetch(`/api/shifts/${encodeURIComponent(id)}/claim`, { method: "POST" });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to claim shift");
    }
    return res.json() as Promise<ShiftDto>;
}

export async function unclaimShift(id: string): Promise<ShiftDto> {
    const res = await apiFetch(`/api/shifts/${encodeURIComponent(id)}/unclaim`, { method: "POST" });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to unclaim shift");
    }
    return res.json() as Promise<ShiftDto>;
}

export async function deleteShift(id: string): Promise<void> {
    const res = await apiFetch(`/api/shifts/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Failed to delete shift");
    }
}

// ── Activity Log ──────────────────────────────────────────────────────────────

export type ActivityLogType =
    | "motion-passed"
    | "motion-failed"
    | "motion-withdrawn"
    | "member-joined"
    | "member-discharged"
    | "demurrage-run"
    | "dues-collected"
    | "constitution-amended"
    | "annual-issuance"
    | "pool-created"
    | "assembly-drawn"
    | "bylaw-created"
    | "bylaw-amended"
    | "bylaw-expired"
    | "role-type-added"
    | "role-type-removed"
    | "unit-type-added"
    | "unit-type-removed"
    | "unit-deployed"
    | "marketplace-founded";

export interface ActivityLogEntry {
    id:         string;
    type:       ActivityLogType;
    summary:    string;
    actorId:    string | null;
    refId:      string | null;
    occurredAt: string;
}

export async function getCommunityLog(opts: { limit?: number; before?: string } = {}): Promise<ActivityLogEntry[]> {
    const params = new URLSearchParams();
    if (opts.limit)  params.set("limit",  String(opts.limit));
    if (opts.before) params.set("before", opts.before);
    const url = `/api/log${params.size ? "?" + params.toString() : ""}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load community log");
    return res.json() as Promise<ActivityLogEntry[]>;
}

// ── Community Calendar ────────────────────────────────────────────────────────

export type RecurrenceRule = "daily" | "weekly" | "biweekly" | "monthly" | "yearly";

export interface CalendarRsvp {
    handle:      string | null;
    status:      "yes" | "no" | "maybe";
    respondedAt: string;
}

export interface CalendarEventDto {
    id:               string;
    title:            string;
    description:      string | null;
    location:         string | null;
    startAt:          string;
    endAt:            string | null;
    allDay:           boolean;
    cancelledAt:      string | null;
    organizerId:      string | null;  // handle when organizerType=person, org ID when org
    organizerType:    "person" | "org";
    createdByHandle:  string | null;
    createdAt:        string;
    rsvps:            CalendarRsvp[];
    recurrence:       RecurrenceRule | null;
    recurrenceEndsAt: string | null;
    occurrenceDate:   string | null;
}

export async function listCalendarEvents(opts: { from?: string; to?: string; upcoming?: number } = {}): Promise<CalendarEventDto[]> {
    const params = new URLSearchParams();
    if (opts.from)     params.set("from",     opts.from);
    if (opts.to)       params.set("to",       opts.to);
    if (opts.upcoming) params.set("upcoming", String(opts.upcoming));
    const url = `/api/calendar${params.size ? "?" + params.toString() : ""}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load calendar events");
    return res.json() as Promise<CalendarEventDto[]>;
}

export async function createCalendarEvent(data: {
    title:             string;
    startAt:           string;
    organizerHandle?:  string;       // required when organizerType = 'person'
    organizerId?:      string;       // required when organizerType = 'org'
    organizerType:     "person" | "org";
    endAt?:            string | null;
    allDay?:           boolean;
    description?:      string | null;
    location?:         string | null;
    recurrence?:       RecurrenceRule | null;
    recurrenceEndsAt?: string | null;
}): Promise<CalendarEventDto> {
    const res = await apiFetch("/api/calendar", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(data),
    });
    if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(b.error ?? "Failed to create event");
    }
    return res.json() as Promise<CalendarEventDto>;
}

export async function updateCalendarEvent(id: string, patch: {
    title?:            string;
    description?:      string | null;
    location?:         string | null;
    startAt?:          string;
    endAt?:            string | null;
    allDay?:           boolean;
    recurrence?:       RecurrenceRule | null;
    recurrenceEndsAt?: string | null;
}): Promise<CalendarEventDto> {
    const res = await apiFetch(`/api/calendar/${encodeURIComponent(id)}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(patch),
    });
    if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(b.error ?? "Failed to update event");
    }
    return res.json() as Promise<CalendarEventDto>;
}

export async function cancelCalendarEvent(id: string): Promise<CalendarEventDto> {
    const res = await apiFetch(`/api/calendar/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(b.error ?? "Failed to cancel event");
    }
    return res.json() as Promise<CalendarEventDto>;
}

export async function rsvpCalendarEvent(id: string, status: "yes" | "no" | "maybe"): Promise<CalendarEventDto> {
    const res = await apiFetch(`/api/calendar/${encodeURIComponent(id)}/rsvp`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status }),
    });
    if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(b.error ?? "Failed to RSVP");
    }
    return res.json() as Promise<CalendarEventDto>;
}

export async function removeCalendarRsvp(id: string, handle: string): Promise<CalendarEventDto> {
    const res = await apiFetch(`/api/calendar/${encodeURIComponent(id)}/rsvp/${encodeURIComponent(handle)}`, { method: "DELETE" });
    if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(b.error ?? "Failed to remove RSVP");
    }
    return res.json() as Promise<CalendarEventDto>;
}



// ── Desired State (debug) ─────────────────────────────────────────────────────

export interface DesiredDomain {
    id:          string;
    name:        string;
    description: string;
    docId:       string;
    sectionId:   string;
    exists:      boolean;
}

export interface DesiredUnit {
    domainId:    string;
    unitType:    string;
    name:        string;
    description: string;
    docId:       string;
    sectionId:   string;
}

export interface DesiredPool {
    id:         string;
    name:       string;
    voteRuleId: string;
    mandate:    string;
    docId:      string;
    sectionId:  string;
    exists:     boolean;
}

export interface DesiredLink {
    poolId:    string;
    domainId:  string;
    docId:     string;
    sectionId: string;
}

export interface DesiredStateDto {
    domains: DesiredDomain[];
    units:   DesiredUnit[];
    pools:   DesiredPool[];
    links:   DesiredLink[];
}

export async function getDesiredState(): Promise<DesiredStateDto> {
    const res = await apiFetch("/api/debug/desired-state");
    if (!res.ok) throw new Error("Failed to load desired state");
    return res.json() as Promise<DesiredStateDto>;
}
