/**
 * DocumentReconciler — "Government as Code" reconciliation loop.
 *
 * Reads all non-expired governing documents, extracts their directives, and
 * syncs the runtime authorities table to match what the documents declare.
 *
 * Desired state  = authority.define + authority.grant directives across all active documents.
 * Observed state = rows in the `authorities` SQLite table.
 *
 * The constitution is the first among equals — it carries no inherent superiority
 * over other documents by virtue of its type. The community decides what its
 * documents signify. Precedence on conflicts is determined by adoption date:
 * the document adopted earliest wins. This reflects the community's own choices
 * over time, not a type hierarchy baked into the software.
 *
 * The reconciler does NOT delete authorities it didn't create — removing an
 * authority requires an explicit `authority.define` removal followed by a
 * reconcile cycle that finds the row with no backing directive and warns.
 *
 * Call `DocumentReconciler.getInstance().reconcile()` at startup and after any
 * document save.
 */

import logger from "../logger.js";
import { DocumentLoader } from "./DocumentLoader.js";
import { AuthorityLoader } from "./AuthorityLoader.js";
import {
    collectDirectives,
    parseDirective,
    type AuthorityDefineDirective,
    type AuthorityGrantDirective,
    type CommitteeDefineDirective,
} from "@ecf/core";
import { Authority, Assembly, Committee } from "@ecf/core";

// ── Power cache ───────────────────────────────────────────────────────────────

/** A single action→voteRule mapping that an authority has been granted. */
export interface AuthorityPower {
    /** The action kind this authority may preside over, e.g. "suspend-member". */
    action:      string;
    /** Vote rule id required to pass this action, e.g. "simple-majority". */
    voteRuleId:  string;
    /** Section that declared this grant, for traceability. */
    sectionId:   string;
    /** Document that contains the granting section. */
    docId:       string;
}

// ── Reconciler ────────────────────────────────────────────────────────────────

export class DocumentReconciler {
    private static _instance: DocumentReconciler;

    /** In-memory power cache: authorityId → list of granted powers. */
    private _powers: Map<string, AuthorityPower[]> = new Map();

    /** Set of authority ids declared by `authority.define` directives. */
    private _defined: Set<string> = new Set();

    static getInstance(): DocumentReconciler {
        if (!DocumentReconciler._instance) {
            DocumentReconciler._instance = new DocumentReconciler();
        }
        return DocumentReconciler._instance;
    }

    // ── Public query API ──────────────────────────────────────────────────────

    /**
     * Return all powers granted to an authority.
     * Returns an empty array if the authority is unknown or has no grants.
     */
    getPowers(authorityId: string): AuthorityPower[] {
        return this._powers.get(authorityId) ?? [];
    }

    /**
     * Return the voteRuleId for a specific (authorityId, action) pair,
     * or null if that authority has not been granted that action.
     */
    getGrantedVoteRule(authorityId: string, action: string): string | null {
        return this._powers.get(authorityId)?.find(p => p.action === action)?.voteRuleId ?? null;
    }

    /**
     * Find which authority has been granted a particular action, consulting
     * documents in constitution-first, charter-second order.
     * Returns the first match, or null if no authority covers the action.
     */
    getAuthorityForAction(action: string): { authorityId: string; voteRuleId: string } | null {
        // Preserve constitution-then-charter precedence in the cache entries.
        // We stored powers in insertion order (reconcile processes docs in that order).
        for (const [authorityId, powers] of this._powers) {
            const p = powers.find(pw => pw.action === action);
            if (p) return { authorityId, voteRuleId: p.voteRuleId };
        }
        return null;
    }

    /**
     * True if the given authority id was declared by an `authority.define`
     * directive in a currently-active document.
     */
    isDeclared(authorityId: string): boolean {
        return this._defined.has(authorityId);
    }

    // ── Reconcile ─────────────────────────────────────────────────────────────

