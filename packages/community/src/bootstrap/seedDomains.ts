import logger from "../logger.js";
import { DomainService } from "../DomainService.js";
import { RoleType } from "../common/RoleType.js";
import { DEFAULT_ROLE_TYPES } from "../common/defaultRoleTypes.js";
import { CentralBank } from "../domains/CentralBank.js";
import { SocialInsuranceBank } from "../domains/SocialInsuranceBank.js";
import { CommunityTreasury } from "../domains/CommunityTreasury.js";
import { FunctionalUnit, FunctionalRole } from "@ecf/core";
import { DocumentLoader } from "../governance/DocumentLoader.js";
import { reconcileStructure } from "./StructuralReconciler.js";

/**
 * Run on every boot after DomainService.init().
 *
 * 1. Upsert default role types (additive, backfills new fields).
 * 2. Register special code-defined domains (CentralBank, SocialInsuranceBank,
 *    CommunityTreasury) — these have runtime logic and are not declared in bylaws.
 * 3. Ensure the founding structural bylaws exist in the DB (first boot only).
 * 4. Run the structural reconciler — reads all governing documents and creates
 *    any domains, units, or pools that are declared but not yet in the DB.
 */
export function seedDomains(domainSvc: DomainService): void {

    // ── 1. Role types ─────────────────────────────────────────────────────────

    const existingByTitle = new Map(domainSvc.getRoleTypes().map(rt => [rt.title, rt]));
    let seeded = 0;
    for (const def of DEFAULT_ROLE_TYPES) {
        const existing = existingByTitle.get(def.title);
        if (!existing) {
            domainSvc.createRoleType(new RoleType(
                def.title, def.description, def.defaultKinPerMonth, undefined,
                def.preferredUnitTypes ?? [], def.category ?? "",
                def.responsibilities ?? [], def.qualifications ?? [],
            ));
            seeded++;
        } else {
            let dirty = false;
            if (!existing.category && def.category)                         { existing.category        = def.category;        dirty = true; }
            if (!existing.responsibilities?.length && def.responsibilities) { existing.responsibilities = def.responsibilities; dirty = true; }
            if (!existing.qualifications?.length  && def.qualifications)    { existing.qualifications   = def.qualifications;  dirty = true; }
            if (!existing.preferredUnitTypes?.length && def.preferredUnitTypes?.length) { existing.preferredUnitTypes = def.preferredUnitTypes; dirty = true; }
            if (dirty) { domainSvc.saveRoleType(existing); seeded++; }
        }
    }
    if (seeded > 0) logger.info(`[community] upserted ${seeded} default role type(s)`);

    // ── 2. Special code-defined domains ──────────────────────────────────────
    // These domains have runtime behaviour (custom logic, treasury integration)
    // and are not declared in the domains bylaw.

    domainSvc.registerDomain(CentralBank.getInstance());
    if (CentralBank.getInstance().unitIds.length === 0) {
        domainSvc.createUnit(
            new FunctionalUnit("Central Bank Office", "The central administrative office of the central bank.", "office"),
            CentralBank.getInstance().id,
        );
    }

    domainSvc.registerDomain(SocialInsuranceBank.getInstance());
    if (SocialInsuranceBank.getInstance().unitIds.length === 0) {
        domainSvc.createUnit(
            new FunctionalUnit("Social Insurance Office", "The central administrative office of the community social insurance fund.", "office"),
            SocialInsuranceBank.getInstance().id,
        );
    }

    domainSvc.registerDomain(CommunityTreasury.getInstance());
    if (CommunityTreasury.getInstance().unitIds.length === 0) {
        const treasuryOffice = new FunctionalUnit(
            "Treasury Office",
            "Administrative office responsible for tracking community income and expenditure, reconciling accounts, and preparing financial reports for the assembly.",
            "treasury-office",
        );
        domainSvc.createUnit(treasuryOffice, CommunityTreasury.getInstance().id);
        domainSvc.createRole(
            new FunctionalRole("Treasurer", "Manages the community treasury: tracks income and expenditure, reconciles accounts, prepares financial reports for the assembly, and ensures funds are allocated in line with governance decisions.", 4_583),
            treasuryOffice.id,
        );
    }

    // ── 3. Reconcile desired state from governing documents ───────────────────

    const docLoader = new DocumentLoader();
    const allDocs   = docLoader.loadAll();
    reconcileStructure(domainSvc, allDocs);
}
