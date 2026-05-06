import { CommunityDb } from "../CommunityDb.js";
import { type Authority, BUILTIN_AUTHORITIES } from "@ecf/core";

export class AuthorityLoader {
    private static instance: AuthorityLoader;

    static getInstance(): AuthorityLoader {
        if (!AuthorityLoader.instance) AuthorityLoader.instance = new AuthorityLoader();
        return AuthorityLoader.instance;
    }

    private get db() { return CommunityDb.getInstance().db; }

    save(authority: Authority): void {
        this.db.prepare(
            "INSERT INTO authorities (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data"
        ).run(authority.id, JSON.stringify(authority));
    }

    load(id: string): Authority | undefined {
        const row = this.db.prepare("SELECT data FROM authorities WHERE id = ?").get(id) as { data: string } | undefined;
        return row ? JSON.parse(row.data) as Authority : undefined;
    }

    loadAll(): Authority[] {
        return (this.db.prepare("SELECT data FROM authorities").all() as { data: string }[])
            .map(({ data }) => JSON.parse(data) as Authority);
    }

    delete(id: string): boolean {
        return this.db.prepare("DELETE FROM authorities WHERE id = ?").run(id).changes > 0;
    }

    /** Seed built-in authorities if they don't already exist. */
    seedBuiltins(): void {
        for (const authority of BUILTIN_AUTHORITIES) {
            if (!this.load(authority.id)) {
                this.save(authority);
            }
        }
    }
}
