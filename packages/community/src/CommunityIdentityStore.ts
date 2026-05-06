import { CommunityDb } from "./CommunityDb.js";

const HANDLE_RE = /^[a-z0-9_-]{3,32}$/;
const KEY = "community_identity";

interface CommunityIdentity {
    name:   string;
    handle: string;
}

export class CommunityIdentityStore {
    private static instance: CommunityIdentityStore;
    static getInstance(): CommunityIdentityStore {
        if (!this.instance) this.instance = new CommunityIdentityStore();
        return this.instance;
    }

    private get db() { return CommunityDb.getInstance().db; }

    get(): CommunityIdentity | null {
        const row = this.db.prepare(`SELECT value FROM singleton_records WHERE key = ?`).get(KEY) as { value: string } | undefined;
        return row ? JSON.parse(row.value) as CommunityIdentity : null;
    }

    get name(): string { return this.get()?.name ?? ""; }
    get handle(): string { return this.get()?.handle ?? ""; }

    set(name: string, handle: string): void {
        const trimmed = handle.trim().toLowerCase();
        if (!HANDLE_RE.test(trimmed)) {
            throw new Error("Community handle must be 3–32 characters: lowercase letters, numbers, hyphens, underscores.");
        }
        const trimmedName = name.trim();
        if (!trimmedName) throw new Error("Community name cannot be empty.");
        const data = JSON.stringify({ name: trimmedName, handle: trimmed });
        this.db.prepare(`
            INSERT INTO singleton_records (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `).run(KEY, data);
    }
}