    /**
     * Full reconcile pass.  Safe to call multiple times — it rebuilds the
     * in-memory power cache from scratch on every run and syncs the DB.
     */
    reconcile(): void {
        const docLoader       = new DocumentLoader();
        const authorityLoader = AuthorityLoader.getInstance();

        const now  = new Date();
        const docs = docLoader.loadAll();

        // Oldest-first: the document adopted earliest wins on conflicts.
        // The community decides what its documents signify — no type carries
        // inherent precedence.
        const ordered = [...docs].sort(
            (a, b) => new Date(a.adoptedAt).getTime() - new Date(b.adoptedAt).getTime()
        );

        // ── Rebuild desired-state cache ──────────────────────────────────────
        const newPowers:  Map<string, AuthorityPower[]> = new Map();
        const newDefined: Set<string>                   = new Set();

        for (const doc of ordered) {
            // Skip expired documents (only meaningful on ordinances, but applies universally).
            if (doc.expiresAt && new Date(doc.expiresAt) <= now) {
                logger.debug(`[reconciler] skipping expired document "${doc.id}"`);
                continue;
            }

            const entries = collectDirectives(doc);

            for (const { sectionId, sectionTitle, directive } of entries) {
                const parsed = parseDirective(directive);
                if (!parsed) {
                    logger.warn(`[reconciler] malformed directive in "${doc.id}" §${sectionId}: ` +
                        JSON.stringify(directive));
                    continue;
                }

                if (directive.verb === "authority.define") {
                    this._applyAuthorityDefine(
                        parsed as AuthorityDefineDirective,
                        authorityLoader,
                        newDefined,
                    );
                } else if (directive.verb === "committee.define") {
                    this._applyCommitteeDefine(
                        parsed as CommitteeDefineDirective,
                        { sectionId, sectionTitle },
                        authorityLoader,
                        newDefined,
                    );
                } else if (directive.verb === "authority.grant") {
                    this._applyAuthorityGrant(
                        parsed as AuthorityGrantDirective,
                        sectionId, doc.id,
                        newPowers,
                    );
                }
                // parameter.define and document.require are not consumed here.
            }
        }

        // ── Drift detection ──────────────────────────────────────────────────
        // Any authority in the DB with no backing authority.define directive is
        // "orphaned" — log a warning so administrators can clean it up.
        for (const existing of authorityLoader.loadAll()) {
            if (!newDefined.has(existing.id)) {
                logger.warn(
                    `[reconciler] authority "${existing.id}" (${existing.kind}) exists in the ` +
                    `database but has no backing authority.define directive in any active document. ` +
                    `It will continue to function but may represent governance drift.`
                );
            }
        }

        // ── Commit cache ─────────────────────────────────────────────────────
        this._powers  = newPowers;
        this._defined = newDefined;

        const totalGrants = [...newPowers.values()].reduce((n, ps) => n + ps.length, 0);
        logger.info(
            `[reconciler] reconciled ${newDefined.size} authorit${newDefined.size === 1 ? "y" : "ies"} ` +
            `and ${totalGrants} power grant${totalGrants === 1 ? "" : "s"} from ${ordered.length} document${ordered.length === 1 ? "" : "s"}`
        );
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private _applyAuthorityDefine(
        d:       AuthorityDefineDirective,
        loader:  AuthorityLoader,
        defined: Set<string>,
    ): void {
        defined.add(d.id);

        const existing = loader.load(d.id);
        if (existing) {
            // Already exists — check for kind drift.
            if (existing.kind !== d.kind) {
                logger.warn(
                    `[reconciler] authority "${d.id}" exists as kind="${existing.kind}" ` +
                    `but directive declares kind="${d.kind}". DB row kept as-is; ` +
                    `update the document or manually migrate the authority.`
                );
            }
            // Name/description changes in directives are not applied automatically;
            // document prose is the human-readable record, DB is operational state.
            return;
        }

        // Create the authority row.
        const authority = this._buildAuthority(d);
        loader.save(authority);
        logger.info(`[reconciler] created authority "${d.id}" (kind=${d.kind})`);
    }

    private _applyAuthorityGrant(
        d:      AuthorityGrantDirective,
        sectionId: string,
        docId:     string,
        powers: Map<string, AuthorityPower[]>,
    ): void {
        if (!powers.has(d.authorityId)) powers.set(d.authorityId, []);
        const list = powers.get(d.authorityId)!;

        // Duplicate grant detection (same authority + action already cached).
        if (list.some(p => p.action === d.action)) {
            logger.warn(
                `[reconciler] duplicate authority.grant for "${d.authorityId}" action="${d.action}" ` +
                `in "${docId}" §${sectionId} — first declaration wins, this one is ignored.`
            );
            return;
        }

        list.push({ action: d.action, voteRuleId: d.voteRuleId, sectionId, docId });
    }

    private _applyCommitteeDefine(
        d:       CommitteeDefineDirective,
        ctx:     { sectionId: string; sectionTitle?: string },
        loader:  AuthorityLoader,
        defined: Set<string>,
    ): void {
        defined.add(d.id);

        const existing = loader.load(d.id);
        if (existing instanceof Committee) {
            // Update mutable fields if the document changes them.
            let dirty = false;
            if (existing.poolId    !== d.poolId)            { existing.poolId    = d.poolId;            dirty = true; }
            if (existing.permanent !== d.permanent)         { existing.permanent = d.permanent;         dirty = true; }
            if (existing.defaultVoteRuleId !== d.defaultVoteRuleId) { (existing as unknown as Record<string,string>)["defaultVoteRuleId"] = d.defaultVoteRuleId; dirty = true; }
            if (dirty) loader.save(existing);
            return;
        }
        if (existing) {
            logger.warn(`[reconciler] committee.define "${d.id}" collides with existing non-committee authority (kind=${existing.kind}) — skipping`);
            return;
        }

        const name = ctx.sectionTitle ?? this._titleCase(d.id);
        const committee = new Committee(d.id, name, d.defaultVoteRuleId);
        committee.poolId    = d.poolId;
        committee.permanent = d.permanent;
        loader.save(committee);
        logger.info(`[reconciler] created ${d.permanent ? "permanent" : "ad hoc"} committee "${name}" (${d.id}) chartered by pool "${d.poolId}"`);
    }

    private _buildAuthority(d: AuthorityDefineDirective): Authority {
        switch (d.kind) {
            case "assembly":
                return new Assembly(d.id, this._titleCase(d.id), d.defaultVoteRuleId, d.description);
            case "committee":
                return new Committee(d.id, this._titleCase(d.id), d.defaultVoteRuleId, d.description);
            case "membership":
            case "community":
            case "leader-pool":
            default:
                return new Authority(d.id, this._titleCase(d.id), d.defaultVoteRuleId, d.description, d.kind);
        }
    }

    private _titleCase(id: string): string {
        return id.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    }
}
