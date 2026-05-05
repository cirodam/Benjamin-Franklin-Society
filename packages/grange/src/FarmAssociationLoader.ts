import { GrangeDb } from "./GrangeDb.js";
import type { FarmAssociation } from "./types.js";

export class FarmAssociationLoader {
    findAll(): FarmAssociation[] {
        const rows = GrangeDb.getInstance().db
            .prepare("SELECT data FROM farm_associations ORDER BY rowid")
            .all() as { data: string }[];
        return rows.map(r => JSON.parse(r.data) as FarmAssociation);
    }

    findById(id: string): FarmAssociation | null {
        const row = GrangeDb.getInstance().db
            .prepare("SELECT data FROM farm_associations WHERE id = ?")
            .get(id) as { data: string } | undefined;
        return row ? JSON.parse(row.data) as FarmAssociation : null;
    }

    save(farm: FarmAssociation): void {
        GrangeDb.getInstance().db
            .prepare("INSERT OR REPLACE INTO farm_associations (id, data) VALUES (?, ?)")
            .run(farm.id, JSON.stringify(farm));
    }
}
