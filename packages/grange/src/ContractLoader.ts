import { GrangeDb } from "./GrangeDb.js";
import type { FarmContract } from "./types.js";

export class ContractLoader {
    findAll(): FarmContract[] {
        const rows = GrangeDb.getInstance().db
            .prepare("SELECT data FROM contracts ORDER BY rowid")
            .all() as { data: string }[];
        return rows.map(r => JSON.parse(r.data) as FarmContract);
    }

    findById(id: string): FarmContract | null {
        const row = GrangeDb.getInstance().db
            .prepare("SELECT data FROM contracts WHERE id = ?")
            .get(id) as { data: string } | undefined;
        return row ? JSON.parse(row.data) as FarmContract : null;
    }

    findByFarm(farmId: string): FarmContract[] {
        return this.findAll().filter(c => c.farmId === farmId);
    }

    findByProjection(needsProjectionId: string): FarmContract[] {
        return this.findAll().filter(c => c.needsProjectionId === needsProjectionId);
    }

    save(contract: FarmContract): void {
        GrangeDb.getInstance().db
            .prepare("INSERT OR REPLACE INTO contracts (id, data) VALUES (?, ?)")
            .run(contract.id, JSON.stringify(contract));
    }
}
