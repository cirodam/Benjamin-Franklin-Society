import { randomUUID } from "crypto";
import { IEconomicActor } from "../types/IEconomicActor.js";


/**
 * A FunctionalUnit is the operational body that does actual work within a domain.
 * Where a FunctionalDomain represents the community's mandate for a function,
 * a FunctionalUnit executes it — a mill, a clinic, a bakery, a grain store.
 *
 * Roles and persons are referenced by ID. The service layer resolves IDs to objects
 * and owns payroll logic.
 */
export class FunctionalUnit implements IEconomicActor {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly createdAt: Date;
    private readonly _type: string;

    roleIds: string[] = [];
    personIds: string[] = [];
    locationId: string | null = null;

    constructor(name: string, description: string = "", type: string = "unit", id?: string) {
        this.id = id ?? randomUUID();
        this.name = name;
        this.description = description;
        this._type = type;
        this.createdAt = new Date();
    }

    getId(): string { return this.id; }
    getDisplayName(): string { return this.name; }
    getHandle(): string { return this.name.toLowerCase().replace(/[^a-z0-9_]/g, "_"); }

    /** Stable type tag — used to filter units within a domain (e.g. "clinic", "dental-clinic"). */
    getType(): string { return this._type; }

    /** Apply name/description overrides after construction (e.g. from API request body). */
    applyOverrides(name?: string, description?: string): void {
        const self = this as unknown as Record<string, unknown>;
        if (name !== undefined)        self["name"]        = name;
        if (description !== undefined) self["description"] = description;
    }
}
