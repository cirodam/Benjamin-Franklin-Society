// ── Planting windows ───────────────────────────────────────────────────────────

export type PlantingWindowSeason = "fall" | "spring" | "main" | "perennial";
export type PlantingWindow = `${PlantingWindowSeason}-${number}`; // e.g. "fall-2026"

// ── Enums / union types ────────────────────────────────────────────────────────

export type FarmStatus = "pending" | "eligible" | "suspended" | "retired";

export type ContractType = "annual" | "perennial";

export type ContractStatus =
    | "proposed"
    | "approved"
    | "active"
    | "fulfilled"
    | "disputed"
    | "cancelled";

export type CropCategory = "grain" | "legume" | "vegetable" | "fruit" | "forage" | "other";

export type ResourceType = "equipment" | "labor" | "seed" | "inputs" | "infrastructure";

export type InspectionOutcome =
    | "compliant"
    | "minor-concern"
    | "violation"
    | "critical-violation";

// ── Practice declaration ───────────────────────────────────────────────────────

export interface PracticeDeclaration {
    soilMethods: string[];
    prohibitedInputs: string[];
    waterSource: string;
    cropDiversity: string;
    seedSource: string;
    notes: string;
}

// ── Farm association ───────────────────────────────────────────────────────────

export interface FarmAssociation {
    id: string;
    createdAt: string;
    updatedAt: string;
    name: string;
    homeCommunityId: string;
    operatorIds: string[];
    location: string;
    acreage: number;
    practices: PracticeDeclaration;
    status: FarmStatus;
    eligibilityMotionId: string | null;
    contracts: string[];
}

// ── Needs projection ───────────────────────────────────────────────────────────

export interface CropNeedEntry {
    id: string;
    crop: string;
    category: CropCategory;
    maxContractLbs: number;
    minDesiredLbs: number;
    estimatedPaymentPerLbKin: number;
    notes: string;
}

export interface NeedsProjection {
    id: string;
    plantingWindow: PlantingWindow;
    memberHeadcount: number;
    reserveTargetWeeks: number;
    cropNeeds: CropNeedEntry[];
    publishedAt: string;
    approvedByMotionId: string | null;
}

// ── Farm contract ──────────────────────────────────────────────────────────────

export interface DeliveryScheduleEntry {
    date: string;       // ISO 8601
    estimatedLbs: number;
}

export interface CropPlanEntry {
    cropNeedEntryId: string;
    crop: string;
    category: CropCategory;
    acreage: number;
    estimatedYieldLbs: number;
    floorYieldLbs: number;
    ceilingYieldLbs: number;
    deliverySchedule: DeliveryScheduleEntry[];
    reserveAllocationPct: number;
}

export interface PaymentMilestone {
    description: string;
    amountKin: number;
    scheduledDate: string;
}

export interface PaymentTerms {
    basePaymentKin: number;
    advancePaymentKin: number;
    advanceMilestones: PaymentMilestone[];
    surplusSplitFarmerPct: number;
    surplusSplitCommunityPct: number;
    externalPaymentUsd: number | null;
}

export interface ResourceCommitment {
    type: ResourceType;
    description: string;
    quantity: number | null;
    unit: string | null;
    scheduledDates: string[];
}

export interface DeliveryRecord {
    id: string;
    recordedAt: string;
    cropPlanEntryId: string;
    actualYieldLbs: number;
    moisturePct: number | null;
    receivedBy: string;
    notes: string;
    reserveAllocatedLbs: number;
    marketAllocatedLbs: number;
}

export interface InspectionRecord {
    id: string;
    conductedAt: string;
    inspectorId: string;
    findings: string;
    practiceViolations: string[];
    outcome: InspectionOutcome;
    followUpRequired: boolean;
    followUpDate: string | null;
}

export interface SettlementRecord {
    settledAt: string;
    totalDeliveredLbs: number;
    basePaymentPaid: number;
    surplusPaymentPaid: number;
    shortfallAbsorbed: number;
    advanceReconciled: number;
    externalPaymentUsd: number | null;
    notes: string;
    disputeRaised: boolean;
}

export interface FarmContract {
    id: string;
    createdAt: string;
    updatedAt: string;
    farmId: string;
    contractingCommunityId: string;
    needsProjectionId: string;
    contractType: ContractType;
    plantingWindow: PlantingWindow;
    cropPlan: CropPlanEntry[];
    paymentTerms: PaymentTerms;
    resourceCommitments: ResourceCommitment[];
    advancePaidAt: string | null;
    deliveries: DeliveryRecord[];
    inspections: InspectionRecord[];
    settlement: SettlementRecord | null;
    status: ContractStatus;
    approvalMotionId: string | null;
    notes: string;
}
