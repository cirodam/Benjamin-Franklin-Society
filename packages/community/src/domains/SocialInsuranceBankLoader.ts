import { CommunityDb } from "../CommunityDb.js";

export interface SocialInsuranceBankRecord {
    ownerId: string;
    poolAccountId: string;
    registeredAt: string; // ISO 8601
}

const KEY = "social_insurance_bank";

export class SocialInsuranceBankLoader {
    private get db() { return CommunityDb.getInstance().db; }

    exists(): boolean {
        return !!this.db.prepare("SELECT 1 FROM singleton_records WHERE key = ?").get(KEY);
    }

    save(record: SocialInsuranceBankRecord): void {
        this.db.prepare(
            "INSERT INTO singleton_records (key, data) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data"
        ).run(KEY, JSON.stringify(record));
    }

    load(): SocialInsuranceBankRecord {
        const row = this.db.prepare("SELECT data FROM singleton_records WHERE key = ?").get(KEY) as { data: string } | undefined;
        if (!row) throw new Error("[SocialInsuranceBank] not found — call init() first");
        return JSON.parse(row.data) as SocialInsuranceBankRecord;
    }
}

