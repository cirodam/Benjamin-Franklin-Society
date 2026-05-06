// ── Document Framework ────────────────────────────────────────────────────────
//
// Reusable types for governing documents (constitution, bylaws, charters, etc.)
// Articles contain sections whose body prose may embed {paramKey} slots that
// render as live parameter values in the UI.
//
// Documents may optionally carry parameters: named, typed, constrained values
// that effects can amend and that software can read at runtime. Any document
// type can have parameters — the constitution uses this to drive monetary policy,
// governance thresholds, etc.

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

// ── Parameter system ──────────────────────────────────────────────────────────

/** A named, typed, constrained value embedded in a governing document. */
export interface DocumentParameter {
    value:        number | boolean;
    /** true = fundamental unit definition or guarantee; cannot be amended by any vote. */
    immutable:    boolean;
    description:  string;
    constraints?: { min?: number; max?: number };
}

/** An amendment record appended each time a parameter value is changed. */
export interface DocumentAmendment {
    version:    number;
    parameter:  string;
    oldValue:   number | boolean;
    newValue:   number | boolean;
    motionId:   string;
    amendedAt:  string;
}

/** Maps a governance action kind to the authority and vote rule required for it. */
export interface ActionAuthority {
    readonly action:      string;
    /** Authority id (e.g. "assembly", "referendum", "council:market"). */
    readonly body:        string;
    readonly description: string;
    /** Vote rule id from the VOTE_RULES registry in @ecf/core. */
    readonly voteRuleId:  string;
}

// ── Document ──────────────────────────────────────────────────────────────────

export interface GoverningDocument {
    id:          string;
    /** "constitution" | "bylaw" | "charter" | any future type */
    type:        string;
    title:       string;
    preamble?:   string;
    articles:    DocumentArticle[];
    adoptedAt:   string;
    version:     number;
    /** Authority id that controls amendment of this document. */
    authorityId: string;
    /**
     * Default vote rule for amending/repealing sections of this document.
     * Individual sections may override via their own voteRuleId.
     */
    voteRuleId:  string;
    /** Which domain/pool this document applies within. null = community-wide. */
    domainId?:   string | null;
    /** ISO 8601 datetime after which this document is considered expired. */
    expiresAt?:  string | null;
    /**
     * If true, this document cannot be modified via the normal document API.
     * Used for federation-controlled documents like the charter.
     */
    readonly?:   boolean;

    // ── Parameter system (optional) ───────────────────────────────────────────
    /** Named parameters whose values drive software behavior. */
    parameters?:   Record<string, DocumentParameter>;
    /** Log of all parameter amendments, newest last. */
    amendments?:   DocumentAmendment[];
    /**
     * Maps governance action kinds to the authority and vote rule required.
     * Present on the constitution; may be present on domain statutes.
     */
    authorityMap?: ActionAuthority[];
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
