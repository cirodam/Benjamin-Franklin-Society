import type { FarmAssociation, FarmStatus, PracticeDeclaration } from "./types.js";
import { FarmAssociationLoader } from "./FarmAssociationLoader.js";
import { randomUUID } from "crypto";

export class FarmAssociationService {
    private static instance: FarmAssociationService;
    private farms: Map<string, FarmAssociation> = new Map();
    private loader!: FarmAssociationLoader;

    private constructor() {}

    static getInstance(): FarmAssociationService {
        if (!FarmAssociationService.instance) FarmAssociationService.instance = new FarmAssociationService();
        return FarmAssociationService.instance;
    }

    init(loader: FarmAssociationLoader): void {
        this.loader = loader;
        for (const f of loader.findAll()) this.farms.set(f.id, f);
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    get(id: string): FarmAssociation | undefined {
        return this.farms.get(id);
    }

    getAll(): FarmAssociation[] {
        return Array.from(this.farms.values()).sort((a, b) => a.name.localeCompare(b.name));
    }

    getByStatus(status: FarmStatus): FarmAssociation[] {
        return this.getAll().filter(f => f.status === status);
    }

    getByOperator(personId: string): FarmAssociation[] {
        return this.getAll().filter(f => f.operatorIds.includes(personId));
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    register(params: {
        name:             string;
        homeCommunityId:  string;
        operatorIds:      string[];
        location:         string;
        acreage:          number;
        practices:        PracticeDeclaration;
    }): FarmAssociation {
        const now = new Date().toISOString();
        const farm: FarmAssociation = {
            id:                  randomUUID(),
            createdAt:           now,
            updatedAt:           now,
            name:                params.name,
            homeCommunityId:     params.homeCommunityId,
            operatorIds:         params.operatorIds,
            location:            params.location,
            acreage:             params.acreage,
            practices:           params.practices,
            status:              "pending",
            eligibilityMotionId: null,
            contracts:           [],
        };
        this.farms.set(farm.id, farm);
        this.loader.save(farm);
        return farm;
    }

    setStatus(id: string, status: FarmStatus, eligibilityMotionId?: string): FarmAssociation {
        const farm = this.farms.get(id);
        if (!farm) throw new Error(`Farm not found: ${id}`);
        farm.status = status;
        farm.updatedAt = new Date().toISOString();
        if (eligibilityMotionId) farm.eligibilityMotionId = eligibilityMotionId;
        this.loader.save(farm);
        return farm;
    }

    updatePractices(id: string, practices: PracticeDeclaration): FarmAssociation {
        const farm = this.farms.get(id);
        if (!farm) throw new Error(`Farm not found: ${id}`);
        farm.practices = practices;
        farm.updatedAt = new Date().toISOString();
        this.loader.save(farm);
        return farm;
    }

    linkContract(farmId: string, contractId: string): void {
        const farm = this.farms.get(farmId);
        if (!farm) throw new Error(`Farm not found: ${farmId}`);
        if (!farm.contracts.includes(contractId)) {
            farm.contracts.push(contractId);
            farm.updatedAt = new Date().toISOString();
            this.loader.save(farm);
        }
    }
}
