import { CommunityDb } from "../CommunityDb.js";
import { Authority, Assembly, Committee } from "@ecf/core";

function deserialize(raw: string): Authority {
    const d = JSON.parse(raw) as Record<string, unknown>;
    switch (d["kind"]) {
        case "assembly": {
            const a = new Assembly(
                d["id"] as string, d["name"] as string,
                d["defaultVoteRuleId"] as string, d["description"] as string | undefined,
            );
            a.memberIds     = (d["memberIds"] as string[] | undefined) ?? [];
            a.termStartedAt = (d["termStartedAt"] as string | null | undefined) ?? null;
            a.termEndsAt    = (d["termEndsAt"]   as string | null | undefined) ?? null;
            return a;
        }
        case "committee": {
            const c = new Committee(
                d["id"] as string, d["name"] as string,
                d["defaultVoteRuleId"] as string, d["description"] as string | undefined,
            );
            c.memberIds = (d["memberIds"] as string[] | undefined) ?? [];
            c.mandate   = (d["mandate"]   as string   | undefined) ?? "";
            c.poolId    = (d["poolId"]    as string   | undefined);
            c.permanent = (d["permanent"] as boolean  | undefined) ?? false;
            return c;
        }
        default:
            return new Authority(
                d["id"] as string, d["name"] as string,
                d["defaultVoteRuleId"] as string, d["description"] as string | undefined,
                (d["kind"] as string | undefined) ?? "authority",
            );
    }
}

function serialize(authority: Authority): string {
    const base = {
        id:                authority.id,
        name:              authority.name,
        description:       authority.description,
        defaultVoteRuleId: authority.defaultVoteRuleId,
        kind:              authority.kind,
    };
    if (authority instanceof Assembly) {
        return JSON.stringify({ ...base, memberIds: authority.memberIds, termStartedAt: authority.termStartedAt, termEndsAt: authority.termEndsAt });
    }
    if (authority instanceof Committee) {
        return JSON.stringify({ ...base, memberIds: authority.memberIds, mandate: authority.mandate, poolId: authority.poolId, permanent: authority.permanent });
    }
    return JSON.stringify(base);
}

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
        ).run(authority.id, serialize(authority));
    }

    load(id: string): Authority | undefined {
        const row = this.db.prepare("SELECT data FROM authorities WHERE id = ?").get(id) as { data: string } | undefined;
        return row ? deserialize(row.data) : undefined;
    }

    loadAll(): Authority[] {
        return (this.db.prepare("SELECT data FROM authorities").all() as { data: string }[])
            .map(({ data }) => deserialize(data));
    }

    /** Returns all Committee authorities chartered by the given pool. */
    loadByPool(poolId: string): Committee[] {
        return this.loadAll()
            .filter((a): a is Committee => a instanceof Committee && a.poolId === poolId);
    }

    delete(id: string): boolean {
        if (id === "assembly" || id === "membership" || id === "community") {
            throw new Error(`Cannot delete built-in authority "${id}"`);
        }
        return this.db.prepare("DELETE FROM authorities WHERE id = ?").run(id).changes > 0;
    }

    /**
     * Previously seeded hardcoded built-in authorities.
     * Authorities are now created by DocumentReconciler from authority.define
     * directives in the constitution.  This method is kept as a no-op so that
     * call sites in server.ts don't need to change.
     */
    seedBuiltins(): void {
        // No-op — DocumentReconciler.reconcile() handles authority creation.
    }
}
