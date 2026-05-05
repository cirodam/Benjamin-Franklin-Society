import { getToken, session } from "./session.js";

async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
    const token = getToken();
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(input, { ...init, headers });
    if (res.status === 401) session.logout();
    return res;
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type PlantingWindowSeason = "fall" | "spring" | "main" | "perennial";
export type PlantingWindow = `${PlantingWindowSeason}-${number}`;

export type FarmStatus = "pending" | "eligible" | "suspended" | "retired";
export type ContractType = "annual" | "perennial";
export type ContractStatus = "proposed" | "approved" | "active" | "fulfilled" | "disputed" | "cancelled";
export type CropCategory = "grain" | "legume" | "vegetable" | "fruit" | "forage" | "other";
export type InspectionOutcome = "compliant" | "minor-concern" | "violation" | "critical-violation";
export type CoverageStatus = "uncovered" | "minimum-met" | "full";

export interface PracticeDeclaration {
    soilMethods:     string[];
    prohibitedInputs: string[];
    waterSource:     string;
    cropDiversity:   string;
    seedSource:      string;
    notes:           string;
}

export interface FarmAssociation {
    id:                  string;
    createdAt:           string;
    updatedAt:           string;
    name:                string;
    homeCommunityId:     string;
    operatorIds:         string[];
    location:            string;
    acreage:             number;
    practices:           PracticeDeclaration;
    status:              FarmStatus;
    eligibilityMotionId: string | null;
    contracts:           string[];
}

export interface CropNeedEntry {
    id:                       string;
    crop:                     string;
    category:                 CropCategory;
    maxContractLbs:           number;
    minDesiredLbs:            number;
    estimatedPaymentPerLbKin: number;
    notes:                    string;
}

export interface NeedsProjection {
    id:                 string;
    plantingWindow:     PlantingWindow;
    memberHeadcount:    number;
    reserveTargetWeeks: number;
    cropNeeds:          CropNeedEntry[];
    publishedAt:        string;
    approvedByMotionId: string | null;
}

export interface CoverageEntry {
    cropNeedEntryId: string;
    crop:            string;
    committedLbs:    number;
    maxContractLbs:  number;
    minDesiredLbs:   number;
    coveragePct:     number;
    status:          CoverageStatus;
}

export interface DeliveryScheduleEntry { date: string; estimatedLbs: number; }

export interface CropPlanEntry {
    cropNeedEntryId:     string;
    crop:                string;
    category:            CropCategory;
    acreage:             number;
    estimatedYieldLbs:   number;
    floorYieldLbs:       number;
    ceilingYieldLbs:     number;
    deliverySchedule:    DeliveryScheduleEntry[];
    reserveAllocationPct: number;
}

export interface PaymentMilestone { description: string; amountKin: number; scheduledDate: string; }

export interface PaymentTerms {
    basePaymentKin:         number;
    advancePaymentKin:      number;
    advanceMilestones:      PaymentMilestone[];
    surplusSplitFarmerPct:  number;
    surplusSplitCommunityPct: number;
    externalPaymentUsd:     number | null;
}

export interface ResourceCommitment {
    type:           string;
    description:    string;
    quantity:       number | null;
    unit:           string | null;
    scheduledDates: string[];
}

export interface DeliveryRecord {
    id:                  string;
    recordedAt:          string;
    cropPlanEntryId:     string;
    actualYieldLbs:      number;
    moisturePct:         number | null;
    receivedBy:          string;
    notes:               string;
    reserveAllocatedLbs: number;
    marketAllocatedLbs:  number;
}

export interface InspectionRecord {
    id:                 string;
    conductedAt:        string;
    inspectorId:        string;
    findings:           string;
    practiceViolations: string[];
    outcome:            InspectionOutcome;
    followUpRequired:   boolean;
    followUpDate:       string | null;
}

