import { CommunityDb } from "../../CommunityDb.js";
import { FunctionalDomain, type BudgetItem } from "@ecf/core";

interface DomainStateRecord {
    id: string;
    unitIds: string[];
    budgetItems: BudgetItem[];
    poolId: string | null;
}

/**
 * Persists the mutable relationship state for each FunctionalDomain.
 * Domain identity (name, description, type) comes from code; only the
 * IDs of associated units, roles, and the governing pool are persisted here.
 */
export class FunctionalDomainLoader {
    private get db() { return CommunityDb.getInstance().db; }

    save(domain: FunctionalDomain): void {
        const data = JSON.stringify({
            id: domain.id, unitIds: domain.unitIds,
            budgetItems: domain.budgetItems, poolId: domain.poolId,
        });
        this.db.prepare(
            "INSERT INTO functional_domain_states (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data"
        ).run(domain.id, data);
    }

    /**
     * Restore persisted state onto an already-constructed domain instance.
     * Called during startup after all domain singletons have been created.
     */
    restore(domain: FunctionalDomain): void {
        const row = this.db.prepare("SELECT data FROM functional_domain_states WHERE id = ?").get(domain.id) as { data: string } | undefined;
        if (!row) return;
        const record = JSON.parse(row.data) as DomainStateRecord;
        domain.unitIds     = record.unitIds     ?? [];
        domain.budgetItems = record.budgetItems ?? [];
        domain.poolId      = record.poolId      ?? null;
    }

    delete(domainId: string): boolean {
        return this.db.prepare("DELETE FROM functional_domain_states WHERE id = ?").run(domainId).changes > 0;
    }
}

