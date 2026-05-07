import { CommunityDb } from "../CommunityDb.js";

export interface CommunityTreasuryRecord {
    ownerId: string;
    accountId: string;
    registeredAt: string; // ISO 8601
}

const KEY = "community_treasury";

export class CommunityTreasuryLoader {
    private get db() { return CommunityDb.getInstance().db; }

    exists(): boolean {
        return !!this.db.prepare("SELECT 1 FROM singleton_records WHERE key = ?").get(KEY);
    }

    save(record: CommunityTreasuryRecord): void {
        this.db.prepare(
            "INSERT INTO singleton_records (key, data) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data"
        ).run(KEY, JSON.stringify(record));
    }

    load(): CommunityTreasuryRecord {
        const row = this.db.prepare("SELECT data FROM singleton_records WHERE key = ?").get(KEY) as { data: string } | undefined;
        if (!row) throw new Error("[CommunityTreasury] not found — call init() first");
        return JSON.parse(row.data) as CommunityTreasuryRecord;
    }
}

