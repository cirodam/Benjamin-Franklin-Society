import type {
    FarmContract, CropPlanEntry, PaymentTerms, ResourceCommitment,
    DeliveryRecord, InspectionRecord, SettlementRecord, ContractStatus,
    PlantingWindow,
} from "./types.js";
import { ContractLoader } from "./ContractLoader.js";
import { randomUUID } from "crypto";

export interface CoverageEntry {
    cropNeedEntryId: string;
    crop:            string;
    committedLbs:    number;
    maxContractLbs:  number;
    minDesiredLbs:   number;
    coveragePct:     number;
    status:          "uncovered" | "minimum-met" | "full";
}

export class ContractService {
    private static instance: ContractService;
    private contracts: Map<string, FarmContract> = new Map();
    private loader!: ContractLoader;

    private constructor() {}

    static getInstance(): ContractService {
        if (!ContractService.instance) ContractService.instance = new ContractService();
        return ContractService.instance;
    }

    init(loader: ContractLoader): void {
        this.loader = loader;
        for (const c of loader.findAll()) this.contracts.set(c.id, c);
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    get(id: string): FarmContract | undefined {
        return this.contracts.get(id);
    }

    getAll(): FarmContract[] {
        return Array.from(this.contracts.values())
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    getByFarm(farmId: string): FarmContract[] {
        return this.getAll().filter(c => c.farmId === farmId);
    }

    getByProjection(needsProjectionId: string): FarmContract[] {
        return this.getAll().filter(c => c.needsProjectionId === needsProjectionId);
    }

    getByStatus(status: ContractStatus): FarmContract[] {
        return this.getAll().filter(c => c.status === status);
    }

    getByWindow(window: PlantingWindow): FarmContract[] {
        return this.getAll().filter(c => c.plantingWindow === window);
    }

    /**
     * Compute offer coverage for each CropNeedEntry in a projection.
     * cropNeedMap: Record<cropNeedEntryId, { crop, maxContractLbs, minDesiredLbs }>
     */
    computeCoverage(
        needsProjectionId: string,
        cropNeedMap: Record<string, { crop: string; maxContractLbs: number; minDesiredLbs: number }>,
    ): CoverageEntry[] {
        const active = this.getByProjection(needsProjectionId)
            .filter(c => c.status !== "cancelled");

        return Object.entries(cropNeedMap).map(([id, need]) => {
            const committedLbs = active
                .flatMap(c => c.cropPlan)
                .filter(e => e.cropNeedEntryId === id)
                .reduce((sum, e) => sum + e.estimatedYieldLbs, 0);

            const coveragePct = need.maxContractLbs > 0
                ? Math.min(100, Math.round((committedLbs / need.maxContractLbs) * 100))
                : 0;

            const status: CoverageEntry["status"] =
                committedLbs >= need.maxContractLbs ? "full"
                : committedLbs >= need.minDesiredLbs ? "minimum-met"
                : "uncovered";

            return { cropNeedEntryId: id, crop: need.crop, committedLbs, maxContractLbs: need.maxContractLbs, minDesiredLbs: need.minDesiredLbs, coveragePct, status };
        });
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    submit(params: {
        farmId:               string;
        contractingCommunityId: string;
        needsProjectionId:    string;
        contractType:         FarmContract["contractType"];
        plantingWindow:       PlantingWindow;
        cropPlan:             CropPlanEntry[];
        paymentTerms:         PaymentTerms;
        resourceCommitments:  ResourceCommitment[];
        notes:                string;
    }): FarmContract {
        const now = new Date().toISOString();
        const contract: FarmContract = {
            id:                     randomUUID(),
            createdAt:              now,
            updatedAt:              now,
            farmId:                 params.farmId,
            contractingCommunityId: params.contractingCommunityId,
            needsProjectionId:      params.needsProjectionId,
            contractType:           params.contractType,
            plantingWindow:         params.plantingWindow,
            cropPlan:               params.cropPlan,
            paymentTerms:           params.paymentTerms,
            resourceCommitments:    params.resourceCommitments,
            advancePaidAt:          null,
            deliveries:             [],
            inspections:            [],
            settlement:             null,
            status:                 "proposed",
            approvalMotionId:       null,
            notes:                  params.notes,
        };
        this.contracts.set(contract.id, contract);
        this.loader.save(contract);
        return contract;
    }

    setStatus(id: string, status: ContractStatus, approvalMotionId?: string): FarmContract {
        const contract = this.contracts.get(id);
        if (!contract) throw new Error(`Contract not found: ${id}`);
        contract.status = status;
        contract.updatedAt = new Date().toISOString();
        if (approvalMotionId) contract.approvalMotionId = approvalMotionId;
        if (status === "active" && !contract.advancePaidAt) {
            contract.advancePaidAt = new Date().toISOString();
        }
        this.loader.save(contract);
        return contract;
    }

    addDelivery(contractId: string, delivery: Omit<DeliveryRecord, "id" | "recordedAt">): FarmContract {
        const contract = this.contracts.get(contractId);
        if (!contract) throw new Error(`Contract not found: ${contractId}`);
        if (contract.status !== "active") throw new Error("Deliveries can only be recorded against active contracts");
        const record: DeliveryRecord = {
            id:         randomUUID(),
            recordedAt: new Date().toISOString(),
            ...delivery,
        };
        contract.deliveries.push(record);
        contract.updatedAt = new Date().toISOString();
        this.loader.save(contract);
        return contract;
    }

    addInspection(contractId: string, inspection: Omit<InspectionRecord, "id" | "conductedAt">): FarmContract {
        const contract = this.contracts.get(contractId);
        if (!contract) throw new Error(`Contract not found: ${contractId}`);
        const record: InspectionRecord = {
            id:          randomUUID(),
            conductedAt: new Date().toISOString(),
            ...inspection,
        };
        contract.inspections.push(record);
        contract.updatedAt = new Date().toISOString();
        this.loader.save(contract);
        return contract;
    }

    settle(contractId: string, settlement: SettlementRecord): FarmContract {
        const contract = this.contracts.get(contractId);
        if (!contract) throw new Error(`Contract not found: ${contractId}`);
        if (contract.status !== "active") throw new Error("Can only settle an active contract");
        contract.settlement = settlement;
        contract.status = settlement.disputeRaised ? "disputed" : "fulfilled";
        contract.updatedAt = new Date().toISOString();
        this.loader.save(contract);
        return contract;
    }
}
