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


