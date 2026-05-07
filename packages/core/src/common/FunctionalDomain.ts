import { randomUUID } from "crypto";
import type { IEconomicActor } from "../types/IEconomicActor.js";

export type BudgetCategory = "supplies" | "equipment" | "services" | "other";

export interface BudgetItem {
    id: string;
    label: string;
    /** Monthly amount in kin. If perMember is true, this is the per-person rate. */
    amount: number;
    category: BudgetCategory;
    note: string;
    /** When true, effective monthly cost scales with member count. */
    perMember?: boolean;
}

/**
 * A functional domain represents an institutional mandate at any layer
 * (community, federation, commonwealth, globe).
 */
export class FunctionalDomain implements IEconomicActor {
    readonly id:          string;
    readonly name:        string;
    readonly description: string;

    unitIds:     string[]    = [];
    budgetItems: BudgetItem[] = [];
    /** The leader pool that governs this domain (if any). */
    poolId: string | null = null;

    constructor(name: string, description: string, id?: string) {
        this.id          = id ?? randomUUID();
        this.name        = name;
        this.description = description;
    }

    getId():         string { return this.id; }
    getDisplayName(): string { return this.name; }
    getHandle():     string { return this.name.toLowerCase().replace(/[^a-z0-9_]/g, "_"); }
}
