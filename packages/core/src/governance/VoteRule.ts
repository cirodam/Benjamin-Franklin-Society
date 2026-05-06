// ── Types ─────────────────────────────────────────────────────────────────────

/** How the approval threshold is measured. */
export type VoteLegitimacy =
    | "absolute-majority"   // N% of ALL eligible voters must affirmatively approve
    | "majority-of-votes"   // N% of votes CAST must approve
    | "petition";           // fixed minApprovals count; no reject side

export interface VoteRule {
    id:                string;
    label:             string;
    legitimacy:        VoteLegitimacy;
    /**
     * Fraction of eligible voters required to pass.
     * - absolute-majority: fraction of ALL eligible voters
     * - majority-of-votes: fraction of votes CAST
     * - petition: not used (use minApprovals on the motion instead)
     */
    thresholdFraction?: number;
    /** Minimum days of deliberation before voting may open. 0 = no deliberation period. */
    deliberationDays:   number;
    /**
     * How long the voting window stays open in days.
     * 0 = no time-based deadline (petition closes when threshold is hit).
     */
    votingWindowDays:   number;
}

// ── Built-in rules ────────────────────────────────────────────────────────────

export const VOTE_RULES: Record<string, VoteRule> = {
    /**
     * Absolute Supermajority — highest bar.
     * Requires 2/3 of ALL eligible voters to approve. 7-day deliberation, 14-day voting window.
     * Use for: constitutional amendments, founding/dissolving institutions.
     */
    "absolute-supermajority": {
        id:                "absolute-supermajority",
        label:             "Absolute Supermajority",
        legitimacy:        "absolute-majority",
        thresholdFraction: 0.67,
        deliberationDays:  7,
        votingWindowDays:  14,
    },

    /**
     * Absolute Majority — standard referendum.
     * Requires a majority of ALL eligible voters to approve. 3-day deliberation, 7-day window.
     * Use for: monetary parameters, major policy, anything requiring full legitimacy.
     */
    "absolute-majority": {
        id:                "absolute-majority",
        label:             "Absolute Majority",
        legitimacy:        "absolute-majority",
        thresholdFraction: 0.51,
        deliberationDays:  3,
        votingWindowDays:  7,
    },

    /**
     * Simple Majority — majority of votes cast. No deliberation period; 2-day window.
     * Use for: most assembly and pool decisions.
     */
    "simple-majority": {
        id:                "simple-majority",
        label:             "Simple Majority",
        legitimacy:        "majority-of-votes",
        thresholdFraction: 0.51,
        deliberationDays:  0,
        votingWindowDays:  2,
    },

    /**
     * Supermajority — 2/3 of votes cast. No deliberation; 2-day window.
     * Use for: significant policy changes, referring matters to referendum.
     */
    "supermajority": {
        id:                "supermajority",
        label:             "Supermajority",
        legitimacy:        "majority-of-votes",
        thresholdFraction: 0.67,
        deliberationDays:  0,
        votingWindowDays:  2,
    },

    /**
     * Petition — accumulate approvals to a fixed count.
     * No reject side. No time-based deadline; resolves the moment the count is reached.
     * minApprovals is set at submission time, not here.
     * Use for: member admission, triggering a referendum, formal requests.
     */
    "petition": {
        id:               "petition",
        label:            "Petition",
        legitimacy:       "petition",
        deliberationDays: 0,
        votingWindowDays: 0,
    },
};

export type VoteRuleId = keyof typeof VOTE_RULES;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return a rule by ID. Throws if unknown. */
export function getVoteRule(id: string): VoteRule {
    const rule = VOTE_RULES[id];
    if (!rule) throw new Error(`Unknown vote rule: "${id}". Valid IDs: ${Object.keys(VOTE_RULES).join(", ")}`);
    return rule;
}

/** Return all built-in vote rules. */
export function listVoteRules(): VoteRule[] {
    return Object.values(VOTE_RULES);
}
