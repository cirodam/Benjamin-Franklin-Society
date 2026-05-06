import { Request, Response } from "express";
import { NominationService } from "../nomination/NominationService.js";
import { Nomination } from "../nomination/Nomination.js";
import { PersonService } from "../person/PersonService.js";
import { DomainService } from "../DomainService.js";
import { MotionService } from "../governance/MotionService.js";

type AuthedRequest = Request & { personId?: string };

const svc = () => NominationService.getInstance();

function toDto(n: Nomination) {
    const ppl = PersonService.getInstance();
    const poolName = n.poolId
        ? (DomainService.getInstance().getPool(n.poolId)?.name ?? null)
        : null;
    return {
        id:             n.id,
        createdAt:      n.createdAt.toISOString(),
        createdByHandle: ppl.get(n.createdBy)?.handle ?? null,
        type:           n.type,
        roleId:         n.roleId,
        unitId:         n.unitId,
        domainId:       n.domainId,
        poolId:         n.poolId,
        poolName,
        nomineeHandle:  ppl.get(n.nomineeId)?.handle ?? null,
        statement:      n.statement,
        status:         n.status,
        resolvedAt:     n.resolvedAt?.toISOString() ?? null,
        resolvedBy:     n.resolvedBy,
    };
}

// GET /api/nominations
export function listNominations(_req: Request, res: Response): void {
    res.json(svc().getAll().map(toDto));
}

// GET /api/nominations/vacancies
export function listVacancies(_req: Request, res: Response): void {
    res.json(svc().getVacancies());
}

// GET /api/nominations/expiring?days=60
export function listExpiring(req: Request, res: Response): void {
    const days = parseInt(req.query.days as string) || 60;
    res.json(svc().getExpiring(days));
}

// POST /api/nominations/pool
// Body: { poolId, nomineeHandle, statement }
export function createPoolNomination(req: AuthedRequest, res: Response): void {
    const personId = req.personId;
    if (!personId) { res.status(401).json({ error: "Authentication required" }); return; }

    const { poolId, nomineeHandle, statement } = req.body ?? {};

    if (typeof poolId !== "string" || !poolId.trim()) {
        res.status(400).json({ error: "poolId is required" }); return;
    }
    if (typeof nomineeHandle !== "string" || !nomineeHandle.trim()) {
        res.status(400).json({ error: "nomineeHandle is required" }); return;
    }

    const domainSvc = DomainService.getInstance();
    if (!domainSvc.getPool(poolId)) {
        res.status(404).json({ error: "Pool not found" }); return;
    }
    const nominee = PersonService.getInstance().getByHandle(nomineeHandle);
    if (!nominee) {
        res.status(404).json({ error: "Nominee not found" }); return;
    }

    const n = Nomination.forPool(
        personId,
        poolId,
        nominee.id,
        typeof statement === "string" ? statement.trim() : "",
    );
    svc().create(n);
    res.status(201).json(toDto(n));
}

// POST /api/nominations
// Body: { roleId, nomineeHandle, statement }
export function createNomination(req: AuthedRequest, res: Response): void {
    const personId = req.personId;
    if (!personId) { res.status(401).json({ error: "Authentication required" }); return; }

    const { roleId, nomineeHandle, statement } = req.body ?? {};

    if (typeof roleId !== "string" || !roleId.trim()) {
        res.status(400).json({ error: "roleId is required" }); return;
    }
    if (typeof nomineeHandle !== "string" || !nomineeHandle.trim()) {
        res.status(400).json({ error: "nomineeHandle is required" }); return;
    }

    // Verify the role exists
    const domainSvc = DomainService.getInstance();
    const role = domainSvc.getRole(roleId);
    if (!role) { res.status(404).json({ error: "Role not found" }); return; }

    // Verify the nominee is a real community member
    const nominee = PersonService.getInstance().getByHandle(nomineeHandle);
    if (!nominee) { res.status(404).json({ error: "Nominee not found" }); return; }

    // Find the unit and domain for this role
    const units = domainSvc.getUnits();
    const unit = units.find(u => u.roleIds.includes(roleId));
    if (!unit) { res.status(422).json({ error: "Role is not attached to a unit" }); return; }

    const domains = domainSvc.getDomains();
    const domain = domains.find(d => d.unitIds.includes(unit.id));
    if (!domain) { res.status(422).json({ error: "Unit is not attached to a domain" }); return; }

    const n = new Nomination(
        personId,
        roleId,
        unit.id,
        domain.id,
        nominee.id,
        typeof statement === "string" ? statement.trim() : "",
    );
    svc().create(n);
    res.status(201).json(toDto(n));
}

// PATCH /api/nominations/:id/confirm
// Called by the nominee to accept the nomination.
// - Pool nominations: immediately assigns the person (unchanged).
// - Role nominations: marks as "accepted" and places an accept-nomination
//   motion on the assembly docket for ratification.
export function confirmNomination(req: AuthedRequest, res: Response): void {
    const personId = req.personId;
    if (!personId) { res.status(401).json({ error: "Authentication required" }); return; }

    const nomination = svc().getById(req.params.id as string);
    if (!nomination || nomination.status !== "pending") {
        res.status(404).json({ error: "Nomination not found or already resolved" }); return;
    }

    const domainSvc = DomainService.getInstance();

    // ── Pool nominations: direct assignment (unchanged) ────────────────────
    if (nomination.type === "pool" && nomination.poolId) {
        const n = svc().confirm(req.params.id as string, personId);
        if (!n) { res.status(404).json({ error: "Nomination not found or already resolved" }); return; }
        const pool = domainSvc.getPool(n.poolId!);
        if (pool) {
            pool.addPerson(n.nomineeId);
            domainSvc.savePool(pool);
        }
        return void res.json({ nomination: toDto(n) });
    }

    // ── Role nominations: nominee accepts → place on assembly docket ───────
    const n = svc().acceptByNominee(req.params.id as string, personId);
    if (!n) { res.status(403).json({ error: "Not the nominee, or nomination is not pending" }); return; }

    const nominee  = PersonService.getInstance().get(n.nomineeId);
    const role     = domainSvc.getRole(n.roleId);
    const unit     = domainSvc.getUnit(n.unitId);

    const nomineeName = nominee ? `${nominee.firstName} ${nominee.lastName}` : n.nomineeId;
    const roleLabel   = role?.title ?? n.roleId;
    const unitLabel   = unit?.name  ?? n.unitId;

    const motion = MotionService.getInstance().create({
        authorityId:    "assembly",
        title:          `Confirm nomination: ${nomineeName} for ${roleLabel}`,
        description:    `${nomineeName} has accepted the nomination for ${roleLabel}` +
                        (unitLabel ? ` in ${unitLabel}` : "") +
                        (n.statement ? `.\n\nStatement: "${n.statement}"` : "."),
        proposerId:     n.nomineeId,
        proposerHandle: nominee?.handle ?? n.nomineeId,
        kind:           "accept-nomination",
        payload:        JSON.stringify({ nominationId: n.id }),
    });

    res.json({ nomination: toDto(n), motionId: motion.id });
}

// PATCH /api/nominations/:id/decline
export function declineNomination(req: AuthedRequest, res: Response): void {
    const personId = req.personId;
    if (!personId) { res.status(401).json({ error: "Authentication required" }); return; }

    const n = svc().decline(req.params.id as string, personId);
    if (!n) { res.status(404).json({ error: "Nomination not found or already resolved" }); return; }
    res.json(toDto(n));
}
