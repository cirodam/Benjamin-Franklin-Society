import type { Request, Response } from "express";
import type { AuthedRequest } from "@ecf/core";
import { ContractService } from "../ContractService.js";
import { FarmAssociationService } from "../FarmAssociationService.js";
import { CommunityClient } from "../CommunityClient.js";
import type {
    CropPlanEntry, PaymentTerms, ResourceCommitment,
    DeliveryRecord, InspectionRecord, SettlementRecord,
    ContractStatus, PlantingWindow,
} from "../types.js";

const svc     = () => ContractService.getInstance();
const farmSvc = () => FarmAssociationService.getInstance();

export function listContracts(req: Request, res: Response): void {
    const { status, farmId, projectionId, window } = req.query as Record<string, string | undefined>;
    let contracts = svc().getAll();
    if (status)       contracts = contracts.filter(c => c.status === status);
    if (farmId)       contracts = contracts.filter(c => c.farmId === farmId);
    if (projectionId) contracts = contracts.filter(c => c.needsProjectionId === projectionId);
    if (window)       contracts = contracts.filter(c => c.plantingWindow === window);
    res.json(contracts);
}

export function getContract(req: Request, res: Response): void {
    const c = svc().get(req.params.id as string);
    if (!c) { res.status(404).json({ error: "Contract not found" }); return; }
    res.json(c);
}

export function submitContract(req: Request, res: Response): void {
    const caller = req as AuthedRequest;
    const {
        farmId, needsProjectionId, contractType, plantingWindow,
        cropPlan, paymentTerms, resourceCommitments, notes,
    } = req.body as {
        farmId: string; needsProjectionId: string;
        contractType: "annual" | "perennial"; plantingWindow: PlantingWindow;
        cropPlan: CropPlanEntry[]; paymentTerms: PaymentTerms;
        resourceCommitments: ResourceCommitment[]; notes: string;
    };

    const farm = farmSvc().get(farmId);
    if (!farm) { res.status(400).json({ error: "Farm not found" }); return; }
    if (farm.status !== "eligible") {
        res.status(400).json({ error: "Farm is not eligible to submit contracts" }); return;
    }
    if (!farm.operatorIds.includes(caller.personId)) {
        res.status(403).json({ error: "Only a farm operator may submit a contract" }); return;
    }

    try {
        const contract = svc().submit({
            farmId,
            contractingCommunityId: caller.credential.communityNodeId ?? "",
            needsProjectionId,
            contractType,
            plantingWindow,
            cropPlan,
            paymentTerms,
            resourceCommitments,
            notes,
        });
        farmSvc().linkContract(farmId, contract.id);

        // Fire-and-forget: create a motion in Farmers pool for review
        const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "").trim();
        if (token) {
            CommunityClient.getInstance().getFarmersPoolId().then(poolId => {
                const cropList = contract.cropPlan
                    .map(e => `- ${e.crop}: ${e.estimatedYieldLbs.toLocaleString()} lbs est. (${e.acreage} ac)`)
                    .join("\n");
                const totalKin = contract.paymentTerms.basePaymentKin;
                return CommunityClient.getInstance().createMotion(token, {
                    title:       `Review contract offer: ${farm.name} — ${contract.plantingWindow}`,
                    description: `Farm: ${farm.name}\nWindow: ${contract.plantingWindow}\n\nCrop plan:\n${cropList}\n\nBase payment: ${totalKin} kin\nAdvance: ${contract.paymentTerms.advancePaymentKin} kin`,
                    body:        "grange",
                    parentId:    poolId,
                });
            }).then(motionId => {
                if (motionId) console.info(`[grange] created review motion ${motionId} for contract ${contract.id}`);
            }).catch(err => console.error("[grange] contract motion creation failed:", err));
        }

        res.status(201).json(contract);
    } catch (err: unknown) {
        res.status(400).json({ error: (err as Error).message });
    }
}

export function updateContractStatus(req: Request, res: Response): void {
    const { status, approvalMotionId } = req.body as {
        status: ContractStatus; approvalMotionId?: string;
    };
    try {
        const contract = svc().setStatus(req.params.id as string, status, approvalMotionId);
        res.json(contract);
    } catch (err: unknown) {
        res.status(400).json({ error: (err as Error).message });
    }
}

export function recordDelivery(req: Request, res: Response): void {
    const caller = req as AuthedRequest;
    const { cropPlanEntryId, actualYieldLbs, moisturePct, notes, reserveAllocatedLbs, marketAllocatedLbs } = req.body as {
        cropPlanEntryId: string; actualYieldLbs: number; moisturePct?: number | null;
        notes: string; reserveAllocatedLbs: number; marketAllocatedLbs: number;
    };
    try {
        const contract = svc().addDelivery(req.params.id as string, {
            cropPlanEntryId,
            actualYieldLbs,
            moisturePct: moisturePct ?? null,
            receivedBy:  caller.credential.handle,
            notes,
            reserveAllocatedLbs,
            marketAllocatedLbs,
        });
        res.status(201).json(contract);
    } catch (err: unknown) {
        res.status(400).json({ error: (err as Error).message });
    }
}

export function recordInspection(req: Request, res: Response): void {
    const caller = req as AuthedRequest;
    const { findings, practiceViolations, outcome, followUpRequired, followUpDate } = req.body as {
        findings: string; practiceViolations: string[];
        outcome: InspectionRecord["outcome"];
        followUpRequired: boolean; followUpDate?: string | null;
    };
    try {
        const contract = svc().addInspection(req.params.id as string, {
            inspectorId:       caller.personId,
            findings,
            practiceViolations,
            outcome,
            followUpRequired,
            followUpDate:      followUpDate ?? null,
        });
        res.status(201).json(contract);
    } catch (err: unknown) {
        res.status(400).json({ error: (err as Error).message });
    }
}

export function settleContract(req: Request, res: Response): void {
    const settlement = req.body as SettlementRecord;
    try {
        const contract = svc().settle(req.params.id as string, settlement);
        res.json(contract);
    } catch (err: unknown) {
        res.status(400).json({ error: (err as Error).message });
    }
}
