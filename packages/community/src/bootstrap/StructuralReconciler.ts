/**
 * StructuralReconciler.ts
 *
 * Reads all governing documents, collects structural directives, and brings
 * the operational database into alignment with the declared desired state.
 *
 * This is the governance-as-code reconciliation loop:
 *   documents (desired state) → reconciler → DB (observed state)
 *
 * The reconciler is intentionally additive-only. It creates what is declared
 * but does not delete what is not — removal requires an explicit governance
 * motion so that decisions are always traceable.
 */

import logger from "../logger.js";
import {
    collectDirectives,
    parseDirective,
    type DomainDefineDirective,
    type DomainUnitDirective,
    type PoolDefineDirective,
    type PoolGovernsDirective,
    type GoverningDocument,
} from "@ecf/core";
import { FunctionalDomain, FunctionalUnit, LeaderPool } from "@ecf/core";
import { DomainService } from "../DomainService.js";
import { DocumentLoader } from "../governance/DocumentLoader.js";

export interface ReconcileReport {
    domainsCreated:  string[];
    unitsCreated:    string[];
    poolsCreated:    string[];
    poolsLinked:     { poolId: string; domainId: string }[];
    warnings:        string[];
}

function isDomainDefine(x: ReturnType<typeof parseDirective>): x is DomainDefineDirective {
    return x !== null && "id" in x && !("domainId" in x) && !("voteRuleId" in x) && !("poolId" in x) && !("key" in x) && !("authorityId" in x) && !("kind" in x) && !("action" in x);
}

function isDomainUnit(x: ReturnType<typeof parseDirective>): x is DomainUnitDirective {
    return x !== null && "domainId" in x && "unitType" in x;
}

function isPoolDefine(x: ReturnType<typeof parseDirective>): x is PoolDefineDirective {
    return x !== null && "id" in x && "voteRuleId" in x && !("domainId" in x) && !("kind" in x);
}

function isPoolGoverns(x: ReturnType<typeof parseDirective>): x is PoolGovernsDirective {
    return x !== null && "poolId" in x && "domainId" in x;
}

/**
 * Reconcile desired state (from governing documents) against the DomainService
 * registry. Safe to call on every boot.
 */
