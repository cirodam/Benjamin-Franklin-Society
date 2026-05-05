import { GrangeDb } from "./GrangeDb.js";
import type { NeedsProjection } from "./types.js";

export class NeedsProjectionLoader {
    findAll(): NeedsProjection[] {
        const rows = GrangeDb.getInstance().db
            .prepare("SELECT data FROM needs_projections ORDER BY rowid")
            .all() as { data: string }[];
        return rows.map(r => JSON.parse(r.data) as NeedsProjection);
    }

    findById(id: string): NeedsProjection | null {
        const row = GrangeDb.getInstance().db
            .prepare("SELECT data FROM needs_projections WHERE id = ?")
            .get(id) as { data: string } | undefined;
        return row ? JSON.parse(row.data) as NeedsProjection : null;
    }

    save(projection: NeedsProjection): void {
        GrangeDb.getInstance().db
            .prepare("INSERT OR REPLACE INTO needs_projections (id, data) VALUES (?, ?)")
            .run(projection.id, JSON.stringify(projection));
    }
}