export interface SettlementRecord {
    settledAt:            string;
    totalDeliveredLbs:    number;
    basePaymentPaid:      number;
    surplusPaymentPaid:   number;
    shortfallAbsorbed:    number;
    advanceReconciled:    number;
    externalPaymentUsd:   number | null;
    notes:                string;
    disputeRaised:        boolean;
}

export interface FarmContract {
    id:                     string;
    createdAt:              string;
    updatedAt:              string;
    farmId:                 string;
    contractingCommunityId: string;
    needsProjectionId:      string;
    contractType:           ContractType;
    plantingWindow:         PlantingWindow;
    cropPlan:               CropPlanEntry[];
    paymentTerms:           PaymentTerms;
    resourceCommitments:    ResourceCommitment[];
    advancePaidAt:          string | null;
    deliveries:             DeliveryRecord[];
    inspections:            InspectionRecord[];
    settlement:             SettlementRecord | null;
    status:                 ContractStatus;
    approvalMotionId:       string | null;
    notes:                  string;
}

// ── Farm associations ─────────────────────────────────────────────────────────

export async function listFarms(params?: { status?: FarmStatus }): Promise<FarmAssociation[]> {
    const qs = params?.status ? `?status=${params.status}` : "";
    const res = await apiFetch(`/api/farms${qs}`);
    return res.json() as Promise<FarmAssociation[]>;
}

export async function getFarm(id: string): Promise<FarmAssociation> {
    const res = await apiFetch(`/api/farms/${id}`);
    return res.json() as Promise<FarmAssociation>;
}

// ── Needs projections ─────────────────────────────────────────────────────────

export async function listProjections(): Promise<NeedsProjection[]> {
    const res = await apiFetch("/api/projections");
    return res.json() as Promise<NeedsProjection[]>;
}

export async function getProjection(id: string): Promise<NeedsProjection> {
    const res = await apiFetch(`/api/projections/${id}`);
    return res.json() as Promise<NeedsProjection>;
}

export async function getProjectionCoverage(id: string): Promise<CoverageEntry[]> {
    const res = await apiFetch(`/api/projections/${id}/coverage`);
    return res.json() as Promise<CoverageEntry[]>;
}

export interface PublishProjectionParams {
    plantingWindow:     PlantingWindow;
    memberHeadcount:    number;
    reserveTargetWeeks: number;
    cropNeeds:          Omit<CropNeedEntry, "id">[];
}

export async function publishProjection(params: PublishProjectionParams): Promise<NeedsProjection> {
    const res = await apiFetch("/api/projections", {
        method: "POST",
        body:   JSON.stringify(params),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" })) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    return res.json() as Promise<NeedsProjection>;
}

// ── Contracts ─────────────────────────────────────────────────────────────────

export async function listContracts(params?: {
    status?: ContractStatus; farmId?: string; projectionId?: string; window?: string;
}): Promise<FarmContract[]> {
    const qs = new URLSearchParams();
    if (params?.status)       qs.set("status", params.status);
    if (params?.farmId)       qs.set("farmId", params.farmId);
    if (params?.projectionId) qs.set("projectionId", params.projectionId);
    if (params?.window)       qs.set("window", params.window);
    const q = qs.toString();
    const res = await apiFetch(`/api/contracts${q ? `?${q}` : ""}`);
    return res.json() as Promise<FarmContract[]>;
}

export async function getContract(id: string): Promise<FarmContract> {
    const res = await apiFetch(`/api/contracts/${id}`);
    return res.json() as Promise<FarmContract>;
}

export interface SubmitContractParams {
    farmId:               string;
    needsProjectionId:    string;
    contractType:         ContractType;
    plantingWindow:       PlantingWindow;
    cropPlan:             Omit<CropPlanEntry, never>[];
    paymentTerms:         PaymentTerms;
    resourceCommitments:  ResourceCommitment[];
    notes:                string;
}

export async function submitContract(params: SubmitContractParams): Promise<FarmContract> {
    const res = await apiFetch("/api/contracts", {
        method: "POST",
        body:   JSON.stringify(params),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" })) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    return res.json() as Promise<FarmContract>;
}
