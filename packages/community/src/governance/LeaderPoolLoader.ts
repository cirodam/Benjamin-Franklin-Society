import { CommunityDb } from "../CommunityDb.js";
import { LeaderPool } from "@ecf/core";

interface PoolRecord {
    id: string; name: string; description: string;
    mandate: string; personIds: string[]; createdAt: string;
    defaultVoteRuleId?: string;
}

export class LeaderPoolLoader {
    private get db() { return CommunityDb.getInstance().db; }

    save(pool: LeaderPool): void {
        const data = JSON.stringify({
            id: pool.id, name: pool.name, description: pool.description,
            mandate: pool.mandate, personIds: pool.personIds, createdAt: pool.createdAt.toISOString(),
            defaultVoteRuleId: pool.defaultVoteRuleId,
        });
        this.db.prepare(
            "INSERT INTO leader_pools (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data"
        ).run(pool.id, data);
    }

    loadAll(): LeaderPool[] {
        return (this.db.prepare("SELECT data FROM leader_pools").all() as { data: string }[])
            .map(({ data }) => {
                const r = JSON.parse(data) as PoolRecord;
                const pool = new LeaderPool(r.id, r.name, r.defaultVoteRuleId ?? "simple-majority", r.description);
                (pool as unknown as Record<string, unknown>)["createdAt"] = new Date(r.createdAt);
                pool.mandate   = r.mandate ?? "";
                pool.personIds = r.personIds ?? [];
                return pool;
            });
    }

    delete(id: string): boolean {
        return this.db.prepare("DELETE FROM leader_pools WHERE id = ?").run(id).changes > 0;
    }
}

