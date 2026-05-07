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

// ── Directives ────────────────────────────────────────────────────────────────
//
// Each section may carry one or more directives — machine-readable instructions
// that tell the software what the section does.  Directives are declarative and
// side-effect-free; the reconciler reads them to determine desired state.
//
// Vocabulary:
//   authority.define  <id> <kind> <defaultVoteRuleId> <description>
//   authority.grant   <id> <action> <voteRuleId>
//   parameter.define  <key> <value> <immutable> [min] [max] <description>
//   document.require  <type> [description]
//
//   domain.define     <id>
//     name = section title, description = section body
//
//   domain.unit       <domainId> <unitType>
//     name = section title, description = section body
//
//   pool.define       <id> <voteRuleId>
//     name = section title, description = section body, mandate = section rationale
//
//   pool.governs      <poolId> <domainId>
//
// Bylaws and ordinances may NOT carry authority.define or authority.grant
// directives — those are reserved for constitution and charter documents.

export type DirectiveVerb =
    | "authority.define"
    | "authority.grant"
    | "parameter.define"
    | "document.require"
    | "domain.define"
    | "domain.unit"
    | "pool.define"
    | "pool.governs";

export interface DocumentDirective {
    verb: DirectiveVerb;
    /** Positional arguments, parsed left-to-right per verb spec. */
    args: string[];
}

// ── Parsed directive shapes (used by the reconciler) ─────────────────────────

export interface AuthorityDefineDirective {
    id:                string;
    kind:              "assembly" | "committee" | "leader-pool" | "membership" | "referendum";
    defaultVoteRuleId: string;
    description:       string;
}

export interface AuthorityGrantDirective {
    authorityId: string;
    action:      string;
    voteRuleId:  string;
}

export interface ParameterDefineDirective {
    key:         string;
    value:       number | boolean;
    immutable:   boolean;
    min?:        number;
    max?:        number;
    description: string;
}

/**
 * Declares that a functional domain with the given stable ID should exist.
 * Name and description are read from the enclosing section (title + body).
 */
export interface DomainDefineDirective {
    id: string;
}

/**
 * Declares that a functional unit of the given type should exist in the domain.
 * Name and description are read from the enclosing section (title + body).
 */
export interface DomainUnitDirective {
    domainId: string;
    unitType: string;
}

/**
 * Declares that a leader pool with the given stable ID should exist.
 * Name from section title; description from section body; mandate from section rationale.
 */
export interface PoolDefineDirective {
    id:           string;
    voteRuleId:   string;
}

/**
 * Declares that the given pool governs the given domain.
 */
export interface PoolGovernsDirective {
    poolId:   string;
    domainId: string;
}

/**
 * Parse a raw DocumentDirective into a typed shape.
 * Returns null if the directive is malformed.
 */
export function parseDirective(
    d: DocumentDirective,
): AuthorityDefineDirective | AuthorityGrantDirective | ParameterDefineDirective
 | DomainDefineDirective | DomainUnitDirective | PoolDefineDirective | PoolGovernsDirective | null {
    const a = d.args;
    switch (d.verb) {
        case "authority.define":
            if (a.length < 4) return null;
            return { id: a[0], kind: a[1] as AuthorityDefineDirective["kind"], defaultVoteRuleId: a[2], description: a.slice(3).join(" ") };
        case "authority.grant":
            if (a.length < 3) return null;
            return { authorityId: a[0], action: a[1], voteRuleId: a[2] };
        case "parameter.define": {
            if (a.length < 4) return null;
            const rawValue = a[1];
            const value: number | boolean =
                rawValue === "true"  ? true  :
                rawValue === "false" ? false :
                parseFloat(rawValue);
            const immutable = a[2] === "true";
            let idx = 3;
            let min: number | undefined;
            let max: number | undefined;
            if (idx < a.length && !isNaN(Number(a[idx]))) { min = Number(a[idx++]); }
            if (idx < a.length && !isNaN(Number(a[idx]))) { max = Number(a[idx++]); }
            const description = a.slice(idx).join(" ");
            return { key: a[0], value, immutable, min, max, description };
        }
        case "domain.define":
            if (a.length < 1) return null;
            return { id: a[0] };
        case "domain.unit":
            if (a.length < 2) return null;
            return { domainId: a[0], unitType: a[1] };
        case "pool.define":
            if (a.length < 2) return null;
            return { id: a[0], voteRuleId: a[1] };
        case "pool.governs":
            if (a.length < 2) return null;
            return { poolId: a[0], domainId: a[1] };
        case "document.require":
            return null; // not yet consumed by reconciler
    }
}

export interface DocumentSection {
    /** Hierarchical id, e.g. "I.1", "IV.2" */
    id:             string;
    title?:         string;
    /** Prose text. May contain {paramKey} slots for live parameter embedding. */
    body:           string;
    /** ISO 8601 date when this section came into force. */
    adoptedAt?:     string;
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
    /**
     * Machine-readable instructions that declare what this section does.
     * Read by the reconciler to determine desired governance state.
     * Only valid in constitution and charter documents.
     */
    directives?:    DocumentDirective[];
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

// ── Document ──────────────────────────────────────────────────────────────────

export interface GoverningDocument {
    id:          string;
    /** "constitution" | "bylaw" | "charter" | "ordinance" */
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
    /** Which domain this document applies within. null = community-wide. */
    domainId?:   string | null;
    /**
     * ISO 8601 datetime after which this document is considered expired.
     * Only meaningful on ordinance documents — the reconciler ignores expired
     * documents entirely when building desired state.
     */
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

/**
 * Collect all directives from all sections across a document, in article/section order.
 */
export function collectDirectives(doc: GoverningDocument): { sectionId: string; directive: DocumentDirective }[] {
    const result: { sectionId: string; directive: DocumentDirective }[] = [];
    for (const article of doc.articles) {
        for (const section of article.sections) {
            for (const directive of section.directives ?? []) {
                result.push({ sectionId: section.id, directive });
            }
        }
    }
    return result;
}


