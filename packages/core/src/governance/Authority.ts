// ── Base class ────────────────────────────────────────────────────────────────

/**
 * Base class for all governing authorities.
 * Concrete subclasses: Assembly, Committee, LeaderPool.
 * Can also be instantiated directly for simple static authorities.
 */
export class Authority {
    readonly kind: string;

    constructor(
        readonly id:                string,
        readonly name:              string,
        readonly defaultVoteRuleId: string,
        readonly description?:      string,
        kind                        = "authority",
    ) {
        this.kind = kind;
    }
}

// ── Built-in authority ids ────────────────────────────────────────────────────

export const AUTHORITY_ASSEMBLY   = "assembly"   as const;
export const AUTHORITY_MEMBERSHIP = "membership" as const;
export const AUTHORITY_REFERENDUM = "referendum" as const;

export const BUILTIN_AUTHORITY_IDS = [AUTHORITY_ASSEMBLY, AUTHORITY_MEMBERSHIP, AUTHORITY_REFERENDUM] as const;
export type  BuiltinAuthorityId    = typeof BUILTIN_AUTHORITY_IDS[number];

// ── Virtual authorities (not stored in DB) ────────────────────────────────────

/**
 * Placeholder for the full-membership authority.
 * Not persisted — synthesised at runtime so the UI can list it.
 * Member resolution is handled in AuthorityService.getMemberIds().
 */
export const MEMBERSHIP_AUTHORITY = new Authority(
    AUTHORITY_MEMBERSHIP,
    "Full Membership",
    "absolute-majority",
    "All active members — asynchronous online referendum.",
    "membership",
);

/**
 * Placeholder for the referendum authority.
 * Same population as membership but distinct identity — used for constitutional
 * amendments and other decisions that require a direct vote of all members.
 * Not persisted — synthesised at runtime.
 */
export const REFERENDUM_AUTHORITY = new Authority(
    AUTHORITY_REFERENDUM,
    "Referendum",
    "absolute-supermajority",
    "A direct vote of all active members, used for constitutional decisions.",
    "referendum",
);
