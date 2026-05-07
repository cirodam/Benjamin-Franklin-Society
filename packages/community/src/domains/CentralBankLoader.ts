import { CommunityDb } from "../CommunityDb.js";

export interface CentralBankRecord {
    ownerId: string;
    issuanceAccountId: string;
    registeredAt: string; // ISO 8601
    /** Cumulative kin that could not be retired at discharge time and must be
     *  recouped gradually via demurrage. */
    dischargeShortfall?: number;
}

const KEY = "central_bank";

/**
 * Persists the central bank's owner ID and issuance account ID.
 * Written once on first boot, read on every subsequent boot.
 */
export class CentralBankLoader {
    private get db() { return CommunityDb.getInstance().db; }

    exists(): boolean {
        return !!this.db.prepare("SELECT 1 FROM singleton_records WHERE key = ?").get(KEY);
    }

    save(record: CentralBankRecord): void {
        this.db.prepare(
            "INSERT INTO singleton_records (key, data) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data"
        ).run(KEY, JSON.stringify(record));
    }

    load(): CentralBankRecord {
        const row = this.db.prepare("SELECT data FROM singleton_records WHERE key = ?").get(KEY) as { data: string } | undefined;
        if (!row) throw new Error("[CentralBank] not found — call init() first");
        return JSON.parse(row.data) as CentralBankRecord;
    }
}

