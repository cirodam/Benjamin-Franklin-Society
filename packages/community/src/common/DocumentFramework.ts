// ── Document Framework ────────────────────────────────────────────────────────
//
// Reusable types for governing documents (constitution, bylaws, charters, etc.)
// Articles contain sections whose body prose may embed {paramKey} slots that
// render as live parameter values in the UI.

// ── Authority ─────────────────────────────────────────────────────────────────

export interface Authority {
    id:          string;
    label:       string;
    description: string;
}

/**
 * Built-in authorities. Domain councils ("council:<domainId>") are added at
 * runtime when domains are created — derived from domain records, not stored
 * as a separate table.
 */
export const BUILT_IN_AUTHORITIES: Record<string, Authority> = {
    community: {
        id:          "community",
        label:       "Whole Community",
        description: "Full membership via referendum. Documents owned here require a referendum to amend.",
    },
    assembly: {
        id:          "assembly",
        label:       "Assembly",
        description: "The randomly drawn assembly. Documents owned here can be amended by assembly vote.",
    },
};

export interface DocumentSection {
    /** Hierarchical id, e.g. "I.1", "IV.2" */
    id:             string;
    title?:         string;
    /** Prose text. May contain {paramKey} slots for live parameter embedding. */
    body:           string;
    /** Keys extracted from {paramKey} slots in body. Stored for quick lookup. */
    paramKeys:      string[];
    /** ISO 8601 date when this section came into force. */
    adoptedAt?:     string;
    /**
     * ISO 8601 date after which this section automatically lapses.
     * null / undefined = no sunset; section is permanent until repealed.
     * A sunset is a deliberate drafting choice, not a default.
     */
    sunsetAt?:      string | null;
    /**
     * Authors' explanation of why this section exists and what it is trying
     * to accomplish. Displayed to members alongside the section text so the
     * intent is always visible, not buried in meeting minutes.
     */
    rationale?:     string;
    /**
     * Vote rule required to amend or repeal this specific section.
     * Overrides the document-level voteRuleId.
     * null / undefined = fall back to the document's voteRuleId.
     */
    voteRuleId?:    string | null;
}

export interface DocumentArticle {
    /** Roman numeral string, e.g. "I", "II", "VII" */
    number:    string;
    title:     string;
    preamble?: string;
    sections:  DocumentSection[];
}

export interface GoverningDocument {
    id:          string;
    /** "constitution" | "bylaw" | "charter" */
    type:        string;
    title:       string;
    preamble?:   string;
    articles:    DocumentArticle[];
    adoptedAt:   string;
    version:     number;
    /** Authority id that controls amendment of this document (e.g. "community", "assembly", "council:market"). */
    authorityId: string;
    /**
     * Default vote rule for amending/repealing sections of this document.
     * Individual sections may override this with their own voteRuleId.
     * Must be a key from the VOTE_RULES registry in @ecf/core.
     */
    voteRuleId:  string;
    /**
     * Which domain/pool this document applies within.
     * null = community-wide (universal).
     * A pool/domain id = this bylaw applies only within that body.
     */
    domainId?:   string | null;
    /**
     * ISO 8601 datetime after which this bylaw is considered expired.
     * null / undefined = no expiry (bylaw is permanent until repealed).
     * Expired bylaws are NOT auto-deleted; the community must consciously
     * re-adopt or renew them via a motion.
     */
    expiresAt?:  string | null;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Extract all {paramKey} tokens from prose, returning a deduped array of keys.
 */
export function extractParamKeys(body: string): string[] {
    const seen = new Set<string>();
    const re = /\{([^}]+)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) {
        seen.add(m[1]);
    }
    return [...seen];
}
