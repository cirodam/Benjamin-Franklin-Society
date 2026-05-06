// ── Types ─────────────────────────────────────────────────────────────────────

export type AuthorityType = "builtin" | "pool";

export interface Authority {
    id:                string;
    name:              string;
    description?:      string;
    type:              AuthorityType;
    poolId?:           string;   // only set when type === "pool"
    defaultVoteRuleId: string;
}

// ── Built-in authority ids ────────────────────────────────────────────────────

export const AUTHORITY_ASSEMBLY   = "assembly"   as const;
export const AUTHORITY_MEMBERSHIP = "membership" as const;

export const BUILTIN_AUTHORITY_IDS = [AUTHORITY_ASSEMBLY, AUTHORITY_MEMBERSHIP] as const;
export type  BuiltinAuthorityId    = typeof BUILTIN_AUTHORITY_IDS[number];

// ── Seed data ─────────────────────────────────────────────────────────────────

export const BUILTIN_AUTHORITIES: Authority[] = [
    {
        id:                AUTHORITY_ASSEMBLY,
        name:              "Assembly",
        description:       "The seated assembly — members drawn by sortition for the current term.",
        type:              "builtin",
        defaultVoteRuleId: "simple-majority",
    },
    {
        id:                AUTHORITY_MEMBERSHIP,
        name:              "Full Membership",
        description:       "All active members — asynchronous online referendum.",
        type:              "builtin",
        defaultVoteRuleId: "absolute-majority",
    },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

export function poolAuthorityId(poolId: string): string {
    return `pool:${poolId}`;
}

export function isPoolAuthorityId(id: string): boolean {
    return id.startsWith("pool:");
}

export function poolIdFromAuthorityId(authorityId: string): string {
    return authorityId.slice("pool:".length);
}
