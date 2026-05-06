import { Authority } from "./Authority.js";

/**
 * A sortition-drawn governing body whose seated membership rotates each term.
 *
 * The authority record itself is a permanent singleton. When a new term is drawn,
 * `memberIds`, `termStartedAt`, and `termEndsAt` are updated in place. Historical
 * terms are tracked separately via AssemblyTerm records.
 */
export class Assembly extends Authority {
    readonly kind = "assembly" as const;

    memberIds:     string[]      = [];
    termStartedAt: string | null = null;
    termEndsAt:    string | null = null;

    constructor(
        id:                string,
        name:              string,
        defaultVoteRuleId: string,
        description?:      string,
    ) {
        super(id, name, defaultVoteRuleId, description);
    }

    get isTermActive(): boolean {
        if (!this.termStartedAt) return false;
        if (this.termEndsAt && new Date() > new Date(this.termEndsAt)) return false;
        return true;
    }
}