export function reconcileStructure(
    domainSvc: DomainService,
    docs: GoverningDocument[],
): ReconcileReport {
    const report: ReconcileReport = {
        domainsCreated: [],
        unitsCreated:   [],
        poolsCreated:   [],
        poolsLinked:    [],
        warnings:       [],
    };

    // Collect all section-aware directives from all documents
    type SectionedDirective = {
        docId:       string;
        sectionId:   string;
        sectionTitle?: string;
        sectionBody: string;
        sectionRationale?: string;
        verb:        string;
        parsed:      ReturnType<typeof parseDirective>;
    };

    const items: SectionedDirective[] = [];

    for (const doc of docs) {
        for (const article of doc.articles) {
            for (const section of article.sections) {
                for (const directive of section.directives ?? []) {
                    items.push({
                        docId:            doc.id,
                        sectionId:        section.id,
                        sectionTitle:     section.title,
                        sectionBody:      section.body,
                        sectionRationale: section.rationale,
                        verb:             directive.verb,
                        parsed:           parseDirective(directive),
                    });
                }
            }
        }
    }

    // ── Pass 1: domain.define ─────────────────────────────────────────────────

    for (const item of items) {
        const d = item.parsed;
        if (!isDomainDefine(d)) continue;

        if (domainSvc.getDomain(d.id)) continue; // already registered

        const name = item.sectionTitle ?? d.id;
        const description = item.sectionBody;
        const domain = new FunctionalDomain(name, description, d.id);
        domainSvc.registerDomain(domain);
        domainSvc.saveDomain(domain);
        report.domainsCreated.push(`${name} (${d.id})`);
        logger.info(`[reconciler] created domain "${name}" (${d.id})`);
    }

    // ── Pass 2: domain.unit ───────────────────────────────────────────────────

    for (const item of items) {
        const d = item.parsed;
        if (!isDomainUnit(d)) continue;

        const domain = domainSvc.getDomain(d.domainId);
        if (!domain) {
            report.warnings.push(`domain.unit in ${item.docId}§${item.sectionId}: domain "${d.domainId}" not found — skipping`);
            continue;
        }

        const unitName = item.sectionTitle;
        if (!unitName) {
            report.warnings.push(`domain.unit in ${item.docId}§${item.sectionId}: section has no title — skipping`);
            continue;
        }

        // Idempotency: skip if a unit with this name already exists in the domain
        const existing = domainSvc.getUnitsForDomain(d.domainId)
            .find(u => u.name.toLowerCase() === unitName.toLowerCase());
        if (existing) continue;

        const unit = new FunctionalUnit(unitName, item.sectionBody, d.unitType);
        domainSvc.createUnit(unit, d.domainId);
        report.unitsCreated.push(`${unitName} in ${domain.name}`);
        logger.info(`[reconciler] created unit "${unitName}" (${d.unitType}) in domain "${domain.name}"`);
    }

    // ── Pass 3: pool.define ───────────────────────────────────────────────────

    const existingPoolIds = new Set(domainSvc.getPools().map(p => p.id));
    const existingPoolsByName = new Map(domainSvc.getPools().map(p => [p.name.toLowerCase(), p]));

    for (const item of items) {
        const d = item.parsed;
        if (!isPoolDefine(d)) continue;

        if (existingPoolIds.has(d.id)) continue; // already exists by stable ID

        const poolName = item.sectionTitle;
        if (!poolName) {
            report.warnings.push(`pool.define in ${item.docId}§${item.sectionId}: section has no title — skipping`);
            continue;
        }

        // Also skip if a pool with this name already exists (legacy data without stable ID)
        if (existingPoolsByName.has(poolName.toLowerCase())) continue;

        const pool = new LeaderPool(d.id, poolName, d.voteRuleId, item.sectionBody);
        pool.mandate = item.sectionRationale ?? "";
        domainSvc.createPool(pool);
        existingPoolIds.add(d.id);
        report.poolsCreated.push(poolName);
        logger.info(`[reconciler] created pool "${poolName}" (${d.id})`);
    }

    // ── Pass 4: pool.governs ──────────────────────────────────────────────────

    for (const item of items) {
        const d = item.parsed;
        if (!isPoolGoverns(d)) continue;

        const domain = domainSvc.getDomain(d.domainId);
        if (!domain) {
            report.warnings.push(`pool.governs in ${item.docId}§${item.sectionId}: domain "${d.domainId}" not found — skipping`);
            continue;
        }

        // Only update if not already set to this pool
        if (domain.poolId === d.poolId) continue;

        // Don't overwrite a pool assignment unless the directive pool actually exists
        const pool = domainSvc.getPool(d.poolId);
        if (!pool) {
            report.warnings.push(`pool.governs in ${item.docId}§${item.sectionId}: pool "${d.poolId}" not found — skipping`);
            continue;
        }

        domain.poolId = d.poolId;
        domainSvc.saveDomain(domain);
        report.poolsLinked.push({ poolId: d.poolId, domainId: d.domainId });
        logger.info(`[reconciler] linked pool "${pool.name}" → domain "${domain.name}"`);
    }

    if (report.domainsCreated.length || report.unitsCreated.length || report.poolsCreated.length || report.poolsLinked.length) {
        logger.info(
            `[reconciler] summary: ${report.domainsCreated.length} domain(s), ` +
            `${report.unitsCreated.length} unit(s), ` +
            `${report.poolsCreated.length} pool(s) created; ` +
            `${report.poolsLinked.length} pool-domain link(s) set`,
        );
    } else {
        logger.info("[reconciler] observed state matches desired state — no changes needed");
    }

    for (const w of report.warnings) {
        logger.warn(`[reconciler] ${w}`);
    }

    return report;
}
