import { Authority } from "./Authority.js";

/**
 * A permanent sortition-drawn governing body, term-rotating, potentially hundreds
 * of members.
 *
 * `memberIds` holds whoever is currently seated. When a new term is drawn the
 * service updates `memberIds`, `termStartedAt`, and `termEndsAt` and saves the
 * authority record. Historical terms are tracked via AssemblyTerm records.
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
